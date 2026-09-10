"""HTTP service for Faiqua's independent detection demo."""
from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from detector import CandidateDetector, DEFAULT_WEIGHTS, YoloDetector
import sys
sys.path.extend([str(Path(__file__).parents[1] / "tracking"), str(Path(__file__).parents[1] / "geolocation")])
from tracker import MultiFrameTracker
from geolocator import FlatGroundGeolocator

logger = logging.getLogger("resqnet.detection")

app = FastAPI(title="ResQNet Detection Service", version="1.0.0")


def _select_detector() -> CandidateDetector | YoloDetector:
    """RESQNET_DETECTOR=color forces the fallback; RESQNET_DETECTOR=yolo
    requires real weights and fails loudly if they're missing. Auto (default)
    uses YOLO when trained weights are present, color otherwise -- but always
    logs which one actually loaded, so a caller can tell without guessing."""
    mode = os.environ.get("RESQNET_DETECTOR", "auto").lower()
    if mode == "color":
        logger.info("detector: CandidateDetector (colour segmentation, forced by RESQNET_DETECTOR=color)")
        return CandidateDetector()
    if mode == "yolo":
        logger.info("detector: YoloDetector (forced by RESQNET_DETECTOR=yolo)")
        return YoloDetector()
    if DEFAULT_WEIGHTS.is_file():
        logger.info("detector: YoloDetector (auto-selected, trained weights found at %s)", DEFAULT_WEIGHTS)
        return YoloDetector()
    logger.info("detector: CandidateDetector (auto-selected, no trained weights at %s)", DEFAULT_WEIGHTS)
    return CandidateDetector()


detector = _select_detector()
tracker = MultiFrameTracker()
locator = FlatGroundGeolocator()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "detector": type(detector).__name__}


@app.post("/ai/detect")
async def detect(
    image: UploadFile = File(...),
    drone_id: str = Form(...),
    sector_id: str = Form(...),
    timestamp: str = Form(...),
) -> list[dict]:
    suffix = Path(image.filename or "frame.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix) as temporary:
        temporary.write(await image.read())
        temporary.flush()
        try:
            return [item.to_dict() for item in detector.detect(Path(temporary.name), drone_id=drone_id, sector_id=sector_id, timestamp=timestamp)]
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/ai/process")
async def process_frame(
    image: UploadFile = File(...),
    telemetry: str = Form(...),
) -> dict:
    """Run detection, tracking and geolocation for one telemetry/frame pair.

    ``telemetry`` is the frozen telemetry JSON object.  The response keeps the
    frozen detection and geolocation payloads separate so a caller can POST
    them, in that order, to the API's /detections and /geolocations endpoints.
    This is deliberately stateful for tracking, but is otherwise independent
    of the Nest API and the realtime gateway.
    """
    try:
        packet = json.loads(telemetry)
        for field in ("drone_id", "sector_id", "timestamp", "lat", "lon", "altitude_m"):
            if field not in packet:
                raise ValueError(f"telemetry.{field} is required")
    except (json.JSONDecodeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    suffix = Path(image.filename or "frame.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix) as temporary:
        temporary.write(await image.read())
        temporary.flush()
        try:
            detected = [item.to_dict() for item in detector.detect(
                Path(temporary.name), drone_id=packet["drone_id"],
                sector_id=packet["sector_id"], timestamp=packet["timestamp"],
            )]
            tracked = tracker.update(detected)
            import cv2
            frame = cv2.imread(temporary.name)
            if frame is None:
                raise ValueError("could not decode image")
            geolocations = [locator.locate(item, packet, frame.shape[1], frame.shape[0]) for item in tracked]
            return {"detections": tracked, "geolocations": geolocations}
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/ai/geolocate")
def geolocate(payload: dict) -> dict:
    """Project a frozen detection using one telemetry packet and frame size."""
    try:
        return locator.locate(payload["detection"], payload["telemetry"], int(payload["image_width"]), int(payload["image_height"]))
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
