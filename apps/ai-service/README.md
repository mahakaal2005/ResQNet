# ResQNet AI service

The service has one frozen pipeline: detection -> stable per-drone tracking ->
flat-ground geolocation. It runs independently against simulator fixtures or
can POST results to the API in the required detection-then-geolocation order.

## Independent verification

```powershell
cd apps/ai-service
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python src/pipeline.py --telemetry ../simulator/sample_telemetry.json --frames ../simulator/sample_frames --output predictions.json
python src/geolocation/evaluate.py predictions.json ../simulator/ground_truth.json
uvicorn src.detection.app:app --app-dir src/detection --port 8000
```

`POST /ai/detect` returns the frozen Detection payload. `POST /ai/geolocate`
returns the frozen Geolocation Result. `POST /ai/process` accepts multipart
`image` plus a JSON-string `telemetry` field and returns both arrays after
tracking; it is useful for a single-frame live adapter.

To feed a running API from fixtures:

```powershell
python src/pipeline.py --telemetry ../simulator/sample_telemetry.json --frames ../simulator/sample_frames --api-url http://localhost:3000
```

By default, the service loads the checked-in fine-tuned YOLO weights at
`models/resqnet-person-v1.pt`; set `RESQNET_DETECTOR=color` to force the
deterministic high-visibility fallback used by synthetic fixture tests. The
CLI has the equivalent `--detector auto|yolo|color` option. Evaluation results
for the held-out VisDrone split are recorded in `validation_results.json`.
