"""Fixture CLI: detect -> track -> geolocate, with no running services."""
from __future__ import annotations
import argparse, json, sys
from urllib import request
from pathlib import Path
sys.path.extend([str(Path(__file__).parent / "detection"), str(Path(__file__).parent / "tracking"), str(Path(__file__).parent / "geolocation")])
from detector import CandidateDetector, DEFAULT_WEIGHTS, YoloDetector
from tracker import MultiFrameTracker
from geolocator import FlatGroundGeolocator

def post_json(url: str, payload: dict) -> None:
    """Use only the standard library so the standalone CLI stays lightweight."""
    body = json.dumps(payload).encode()
    with request.urlopen(request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=10) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"{url} returned HTTP {response.status}")


def build_detector(mode: str):
    """auto (default) uses YOLO if trained weights exist, else the colour
    fallback -- always prints which one, so a run's output is never
    ambiguous about what actually produced it."""
    if mode == "color":
        print("detector: CandidateDetector (colour segmentation, forced)", file=sys.stderr)
        return CandidateDetector()
    if mode == "yolo":
        print("detector: YoloDetector (forced)", file=sys.stderr)
        return YoloDetector()
    if DEFAULT_WEIGHTS.is_file():
        print(f"detector: YoloDetector (auto-selected, weights at {DEFAULT_WEIGHTS})", file=sys.stderr)
        return YoloDetector()
    print(f"detector: CandidateDetector (auto-selected, no weights at {DEFAULT_WEIGHTS})", file=sys.stderr)
    return CandidateDetector()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--telemetry", required=True)
    parser.add_argument("--frames", required=True)
    parser.add_argument("--output", default="-")
    parser.add_argument("--api-url", help="Optional Nest API base URL; ingests each detection then its geolocation")
    parser.add_argument("--detector", choices=["auto", "color", "yolo"], default="auto")
    args = parser.parse_args()

    detector = build_detector(args.detector)
    tracker, locator, rows = MultiFrameTracker(), FlatGroundGeolocator(), []

    for item in json.loads(Path(args.telemetry).read_text()):
        frame = Path(args.frames) / item["frame_ref"]
        detections = [d.to_dict() for d in detector.detect(
            frame, drone_id=item["drone_id"], sector_id=item["sector_id"], timestamp=item["timestamp"]
        )]
        for detection in tracker.update(detections):
            result = locator.locate(detection, item, 640, 360)
            rows.append({**result, "track_id": detection["track_id"], "sector_id": item["sector_id"]})
            if args.api_url:
                post_json(args.api_url.rstrip("/") + "/detections", {key: value for key, value in detection.items() if key != "track_id"})
                post_json(args.api_url.rstrip("/") + "/geolocations", result)

    text = json.dumps(rows, indent=2)
    if args.output == "-":
        print(text)
    else:
        Path(args.output).write_text(text + "\n")


if __name__ == "__main__":
    main()
