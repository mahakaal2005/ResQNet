# PX4 four-vehicle SITL setup

PX4-Autopilot is an external dependency: clone it outside this repository and complete PX4's host prerequisites first.

From the PX4-Autopilot checkout, start four independent classic-Gazebo vehicles:

```sh
./Tools/simulation/gazebo-classic/sitl_multiple_run.sh -n 4
```

The MAVSDK endpoints are `udp://:14540`, `udp://:14541`, `udp://:14542`, and `udp://:14543` for instances 0–3 respectively. Confirm each vehicle independently by starting its matching adapter process after the realtime gateway is available:

```sh
python main.py config/drone-01.json
python main.py config/drone-02.json
python main.py config/drone-03.json
python main.py config/drone-04.json
```

Each process logs `PX4 SITL connected` before it registers its own drone ID and starts its configured startup mission. If a port is unreachable, only that process should fail to connect; check the instance number and corresponding `mavlink_port` in the JSON file.

For containers on Linux, run the four adapters with host networking after starting PX4 and the gateway on the host:

```sh
docker compose -f apps/mavlink-adapter/docker-compose.yml up --build
```

`network_mode: host` is intentional: it lets each container receive the host's distinct UDP MAVLink stream. It is not supported by Docker Desktop in the same way; use the four host Python processes there.

GPS loss can be exercised on one PX4 shell with `param set SIM_GPS_BLOCK 1` (or `failure gps off` where supported). The adapter continues running and emits `gps_healthy: false`; it never invents a replacement coordinate.
