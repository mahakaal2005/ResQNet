from __future__ import annotations
import json
from math import cos, pi, sqrt
from pathlib import Path
from geolocator import EARTH_RADIUS_M

def distance_m(a: dict, b: dict) -> float:
    north = (a["latitude"] - b["latitude"]) * pi / 180 * EARTH_RADIUS_M
    east = (a["longitude"] - b["longitude"]) * pi / 180 * EARTH_RADIUS_M * cos(b["latitude"] * pi / 180)
    return sqrt(north * north + east * east)

def score(predictions: list[dict], truth: list[dict]) -> dict:
    matched = [(p, next((t for t in truth if t["sector_id"] == p.get("sector_id")), None)) for p in predictions]
    errors = [distance_m(p, t) for p, t in matched if t]
    return {"samples": len(errors), "mean_error_m": round(sum(errors) / len(errors), 2) if errors else None, "max_error_m": round(max(errors), 2) if errors else None}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(); parser.add_argument("predictions"); parser.add_argument("ground_truth")
    args = parser.parse_args()
    print(json.dumps(score(json.loads(Path(args.predictions).read_text()), json.loads(Path(args.ground_truth).read_text())), indent=2))
