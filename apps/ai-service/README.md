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

## Windows PyTorch note

The checked-in Docker image pins the compatible CPU pair `torch 2.5.1` and
`torchvision 0.20.1`. If local inference reports
`operator torchvision::nms does not exist`, the installed wheels are mismatched.
`--detector auto` now logs this and uses the deterministic fixture detector;
`--detector yolo` still fails deliberately. To restore real local YOLO
inference, reinstall the matched pair in the same Python environment:

```powershell
python -m pip install --force-reinstall --index-url https://download.pytorch.org/whl/cpu torch==2.5.1+cpu torchvision==0.20.1+cpu
python -m pip install -r requirements.txt
```
