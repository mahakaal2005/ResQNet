#!/usr/bin/env python3
"""Runs the trained YoloDetector over the held-out VisDronePerson val split,
builds a frozen-contract-shaped ground truth from the YOLO labels, and scores
precision/recall via src/training/evaluate.py's own IoU-matching logic.

Produces apps/ai-service/validation_results.json -- the real number the role
doc's Definition of Done calls for, replacing the empty [] placeholder.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.extend([str(ROOT / "src" / "detection"), str(ROOT / "src" / "training")])

from detector import YoloDetector  # noqa: E402
from evaluate import score  # noqa: E402

VAL_DIR = Path("/home/rudra/datasets/VisDronePerson")
IMAGES_DIR = VAL_DIR / "images" / "val"
LABELS_DIR = VAL_DIR / "labels" / "val"


def yolo_label_to_bbox(line: str, img_w: int, img_h: int) -> dict[str, int]:
    _, cx, cy, w, h = (float(v) for v in line.split())
    box_w, box_h = w * img_w, h * img_h
    x, y = cx * img_w - box_w / 2, cy * img_h - box_h / 2
    return {"x": int(round(x)), "y": int(round(y)), "w": int(round(box_w)), "h": int(round(box_h))}


def main() -> None:
    import cv2

    detector = YoloDetector()
    predictions: list[dict] = []
    ground_truth: list[dict] = []

    image_files = sorted(IMAGES_DIR.glob("*.jpg"))
    for index, image_path in enumerate(image_files):
        drone_id = f"VAL-{index:04d}"
        timestamp = f"2026-08-27T00:00:{index % 60:02d}Z"

        image = cv2.imread(str(image_path))
        if image is None:
            continue
        img_h, img_w = image.shape[:2]

        label_path = LABELS_DIR / (image_path.stem + ".txt")
        for line in label_path.read_text().splitlines():
            if not line.strip():
                continue
            ground_truth.append({
                "drone_id": drone_id,
                "timestamp": timestamp,
                "bbox": yolo_label_to_bbox(line, img_w, img_h),
            })

        for detection in detector.detect(image_path, drone_id=drone_id, sector_id="SECTOR-A", timestamp=timestamp):
            predictions.append(detection.to_dict())

    report = score(predictions, ground_truth, threshold=0.5)
    report["images_evaluated"] = len(image_files)
    report["dataset"] = "VisDrone2019-DET val split, pedestrian+people classes remapped to person"
    report["model"] = "YOLOv8n fine-tuned, resqnet-person-v1"

    output_path = ROOT / "validation_results.json"
    output_path.write_text(json.dumps([report], indent=2) + "\n")
    print(json.dumps(report, indent=2))
    print(f"\nWritten to {output_path}")


if __name__ == "__main__":
    main()
