export type DroneStatus = "connected" | "lost" | "reconnected";

export interface DroneStateEvent {
  drone_id: string;
  status: DroneStatus;
  sector_id: string | null;
  last_seen: string; // ISO timestamp
}

interface Internal {
  status: DroneStatus;
  sector_id: string | null;
  lastSeenMs: number;
}

/**
 * Tracks per-drone connectivity. A drone is considered "lost" if no
 * telemetry tick arrives within `lostAfterMs`. Call `tick()` periodically
 * (e.g. every second) alongside `onTelemetry()` on every packet.
 */
export class DroneStateMachine {
  private drones = new Map<string, Internal>();
  private readonly lostAfterMs: number;

  constructor(lostAfterMs = 5000) {
    this.lostAfterMs = lostAfterMs;
  }

  /** Feed a telemetry packet in. Returns a status event if the drone's status changed. */
  onTelemetry(droneId: string, sectorId: string, atMs: number = Date.now()): DroneStateEvent | null {
    const prev = this.drones.get(droneId);
    const wasLost = prev?.status === "lost";
    this.drones.set(droneId, { status: "connected", sector_id: sectorId, lastSeenMs: atMs });

    if (!prev) {
      return this.event(droneId, "connected");
    }
    if (wasLost) {
      return this.event(droneId, "reconnected");
    }
    return null; // steady-state connected, no event needed
  }

  /** Sweep for drones that have gone quiet. Returns status events for newly-lost drones. */
  tick(nowMs: number = Date.now()): DroneStateEvent[] {
    const events: DroneStateEvent[] = [];
    for (const [droneId, s] of this.drones.entries()) {
      if (s.status !== "lost" && nowMs - s.lastSeenMs > this.lostAfterMs) {
        s.status = "lost";
        events.push(this.event(droneId, "lost"));
      }
    }
    return events;
  }

  get(droneId: string): Internal | undefined {
    return this.drones.get(droneId);
  }

  private event(droneId: string, status: DroneStatus): DroneStateEvent {
    const s = this.drones.get(droneId)!;
    // status may have just been set on `s` directly (tick()) or needs the
    // passed-in value (onTelemetry()) — reconcile before returning.
    s.status = status;
    return {
      drone_id: droneId,
      status,
      sector_id: s.sector_id,
      last_seen: new Date(s.lastSeenMs).toISOString(),
    };
  }
}
