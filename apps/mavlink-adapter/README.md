# MAVLink adapter fleet

One process is one PX4 SITL vehicle. At startup it reads exactly one JSON config, connects to its configured MAVLink UDP port, registers the configured drone ID, and runs that file's explicit mission route. It emits a schema-validated combined telemetry packet at 1 Hz to the ResQNet realtime gateway.

Start PX4's four instances as described in [the SITL guide](docs/px4-sitl-setup.md), then start the adapters:

```sh
pip install -r requirements.txt
python main.py config/drone-01.json
python main.py config/drone-02.json
python main.py config/drone-03.json
python main.py config/drone-04.json
```

Alternatively, Linux host networking can run all four as isolated containers:

```sh
docker compose up --build
```

The routes in `config/` are intentionally separate waypoint lists, rather than a generated offset pattern. `DRONE-01` through `DRONE-04` use MAVLink ports 14540–14543 and sectors A–D respectively.

## Safety boundary

`adapter/autonomous_mission.py` is the sole startup-only code path that calls `arm`, `takeoff`, `upload_mission`, or `start_mission`. It receives only the local configuration and is not imported by the Socket.IO command handler. The dashboard handler has an exact, case-sensitive allowlist: `pause`, `resume`, and `return_home` only. Any other value produces a `drone.command.ack` with `status: "rejected"` and never reaches MAVSDK.

`frame_ref` remains `mavsdk:no-camera` until a camera adapter exists.
