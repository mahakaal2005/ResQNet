"""Person-candidate detectors for the aerial frame pipeline.

Two implementations share one ``detect(image_path, ...) -> list[Detection]``
interface and the same frozen output contract, so callers (app.py,
pipeline.py) can swap one for the other without changing anything else:

- ``CandidateDetector``: colour-segmentation fallback, zero ML dependency.
  Always available, useful for offline/no-weights demo runs.
- ``YoloDetector``: real inference using a YOLOv8 model fine-tuned on
  VisDrone's pedestrian+people classes (see src/training/train.py and
  docs/api/model-card.md for the training run this repo's committed
  weights came from). Falls back with a clear error if ultralytics isn't
  installed or the weight file is missing -- it never silently degrades to
  the colour detector, so a caller always knows which one actually ran.
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


DEFAULT_WEIGHTS = Path(__file__).parents[2] / "models" / "resqnet-person-v1.pt"


def yolo_runtime_error() -> str | None:
    """Return a human-readable error if this Python environment cannot run YOLO.

    Ultralytics imports torchvision lazily during its first inference.  Checking
    it here lets an ``auto`` run choose the documented fixture detector before
    processing a mission, instead of crashing on its first frame when local
    torch and torchvision wheels do not match.
    """
    try:
        import torch  # noqa: F401
        import torchvision  # noqa: F401
        from ultralytics import YOLO  # noqa: F401
    except Exception as error:  # Import failures vary by OS/wheel build.
        return f"YOLO runtime unavailable: {type(error).__name__}: {error}"
    return None


class YoloDetector:
    """Real inference using a fine-tuned YOLOv8 person detector.

    Confidence threshold defaults to 0.25 (ultralytics default) -- lower it
    for recall-sensitive search-and-rescue use, raise it to cut false
    positives for a noisy scene.
    """

    def __init__(self, weights_path: Path | str = DEFAULT_WEIGHTS, confidence_threshold: float = 0.25) -> None:
        self.weights_path = Path(weights_path)
        self.confidence_threshold = confidence_threshold
        if not self.weights_path.is_file():
            raise FileNotFoundError(
                f"no trained weights at {self.weights_path} — run src/training/train.py first, "
                "or pass an explicit weights_path"
            )
        runtime_error = yolo_runtime_error()
        if runtime_error:
            raise RuntimeError(
                f"{runtime_error}. Install matching CPU wheels, for example: "
                "pip install --force-reinstall --index-url https://download.pytorch.org/whl/cpu "
                "torch==2.5.1+cpu torchvision==0.20.1+cpu"
            )
        from ultralytics import YOLO
        self._model = YOLO(str(self.weights_path))

    def detect(self, image_path: Path, *, drone_id: str, sector_id: str, timestamp: str) -> list[Detection]:
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError(f"could not decode image: {image_path}")

        prediction = self._model.predict(
            source=str(image_path), conf=self.confidence_threshold, verbose=False
        )[0]

        results: list[Detection] = []
        for box in prediction.boxes:
            x1, y1, x2, y2 = (float(value) for value in box.xyxy[0])
            x, y, width, height = int(x1), int(y1), int(round(x2 - x1)), int(round(y2 - y1))
            confidence = round(float(box.conf[0]), 3)
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
