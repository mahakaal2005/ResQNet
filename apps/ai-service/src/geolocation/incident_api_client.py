"""Minimal client for Rudra's incident-intake API. Stdlib only (urllib) --
deliberately no new dependency for what's a thin HTTP POST wrapper.

Per docs/contracts/geolocation-result.md: "Rejected with 404 Not Found if no
matching detection was ingested first" -- so a Detection must always be
posted before its Geolocation Result.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass


class IncidentApiError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"Incident API returned {status}: {body}")
        self.status = status
        self.body = body


@dataclass
class DetectionPayload:
    detection_id: str
    drone_id: str
    sector_id: str
    timestamp: str
    bbox: dict
    confidence: float
    centroid: dict


@dataclass
class GeolocationResultPayload:
    detection_id: str
    latitude: float
    longitude: float
    error_m: float
    method: str


class IncidentApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def post_detection(self, detection: DetectionPayload) -> dict:
        return self._post("/detections", asdict(detection))

    def post_geolocation(self, result: GeolocationResultPayload) -> dict:
        return self._post("/geolocations", asdict(result))

    def get_incidents(self) -> list[dict]:
        return self._get("/incidents")

    def _post(self, path: str, payload: dict) -> dict:
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        return self._send(req)

    def _get(self, path: str) -> list[dict]:
        req = urllib.request.Request(f"{self.base_url}{path}", method="GET")
        return self._send(req)

    @staticmethod
    def _send(req: urllib.request.Request):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8")
            raise IncidentApiError(exc.code, body) from exc
