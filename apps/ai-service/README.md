# apps/ai-service — Detection (Faiqua) + Tracking/Geolocation (Atul)

| Folder | Owner |
|---|---|
| `src/detection/**`, `src/training/**`, `models/**` | Faiqua |
| `src/tracking/**`, `src/geolocation/**`, `validation/**` | Atul |

Never edit the other person's folder. Both consume fixtures from
`apps/simulator/sample_frames/` and `apps/simulator/sample_telemetry.json` —
never block on the live simulator.
