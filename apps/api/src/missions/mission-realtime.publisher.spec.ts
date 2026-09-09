import { describe, expect, it } from 'vitest';
import {
  isPublishable,
  MISSION_EVENTS,
  MissionRealtimePublisher,
  REALTIME_NAMESPACE,
  type RealtimeSocket,
} from './mission-realtime.publisher.js';

interface FakeSocket extends RealtimeSocket {
  sent: Array<{ event: string; payload: unknown }>;
  closed: boolean;
}

function fakeSocket(connected = true): FakeSocket {
  return {
    connected,
    sent: [],
    closed: false,
    emit(event, payload) {
      this.sent.push({ event, payload });
    },
    close() {
      this.closed = true;
    },
  };
}

const STARTED = {
  mission_id: 'MISSION-DEMO-1',
  name: 'Yamuna Flood Plain — Demo Sweep',
  status: 'active',
  sector_count: 3,
  started_at: new Date('2026-08-27T10:30:00.000Z'),
  completed_at: null,
};

/** Boots a publisher against a fake socket, skipping the real network. */
function publisherWith(socket: FakeSocket | null, url = 'http://gateway:4000') {
  const publisher = new MissionRealtimePublisher(url, () => {
    if (!socket) throw new Error('gateway unreachable');
    return socket;
  });
  publisher.onModuleInit();
  return publisher;
}

describe('MissionRealtimePublisher', () => {
  it('forwards the three Section 10.6 events to the gateway', () => {
    const socket = fakeSocket();
    const publisher = publisherWith(socket);

    publisher.onStarted(STARTED);
    publisher.onPaused({ ...STARTED, status: 'paused' });
    publisher.onCompleted({ ...STARTED, status: 'completed' });

    expect(socket.sent.map((s) => s.event)).toEqual([...MISSION_EVENTS]);
  });

  it('publishes the payload verbatim, so the gateway can re-broadcast it', () => {
    const socket = fakeSocket();
    publisherWith(socket).onStarted(STARTED);

    // The gateway's isMissionEvent guard needs both of these or it drops the
    // packet silently; the rest is what saves the dashboard a follow-up GET.
    expect(socket.sent[0].payload).toEqual(STARTED);
    expect(socket.sent[0].payload).toMatchObject({
      mission_id: 'MISSION-DEMO-1',
      status: 'active',
    });
  });

  it('stays off when REALTIME_GATEWAY_URL is unset', () => {
    const socket = fakeSocket();
    const publisher = new MissionRealtimePublisher(undefined, () => socket);
    publisher.onModuleInit();

    publisher.onStarted(STARTED);

    // Section 1's design law: the API must not need another person's service.
    expect(socket.sent).toHaveLength(0);
  });

  it('survives a gateway that is down at boot', () => {
    const publisher = publisherWith(null);

    // Booting threw inside connect(); the API is still up and events no-op.
    expect(() => publisher.onStarted(STARTED)).not.toThrow();
  });

  it('drops rather than buffers an event while the gateway is disconnected', () => {
    const socket = fakeSocket(false);
    publisherWith(socket).onStarted(STARTED);

    // A replayed mission.started would restart drone motion for a mission that
    // has since completed.
    expect(socket.sent).toHaveLength(0);
  });

  it('refuses a payload the gateway would silently discard', () => {
    const socket = fakeSocket();
    const publisher = publisherWith(socket);

    publisher.onStarted({ name: 'no mission_id or status' });
    publisher.onPaused(null);

    expect(socket.sent).toHaveLength(0);
  });

  it('does not let a socket failure escape into the mission action', () => {
    const socket = fakeSocket();
    socket.emit = () => {
      throw new Error('socket write failed');
    };

    expect(() => publisherWith(socket).onStarted(STARTED)).not.toThrow();
  });

  it('closes the socket on shutdown', () => {
    const socket = fakeSocket();
    const publisher = publisherWith(socket);

    publisher.onModuleDestroy();

    expect(socket.closed).toBe(true);
  });

  it('targets the namespace the contract fixes', () => {
    expect(REALTIME_NAMESPACE).toBe('/realtime');
  });
});

describe('isPublishable', () => {
  it('accepts a payload carrying both fields the gateway guard requires', () => {
    expect(isPublishable({ mission_id: 'MISSION-DEMO-1', status: 'active' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'mission.started'],
    ['no status', { mission_id: 'MISSION-DEMO-1' }],
    ['no mission_id', { status: 'active' }],
    ['a non-string mission_id', { mission_id: 1, status: 'active' }],
  ])('rejects %s', (_label, payload) => {
    expect(isPublishable(payload)).toBe(false);
  });
});
