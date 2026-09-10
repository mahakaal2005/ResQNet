# geolocation (owner: Atul)
POST /ai/geolocate + CLI (python geolocate.py --telemetry ... --detections ...)
Input: Detection (Faiqua) + matching Telemetry (Chirag: altitude, gimbal_pitch,
heading, GPS). Output contract: Geolocation Result (Section 10.3), co-signed
with Rudra. Score error_m against apps/simulator/ground_truth.json.
