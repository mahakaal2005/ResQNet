# ResQNet

ResQNet is an SIH disaster-response prototype that turns drone observations into actionable rescue information. It combines simulated multi-drone telemetry, person detection, tracking, geolocation, incident prioritisation, realtime updates, a command dashboard, and a browser-based voice demo.

It is a **human-supervised decision-support system**: detections are evidence for responders to verify, not autonomous rescue or flight-control decisions.

## What the MVP demonstrates

1. A simulator assigns three drones to search sectors and streams telemetry.
2. The Python AI service detects people in RGB frames with the checked-in YOLO model (with a deterministic colour-detector fallback for fixtures).
3. Detections are tracked, projected to geographic coordinates, and sent to the API in detection-then-geolocation order.
4. The API stores incidents, avoids duplicate records, calculates an explainable priority score, and records audit events.
5. The Next.js command dashboard shows a live OpenStreetMap view, drone positions, incidents, evidence, priority breakdowns, and audit history.
6. WebRTC voice uses the realtime gateway for signalling; coturn is included for NAT-restricted demo networks.

## Architecture

```text
Simulator / drone telemetry ──> Realtime gateway ──> Dashboard
          │                                      │
          └─> AI service (YOLO → tracking → geo) └─> API + PostGIS
                                                        │
                                                        └─> incidents, priority, audit
```

| Component | Location | Default port | Role |
| --- | --- | ---: | --- |
| Dashboard | `apps/dashboard` | 3001 | Operator command interface and map |
| API | `apps/api` | 3000 | Auth, missions, incidents, priority and audit APIs |
| Realtime gateway | `apps/realtime` | 4000 | Socket.IO telemetry and voice signalling |
| Simulator | `apps/simulator` | — | Three-drone sector/telemetry simulation |
| AI service | `apps/ai-service` | 8001 | YOLO detection, tracking and geolocation |
| PostgreSQL/PostGIS | `database` | 5432 | Spatial incident data |
| TURN relay | `coturn` | 3478 TCP/UDP | WebRTC relay for restrictive networks |

## Quick start — full demo

Prerequisites: Docker Desktop with Compose enabled.

```powershell
docker compose up --build
```

Then open [http://localhost:3001](http://localhost:3001). The Docker build sets the dashboard data source to `live`, so it connects to the API and realtime gateway. Use `Ctrl+C` to stop the foreground stack, or add `-d` to run it in the background.

Useful commands:

```powershell
# Check service status and logs
docker compose ps
docker compose logs -f dashboard api realtime ai-service

# Re-run the idempotent demo seed data
docker compose run --rm seed

# Stop containers (keeps database data)
docker compose down
```

## Local development

Install the Node workspaces for dashboard, realtime gateway, and simulator:

```powershell
npm install --workspaces --include-workspace-root
npm run dev:realtime
npm run dev:simulator
npm run dev:dashboard
```

Run the AI service separately:

```powershell
cd apps/ai-service
python -m pip install -r requirements.txt
uvicorn src.detection.app:app --app-dir src/detection --port 8001
```

The dashboard uses fixture data by default in local development. Set `NEXT_PUBLIC_DATA_SOURCE=live`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_REALTIME_URL` before starting it to use live services.

## Validation

```powershell
# AI detector, tracking, and geolocation tests
python -m unittest discover -s apps/ai-service/tests -v

# Node workspace tests and production build
npm run test --workspaces
npm run build --workspaces

# Validate the full Compose configuration
docker compose config --quiet
```

Detection metrics from the held-out VisDrone validation split are in [`apps/ai-service/validation_results.json`](apps/ai-service/validation_results.json). They are prototype evaluation results, not a claim of field-ready accuracy.

## Current MVP boundaries

- RGB detection is implemented; thermal/RGB fusion is a future enhancement.
- The repository demonstrates simulated drones. Physical flight control, geofencing, hardware telemetry, battery testing, and regulatory approval require authorised real-world testing.
- TURN configuration is included, but voice reliability and latency must be tested on two devices and a restrictive network such as guest Wi-Fi or a phone hotspot.
- The system supports responders; human confirmation remains required for rescue priority and safety-critical decisions.

## Repository guide

- `apps/ai-service` — detection, tracking, geolocation, and model evaluation
- `apps/api` — NestJS backend and incident intelligence
- `apps/dashboard` — Next.js command dashboard
- `apps/realtime` — Socket.IO gateway and telemetry validation
- `apps/simulator` — sector-based multi-drone simulator and fixtures
- `database` — PostGIS migrations and seed script
- `packages/contracts` — frozen telemetry contract
- `docs` — API, architecture, and model documentation

This README reflects the SIH PRD goals while clearly separating the simulated MVP from work that requires hardware and authorised field testing.
