from __future__ import annotations
import sys, unittest
from pathlib import Path
sys.path.extend([str(Path(__file__).parents[1] / "src" / "tracking"), str(Path(__file__).parents[1] / "src" / "geolocation")])
from tracker import MultiFrameTracker
from geolocator import FlatGroundGeolocator

class TrackingAndGeoTests(unittest.TestCase):
    def test_identity_is_stable_for_overlapping_detections(self):
        tracker = MultiFrameTracker()
        a = tracker.update([{"drone_id":"DRONE-01", "bbox":{"x":10,"y":10,"w":20,"h":30}}])[0]
        b = tracker.update([{"drone_id":"DRONE-01", "bbox":{"x":12,"y":11,"w":20,"h":30}}])[0]
        self.assertEqual(a["track_id"], b["track_id"])
    def test_center_pixel_projects_to_drone_position(self):
        result = FlatGroundGeolocator().locate({"detection_id":"DET-1", "centroid":{"x":320,"y":180}}, {"lat":28.6,"lon":77.2,"altitude_m":80,"heading_deg":90}, 640, 360)
        self.assertAlmostEqual(result["latitude"], 28.6, places=5); self.assertAlmostEqual(result["longitude"], 77.2, places=5)
        self.assertEqual(result["method"], "flat_ground_photogrammetric")
if __name__ == "__main__": unittest.main()
