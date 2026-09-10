"""Fixture CLI: detect -> track -> geolocate, with no running services."""
from __future__ import annotations
import argparse, json, sys
from urllib import request
from pathlib import Path
sys.path.extend([str(Path(__file__).parent / "detection"), str(Path(__file__).parent / "tracking"), str(Path(__file__).parent / "geolocation")])
from detector import CandidateDetector
from tracker import MultiFrameTracker
from geolocator import FlatGroundGeolocator

def post_json(url: str, payload: dict) -> None:
    """Use only the standard library so the standalone CLI stays lightweight."""
    body = json.dumps(payload).encode()
    with request.urlopen(request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=10) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"{url} returned HTTP {response.status}")


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--telemetry", required=True); parser.add_argument("--frames", required=True); parser.add_argument("--output", default="-"); parser.add_argument("--api-url", help="Optional Nest API base URL; ingests each detection then its geolocation")
    args = parser.parse_args(); tracker, locator, rows = MultiFrameTracker(), FlatGroundGeolocator(), []
    for item in json.loads(Path(args.telemetry).read_text()):
        frame = Path(args.frames) / item["frame_ref"]
        for detection in tracker.update([d.to_dict() for d in CandidateDetector().detect(frame, drone_id=item["drone_id"], sector_id=item["sector_id"], timestamp=item["timestamp"])]):
            result = locator.locate(detection, item, 640, 360); rows.append({**result, "track_id": detection["track_id"], "sector_id": item["sector_id"]})
            if args.api_url:
                post_json(args.api_url.rstrip("/") + "/detections", {key: value for key, value in detection.items() if key != "track_id"})
                post_json(args.api_url.rstrip("/") + "/geolocations", result)
    text = json.dumps(rows, indent=2)
    if args.output == "-": print(text)
    else: Path(args.output).write_text(text + "\n")
if __name__ == "__main__": main()
