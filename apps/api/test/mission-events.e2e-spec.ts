import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketIoServer } from 'socket.io';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MissionRealtimePublisher,
  REALTIME_NAMESPACE,
} from '../src/missions/mission-realtime.publisher.js';

/**
 * The Section 28 contract test against a real neighbour rather than a mock:
 * a genuine Socket.IO server on Chirag's `/realtime` namespace, applying
 * Chirag's own acceptance rules, receiving events published by our real
 * publisher over a real socket.
 *
 * What it protects: `mission.started` is the one event the whole edge waits on
 * (Section 23 lists it as Chirag's only Week-1 dependency on this track). If
 * our payload stops satisfying the gateway's guard, the gateway drops it
 * *silently* — no error, no log, drones simply never move. Nothing else in the
 * suite would notice.
 *
 * The gateway's own tests live in `apps/realtime/tests/`; this asserts only
 * the half of the contract we own — that what we put on the wire is what it
 * accepts.
 */

/**
 * Copied verbatim from `isMissionEvent` in
 * `apps/realtime/src/gateway/server.ts`. Duplicated rather than imported
 * because `apps/realtime` is a separate workspace with its own dependency
 * tree, and this file must not modify another owner's folder to run. If Chirag
 * tightens the guard, this test is where the mismatch surfaces.
 */
function isMissionEvent(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).mission_id === 'string' &&
    typeof (value as Record<string, unknown>).status === 'string'
  );
}

/** Events the gateway registers a handler for. `mission.completed` is not one. */
const GATEWAY_HANDLED = ['mission.started', 'mission.paused'] as const;

const STARTED = {
  mission_id: 'MISSION-E2E-RT',
  name: 'Yamuna Flood Plain — Realtime Sweep',
  status: 'active',
  sector_count: 3,
  started_at: new Date('2026-08-27T10:30:00.000Z'),
  completed_at: null,
};

describe('Mission events reach the realtime gateway', () => {
  let httpServer: HttpServer;
  let io: SocketIoServer;
  let publisher: MissionRealtimePublisher;

  /** Everything the gateway accepted and would have re-broadcast. */
  const accepted: Array<{ event: string; payload: unknown }> = [];
  /** Everything it received but its guard rejected — the silent-drop case. */
  const rejected: Array<{ event: string; payload: unknown }> = [];

  beforeAll(async () => {
    httpServer = createServer();
    io = new SocketIoServer(httpServer);

    // Chirag's namespace and handler shape, from gateway/server.ts.
    io.of(REALTIME_NAMESPACE).on('connection', (socket) => {
      for (const event of GATEWAY_HANDLED) {
        socket.on(event, (payload: unknown) => {
          (isMissionEvent(payload) ? accepted : rejected).push({ event, payload });
        });
      }
    });

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;

    publisher = new MissionRealtimePublisher(`http://localhost:${port}`);
    publisher.onModuleInit();

    // Both sides, not just the server's: the publisher drops an event while
    // its own socket reports disconnected, so gating only on the server's
    // socket count races the handshake and loses the first emit.
    await waitFor(() => publisher.connected && io.of(REALTIME_NAMESPACE).sockets.size === 1);
  }, 30_000);

  afterAll(async () => {
    publisher?.onModuleDestroy();
    await io?.close();
    httpServer?.close();
  });

  it('connects to the /realtime namespace the contract fixes', () => {
    expect(io.of(REALTIME_NAMESPACE).sockets.size).toBe(1);
    expect(publisher.connected).toBe(true);
  });

  it('delivers mission.started in a shape the gateway accepts', async () => {
    publisher.onStarted(STARTED);

    await waitFor(() => accepted.length === 1);

    expect(accepted[0].event).toBe('mission.started');
    expect(accepted[0].payload).toMatchObject({
      mission_id: 'MISSION-E2E-RT',
      status: 'active',
    });
    expect(rejected).toHaveLength(0);
  }, 30_000);

  it('delivers mission.paused', async () => {
    publisher.onPaused({ ...STARTED, status: 'paused' });

    await waitFor(() => accepted.length === 2);

    expect(accepted[1].event).toBe('mission.paused');
    expect(accepted[1].payload).toMatchObject({ status: 'paused' });
  }, 30_000);

  it('survives serialisation: Dates cross the wire, mission_id and status stay strings', async () => {
    // socket.io JSON-encodes the payload, so started_at arrives as an ISO
    // string rather than a Date. The two fields the guard checks must survive
    // that round trip unchanged, which is the whole point of this test.
    const payload = accepted[0].payload as Record<string, unknown>;

    expect(typeof payload.mission_id).toBe('string');
    expect(typeof payload.status).toBe('string');
    expect(payload.started_at).toBe('2026-08-27T10:30:00.000Z');
    expect(payload.completed_at).toBeNull();
    expect(payload.sector_count).toBe(3);
  });

  it('publishes mission.completed even though the gateway has no handler yet', async () => {
    // Section 10.6 assigns mission.completed to Ayush, and gateway/server.ts
    // registers handlers only for started/paused. Emitting it is harmless — an
    // unhandled Socket.IO event is discarded — and the relay is then ready the
    // moment Chirag adds the handler. Asserted so that day is not a surprise.
    publisher.onCompleted({ ...STARTED, status: 'completed' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(accepted.map((a) => a.event)).not.toContain('mission.completed');
    expect(rejected).toHaveLength(0);
  }, 30_000);
});

/**
 * Polls until `predicate` holds, so the test never sleeps longer than it must.
 *
 * The budget is generous because nothing here asserts latency — only that the
 * event arrives. A tighter one flaked when `npm run test:e2e` ran this
 * alongside the Testcontainers suites and the machine was busy pulling images.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the gateway');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
