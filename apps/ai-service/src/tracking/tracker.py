"""Lightweight identity tracker: assigns a stable track_id to detections
across consecutive frames from the same drone (PRD 5.1).

Greedy centroid-distance matching, not a full SORT/Kalman implementation --
appropriate for Phase 1's single-target-per-sighting scope. A track is
dropped after MAX_MISSED_FRAMES with no matching detection.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import count

MAX_MATCH_DISTANCE_PX = 60.0
MAX_MISSED_FRAMES = 3

_track_id_counter = count(1)


@dataclass
class TrackedDetection:
    detection_id: str
    drone_id: str
    timestamp: str
    centroid_x: float
    centroid_y: float
    track_id: str | None = None


@dataclass
class _Track:
    track_id: str
    last_x: float
    last_y: float
    missed_frames: int = 0


class Tracker:
    """Stateful tracker for a single drone's detection stream.

    Feed detections in timestamp order via `update`; each call returns the
    same list with `track_id` populated.
    """

    def __init__(
        self,
        max_match_distance_px: float = MAX_MATCH_DISTANCE_PX,
        max_missed_frames: int = MAX_MISSED_FRAMES,
    ) -> None:
        self._tracks: dict[str, _Track] = {}
        self._max_match_distance_px = max_match_distance_px
        self._max_missed_frames = max_missed_frames

    def update(self, detections: list[TrackedDetection]) -> list[TrackedDetection]:
        unmatched_tracks = set(self._tracks.keys())

        for det in detections:
            best_track_id, best_distance = self._closest_track(det, unmatched_tracks)

            if best_track_id is not None and best_distance <= self._max_match_distance_px:
                track = self._tracks[best_track_id]
                track.last_x, track.last_y = det.centroid_x, det.centroid_y
                track.missed_frames = 0
                det.track_id = best_track_id
                unmatched_tracks.discard(best_track_id)
            else:
                new_id = f"TRACK-{next(_track_id_counter):04d}"
                self._tracks[new_id] = _Track(new_id, det.centroid_x, det.centroid_y)
                det.track_id = new_id

        for track_id in unmatched_tracks:
            self._tracks[track_id].missed_frames += 1

        self._tracks = {
            tid: t for tid, t in self._tracks.items() if t.missed_frames <= self._max_missed_frames
        }

        return detections

    def _closest_track(
        self, det: TrackedDetection, candidate_ids: set[str]
    ) -> tuple[str | None, float]:
        best_id, best_dist = None, math.inf
        for tid in candidate_ids:
            track = self._tracks[tid]
            dist = math.hypot(det.centroid_x - track.last_x, det.centroid_y - track.last_y)
            if dist < best_dist:
                best_id, best_dist = tid, dist
        return best_id, best_dist
