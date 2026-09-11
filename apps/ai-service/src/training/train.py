#!/usr/bin/env python3
"""Optional YOLO fine-tuning entrypoint; keeps heavy ML dependencies opt-in."""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="YOLO dataset.yaml")
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640, help="Lower (e.g. 416) speeds up CPU-only training")
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--device", default=None, help="'cpu', an int GPU index, or omit for auto-detect")
    parser.add_argument("--project", type=Path, default=Path("runs/detect"))
    parser.add_argument("--name", default="train")
    args = parser.parse_args()
    if not args.data.is_file():
        parser.error(f"dataset configuration not found: {args.data}")
    try:
        from ultralytics import YOLO
    except ImportError as error:
        parser.error("install optional training dependency first: pip install ultralytics")
        raise AssertionError from error
    YOLO(args.model).train(
        data=str(args.data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
        device=args.device,
        project=str(args.project),
        name=args.name,
    )


if __name__ == "__main__":
    main()
