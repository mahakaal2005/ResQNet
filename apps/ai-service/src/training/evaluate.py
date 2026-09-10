#!/usr/bin/env python3
"""Report detector precision and recall from contract-shaped JSON files."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def iou(left: dict, right: dict) -> float:
    ax, ay, aw, ah = (left[key] for key in ("x", "y", "w", "h"))
    bx, by, bw, bh = (right[key] for key in ("x", "y", "w", "h"))
    overlap_w = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    overlap_h = max(0, min(ay + ah, by + bh) - max(ay, by))
    intersection = overlap_w * overlap_h
    union = aw * ah + bw * bh - intersection
    return intersection / union if union else 0.0


def score(predictions: list[dict], ground_truth: list[dict], threshold: float) -> dict[str, float | int]:
    unmatched = set(range(len(ground_truth)))
    true_positives = 0
    for prediction in sorted(predictions, key=lambda row: row["confidence"], reverse=True):
        choices = [(iou(prediction["bbox"], ground_truth[index]["bbox"]), index) for index in unmatched if prediction["drone_id"] == ground_truth[index]["drone_id"] and prediction["timestamp"] == ground_truth[index]["timestamp"]]
        if choices and max(choices)[0] >= threshold:
            true_positives += 1
            unmatched.remove(max(choices)[1])
    precision = true_positives / len(predictions) if predictions else 0.0
    recall = true_positives / len(ground_truth) if ground_truth else 0.0
    return {"true_positives": true_positives, "false_positives": len(predictions) - true_positives, "false_negatives": len(unmatched), "precision": round(precision, 4), "recall": round(recall, 4)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--ground-truth", type=Path, required=True)
    parser.add_argument("--iou", type=float, default=0.5)
    args = parser.parse_args()
    if not 0 < args.iou <= 1:
        parser.error("--iou must be in (0, 1]")
    report = score(json.loads(args.predictions.read_text()), json.loads(args.ground_truth.read_text()), args.iou)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
