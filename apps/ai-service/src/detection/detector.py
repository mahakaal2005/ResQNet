"""Small, dependency-light person-candidate detector used for the Week 1 demo.

It deliberately uses colour segmentation rather than claiming to be a trained
YOLO model.  It gives the API a real image-processing path today and has one
stable ``detect`` interface that can later be backed by a fine-tuned model.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha1
from pathlib import Path
from typing import Any

import cv2
import numpy as np


@dataclass(frozen=True)
class Detection:
    detection_id: str
    drone_id: str
    sector_id: str
    timestamp: str
    bbox: dict[str, int]
    confidence: float
    centroid: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CandidateDetector:
    """Detect high-visibility red/orange targets in an aerial frame."""

    def __init__(self, min_area: int = 24) -> None:
        self.min_area = min_area

    def detect(self, image_path: Path, *, drone_id: str, sector_id: str, timestamp: str) -> list[Detection]:
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"could not decode image: {image_path}")

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        # Red wraps around the HSV hue boundary; orange improves visibility for
        # common rescue vests and marker panels.
        mask = cv2.inRange(hsv, (0, 100, 80), (25, 255, 255)) | cv2.inRange(hsv, (170, 100, 80), (180, 255, 255))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        count, _, stats, _ = cv2.connectedComponentsWithStats(mask)

        results: list[Detection] = []
        for label in range(1, count):
            x, y, width, height, area = (int(value) for value in stats[label])
            if area < self.min_area:
                continue
            confidence = round(min(0.99, 0.55 + area / max(image.shape[0] * image.shape[1], 1) * 5), 3)
            identity = f"{image_path.name}:{x}:{y}:{width}:{height}:{drone_id}:{timestamp}"
            results.append(Detection(
                detection_id=f"DET-{sha1(identity.encode()).hexdigest()[:12].upper()}",
                drone_id=drone_id,
                sector_id=sector_id,
                timestamp=timestamp,
                bbox={"x": x, "y": y, "w": width, "h": height},
                confidence=confidence,
                centroid={"x": x + width // 2, "y": y + height // 2},
            ))
        return results
