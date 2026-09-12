#!/usr/bin/env python3
"""Run detection over one image or a directory and emit the frozen contract."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from detector import CandidateDetector, DEFAULT_WEIGHTS, YoloDetector


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--image", type=Path)
    source.add_argument("--directory", type=Path)
    parser.add_argument("--drone-id", default="DRONE-01")
    parser.add_argument("--sector-id", default="SECTOR-A")
    parser.add_argument("--timestamp", default="2026-08-27T10:30:00Z")
    parser.add_argument("--output", type=Path, help="write JSON to this path instead of stdout")
    parser.add_argument(
        "--detector", choices=["auto", "color", "yolo"], default="auto",
        help="auto uses trained YOLO weights when available; color forces the fixture fallback",
    )
    args = parser.parse_args()

    images = [args.image] if args.image else sorted(p for p in args.directory.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if args.detector == "color":
        detector = CandidateDetector()
    elif args.detector == "yolo":
        detector = YoloDetector()
    elif DEFAULT_WEIGHTS.is_file():
        try:
            detector = YoloDetector()
        except RuntimeError as error:
            print(f"detector: CandidateDetector (auto fallback; {error})", file=sys.stderr)
            detector = CandidateDetector()
    else:
        detector = CandidateDetector()
    print(f"detector: {type(detector).__name__}", file=sys.stderr)
    detections = []
    try:
        for image in images:
            detections.extend(item.to_dict() for item in detector.detect(image, drone_id=args.drone_id, sector_id=args.sector_id, timestamp=args.timestamp))
    except (OSError, ValueError) as error:
        print(f"detection failed: {error}", file=sys.stderr)
        return 2
    rendered = json.dumps(detections, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
