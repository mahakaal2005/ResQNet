"""Real YOLO-backed detector with the same interface as CandidateDetector."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha1
from pathlib import Path
from typing import Any

from ultralytics import YOLO


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


class YoloDetector:
    """Detects the COCO 'person' class (id 0) using a real Ultralytics model."""

    PERSON_CLASS_ID = 0

    def __init__(self, weights: str = "yolov8n.pt", conf: float = 0.25) -> None:
        self.model = YOLO(weights)
        self.conf = conf

    def detect(self, image_path: Path, *, drone_id: str, sector_id: str, timestamp: str) -> list[Detection]:
        results = self.model.predict(str(image_path), conf=self.conf, classes=[self.PERSON_CLASS_ID], verbose=False)
        results_list: list[Detection] = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())
                x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
                confidence = round(float(box.conf[0]), 3)
                identity = f"{image_path.name}:{x}:{y}:{w}:{h}:{drone_id}:{timestamp}"
                results_list.append(Detection(
                    detection_id=f"DET-{sha1(identity.encode()).hexdigest()[:12].upper()}",
                    drone_id=drone_id,
                    sector_id=sector_id,
                    timestamp=timestamp,
                    bbox={"x": x, "y": y, "w": w, "h": h},
                    confidence=confidence,
                    centroid={"x": x + w // 2, "y": y + h // 2},
                ))
        return results_list