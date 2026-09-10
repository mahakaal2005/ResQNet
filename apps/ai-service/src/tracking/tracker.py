"""Small deterministic IoU tracker used between detection and geolocation.

The tracker has no model/runtime dependency and deliberately keeps identities
scoped to a drone.  It is suitable for fixture playback and can be replaced by
ByteTrack without changing the output envelope.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def iou(a: dict[str, int], b: dict[str, int]) -> float:
    left, top = max(a["x"], b["x"]), max(a["y"], b["y"])
    right, bottom = min(a["x"] + a["w"], b["x"] + b["w"]), min(a["y"] + a["h"], b["y"] + b["h"])
    overlap = max(0, right - left) * max(0, bottom - top)
    union = a["w"] * a["h"] + b["w"] * b["h"] - overlap
    return overlap / union if union else 0.0


@dataclass
class Track:
    track_id: str
    drone_id: str
    bbox: dict[str, int]
    missed: int = 0


class MultiFrameTracker:
    def __init__(self, min_iou: float = 0.25, max_missed: int = 8) -> None:
        self.min_iou, self.max_missed, self._next_id = min_iou, max_missed, 1
        self._tracks: list[Track] = []

    def update(self, detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Assign a stable ``track_id`` to each detection in a frame."""
        unmatched = set(range(len(self._tracks)))
        output: list[dict[str, Any]] = []
        for detection in detections:
            candidates = [(iou(track.bbox, detection["bbox"]), index) for index, track in enumerate(self._tracks)
                          if index in unmatched and track.drone_id == detection["drone_id"]]
            score, index = max(candidates, default=(0.0, -1))
            if score >= self.min_iou:
                track = self._tracks[index]
                track.bbox, track.missed = detection["bbox"], 0
                unmatched.remove(index)
            else:
                track = Track(f"TRK-{self._next_id:05d}", detection["drone_id"], detection["bbox"])
                self._next_id += 1
                self._tracks.append(track)
            output.append({**detection, "track_id": track.track_id})
        for index in unmatched:
            self._tracks[index].missed += 1
        self._tracks = [track for track in self._tracks if track.missed <= self.max_missed]
        return output
