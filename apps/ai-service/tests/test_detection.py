from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "src" / "detection"))
from detector import CandidateDetector, DEFAULT_WEIGHTS, YoloDetector


class CandidateDetectorTests(unittest.TestCase):
    def test_returns_frozen_contract_for_visible_target(self) -> None:
        image = np.zeros((120, 160, 3), dtype=np.uint8)
        cv2.rectangle(image, (20, 30), (39, 79), (0, 0, 255), -1)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "frame.jpg"
            cv2.imwrite(str(target), image)
            result = CandidateDetector().detect(target, drone_id="DRONE-01", sector_id="SECTOR-A", timestamp="2026-08-27T10:30:00Z")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].bbox, {"x": 20, "y": 30, "w": 20, "h": 50})
        self.assertEqual(result[0].centroid, {"x": 30, "y": 55})
        self.assertTrue(result[0].detection_id.startswith("DET-"))

    def test_placeholder_has_no_false_detection(self) -> None:
        frame = Path(__file__).parents[2] / "simulator" / "sample_frames" / "frame_00001.jpg"
        result = CandidateDetector().detect(frame, drone_id="DRONE-01", sector_id="SECTOR-A", timestamp="2026-08-27T10:30:00Z")
        self.assertEqual(result, [])


class YoloDetectorTests(unittest.TestCase):
    def test_raises_clear_error_when_weights_missing(self) -> None:
        with self.assertRaises(FileNotFoundError):
            YoloDetector(weights_path=Path("/nonexistent/weights.pt"))

    @unittest.skipUnless(DEFAULT_WEIGHTS.is_file(), "trained weights not present; run src/training/train.py first")
    def test_returns_frozen_contract_shape_with_real_weights(self) -> None:
        frame = Path(__file__).parents[2] / "simulator" / "sample_frames" / "frame_00001.jpg"
        detector = YoloDetector()
        result = detector.detect(frame, drone_id="DRONE-01", sector_id="SECTOR-A", timestamp="2026-08-27T10:30:00Z")
        for detection in result:
            self.assertTrue(detection.detection_id.startswith("DET-"))
            self.assertEqual(set(detection.bbox), {"x", "y", "w", "h"})
            self.assertEqual(set(detection.centroid), {"x", "y"})
            self.assertGreaterEqual(detection.confidence, 0.0)
            self.assertLessEqual(detection.confidence, 1.0)


if __name__ == "__main__":
    unittest.main()
