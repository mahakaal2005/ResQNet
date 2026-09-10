import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { io, type Socket } from 'socket.io-client';

/**
 * Delivers the three Section 10.6 mission events to Chirag's realtime gateway.
 *
 * `EventEmitter2` is in-process, and `apps/realtime` is a separate Node
 * process, so nothing we emit reaches the gateway on its own. The gateway
 * already listens for `mission.started` / `mission.paused` from a connected
 * `/realtime` client and re-broadcasts them to the dashboard — its own comment
 * says "Charan's mission service can publish these events directly once live"
 * — so this is the client that makes that true, and it is the Week-2
 * "publish real mission.started for Chirag" item.
 *
 * Until this existed the gateway fell back to
 * `drone-state/missionState.ts`, a 500ms timer that fakes one
 * `mission.started` after a client connects. That fixture can retire once this
 * is wired up in the integrated run.
 *
 * Nothing here may block or fail a mission action: Section 1's design law says
 * no one writes code that requires another person's running service. So the
 * publisher is **off unless `REALTIME_GATEWAY_URL` is set**, every failure is
 * logged rather than thrown, and `docker compose up api` still serves the
 * independent demo with no gateway anywhere.
 */

/** The subset of a socket.io client this class uses — swapped for a fake in tests. */
export interface RealtimeSocket {
  readonly connected: boolean;
  emit(event: string, payload: unknown): void;
  close(): void;
}

export interface MissionEventPayload {
  mission_id: string;
  status: string;
  [key: string]: unknown;
}

/** Chirag's namespace. Fixed by packages/contracts/README.md, not configurable. */
export const REALTIME_NAMESPACE = '/realtime';

/** The three events Section 10.6 assigns to this track. */
export const MISSION_EVENTS = ['mission.started', 'mission.paused', 'mission.completed'] as const;

/**
 * The gateway's `isMissionEvent` guard drops anything without both fields, so
 * a payload that fails this check would vanish silently on the far side.
 * Checked here instead, where it can be logged.
 */
export function isPublishable(payload: unknown): payload is MissionEventPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as MissionEventPayload).mission_id === 'string' &&
    typeof (payload as MissionEventPayload).status === 'string'
  );
}

@Injectable()
export class MissionRealtimePublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MissionRealtimePublisher.name);
  private socket?: RealtimeSocket;

  constructor(
    private readonly gatewayUrl = process.env.REALTIME_GATEWAY_URL,
    /** Injection seam for tests; production uses socket.io-client. */
    private readonly connect: (url: string) => RealtimeSocket = defaultConnect,
  ) {}

  onModuleInit(): void {
    if (!this.gatewayUrl) {
      this.logger.log(
        'REALTIME_GATEWAY_URL is unset — mission events stay in-process. Set it to publish to the realtime gateway.',
      );
      return;
    }

    try {
      this.socket = this.connect(this.gatewayUrl);
      this.logger.log(`Publishing mission events to ${this.gatewayUrl}${REALTIME_NAMESPACE}`);
    } catch (error) {
      // A gateway that is down at boot must not stop the API from booting.
      this.logger.error(`Could not reach the realtime gateway at ${this.gatewayUrl}`, error as Error);
    }
  }

  onModuleDestroy(): void {
    this.socket?.close();
  }

  /**
   * Whether the gateway link is live — publishing is a no-op while it is not.
   *
   * Exposed because the server registering a socket and the client marking
   * itself connected are not the same instant: anything waiting on this link
   * has to gate on the client's own view, not the server's, or it races the
   * handshake and loses the first event to the drop rule above.
   */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  @OnEvent('mission.started')
  onStarted(payload: unknown): void {
    this.publish('mission.started', payload);
  }

  @OnEvent('mission.paused')
  onPaused(payload: unknown): void {
    this.publish('mission.paused', payload);
  }

  /**
   * The gateway has no `mission.completed` handler today, so this is a no-op
   * on the far side rather than an error — Section 10.6 lists Ayush, not
   * Chirag, as its consumer. Published anyway so the relay is ready the moment
   * Chirag adds the handler; flagged in docs/contracts/mission.md.
   */
  @OnEvent('mission.completed')
  onCompleted(payload: unknown): void {
    this.publish('mission.completed', payload);
  }

  private publish(event: string, payload: unknown): void {
    if (!this.socket) return;

    if (!isPublishable(payload)) {
      this.logger.warn(`Refusing to publish ${event}: payload lacks mission_id or status`);
      return;
    }

    // Dropped rather than buffered. socket.io would replay a queued
    // mission.started after a long outage, restarting drone motion for a
    // mission that has since completed — a stale operator action is worse than
    // a missed one, and the dashboard re-reads state on reconnect anyway.
    if (!this.socket.connected) {
      this.logger.warn(`Gateway not connected — dropped ${event} for ${payload.mission_id}`);
      return;
    }

    try {
      this.socket.emit(event, payload);
    } catch (error) {
      this.logger.error(`Failed to publish ${event}`, error as Error);
    }
  }
}

function defaultConnect(url: string): RealtimeSocket {
  const socket: Socket = io(`${url}${REALTIME_NAMESPACE}`, {
    // The API is a long-lived service: keep retrying forever rather than
    // giving up on a gateway that is merely restarting.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 10_000,
    transports: ['websocket'],
  });

  socket.on('connect_error', () => {
    // Silent by design: the gateway being absent is a supported state, and
    // logging every retry would drown the API's own output.
  });

  return socket;
}
