"""SORT-style tracker: constant-velocity Kalman filter per track + Hungarian
(linear-sum-assignment) data association on IoU. Upgrade over tracker.py's
greedy centroid matcher -- same public contract (feed detections, get
track_id back), better under occlusion/crossing paths since it predicts
motion instead of just looking at last-known position.

State per track: [cx, cy, w, h, vcx, vcy, vw] (velocity terms for center and
width; height derived to keep aspect roughly stable, following the classic
SORT state choice).
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import count

import numpy as np
from scipy.optimize import linear_sum_assignment

MIN_IOU_FOR_MATCH = 0.3
MAX_MISSED_FRAMES = 3

_track_id_counter = count(1)


@dataclass
class BBoxDetection:
    detection_id: str
    drone_id: str
    timestamp: str
    x: float
    y: float
    w: float
    h: float
    track_id: str | None = None


def _to_center_form(x: float, y: float, w: float, h: float) -> np.ndarray:
    return np.array([x + w / 2, y + h / 2, w, h], dtype=float)


def _iou(box_a: tuple[float, float, float, float], box_b: tuple[float, float, float, float]) -> float:
    """IoU between two (x, y, w, h) boxes in top-left/width/height form."""
    ax1, ay1, aw, ah = box_a
    bx1, by1, bw, bh = box_b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)

    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


class _KalmanBoxTrack:
    """Constant-velocity Kalman filter over [cx, cy, w, h, vcx, vcy, vw]."""

    def __init__(self, track_id: str, x: float, y: float, w: float, h: float):
        self.track_id = track_id
        self.missed_frames = 0
        self.hits = 1

        cx, cy = x + w / 2, y + h / 2
        self.state = np.array([cx, cy, w, h, 0.0, 0.0, 0.0], dtype=float)

        # constant-velocity transition: position += velocity each step
        self.F = np.eye(7)
        self.F[0, 4] = 1.0  # cx += vcx
        self.F[1, 5] = 1.0  # cy += vcy
        self.F[2, 6] = 1.0  # w  += vw

        self.H = np.zeros((4, 7))
        self.H[0, 0] = self.H[1, 1] = self.H[2, 2] = self.H[3, 3] = 1.0

        self.P = np.eye(7) * 10.0
        self.Q = np.eye(7) * 0.5  # process noise
        self.R = np.eye(4) * 2.0  # measurement noise

    def predict(self) -> None:
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q

    def update(self, x: float, y: float, w: float, h: float) -> None:
        z = _to_center_form(x, y, w, h)
        y_residual = z - self.H @ self.state
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)

        self.state = self.state + K @ y_residual
        self.P = (np.eye(7) - K @ self.H) @ self.P

        self.missed_frames = 0
        self.hits += 1

    def predicted_bbox(self) -> tuple[float, float, float, float]:
        cx, cy, w, h = self.state[:4]
        return (cx - w / 2, cy - h / 2, w, h)


class SortTracker:
    """Stateful multi-object tracker for a single drone's detection stream."""

    def __init__(
        self,
        min_iou_for_match: float = MIN_IOU_FOR_MATCH,
        max_missed_frames: int = MAX_MISSED_FRAMES,
    ) -> None:
        self._tracks: dict[str, _KalmanBoxTrack] = {}
        self._min_iou = min_iou_for_match
        self._max_missed_frames = max_missed_frames

    def update(self, detections: list[BBoxDetection]) -> list[BBoxDetection]:
        for track in self._tracks.values():
            track.predict()

        track_ids = list(self._tracks.keys())
        matched_track_ids: set[str] = set()

        if track_ids and detections:
            cost_matrix = np.zeros((len(detections), len(track_ids)))
            for i, det in enumerate(detections):
                for j, tid in enumerate(track_ids):
                    iou = _iou((det.x, det.y, det.w, det.h), self._tracks[tid].predicted_bbox())
                    cost_matrix[i, j] = 1.0 - iou

            det_indices, track_indices = linear_sum_assignment(cost_matrix)

            for di, ti in zip(det_indices, track_indices):
                iou = 1.0 - cost_matrix[di, ti]
                if iou >= self._min_iou:
                    tid = track_ids[ti]
                    det = detections[di]
                    self._tracks[tid].update(det.x, det.y, det.w, det.h)
                    det.track_id = tid
                    matched_track_ids.add(tid)

        for det in detections:
            if det.track_id is None:
                new_id = f"TRACK-{next(_track_id_counter):04d}"
                self._tracks[new_id] = _KalmanBoxTrack(new_id, det.x, det.y, det.w, det.h)
                det.track_id = new_id
                matched_track_ids.add(new_id)

        for tid in track_ids:
            if tid not in matched_track_ids:
                self._tracks[tid].missed_frames += 1

        self._tracks = {
            tid: t for tid, t in self._tracks.items() if t.missed_frames <= self._max_missed_frames
        }

        return detections
