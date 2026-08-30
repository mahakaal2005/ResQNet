"""HTTP surface for POST /ai/geolocate (role doc Section 7 "APIs exposed").

Thin wrapper -- all real logic lives in projection.py, which stays
importable and testable with zero web-framework dependency.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .projection import PixelCentroid, ProjectionError, Telemetry, project_to_ground

app = FastAPI(title="ResQNet AI Service - Geolocation")


class GeolocateRequest(BaseModel):
    detection_id: str
    centroid: dict  # {"x": float, "y": float}
    drone_id: str
    lat: float
    lon: float
    altitude_m: float
    heading_deg: float
    gimbal_pitch_deg: float


class GeolocateResponse(BaseModel):
    detection_id: str
    latitude: float
    longitude: float
    error_m: float
    method: str


@app.post("/ai/geolocate", response_model=GeolocateResponse)
def geolocate(req: GeolocateRequest) -> GeolocateResponse:
    telemetry = Telemetry(
        latitude=req.lat,
        longitude=req.lon,
        altitude_m=req.altitude_m,
        heading_deg=req.heading_deg,
        gimbal_pitch_deg=req.gimbal_pitch_deg,
    )
    centroid = PixelCentroid(x=req.centroid["x"], y=req.centroid["y"])

    try:
        result = project_to_ground(centroid, telemetry)
    except ProjectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return GeolocateResponse(
        detection_id=req.detection_id,
        latitude=result.latitude,
        longitude=result.longitude,
        error_m=result.error_m,
        method=result.method,
    )
