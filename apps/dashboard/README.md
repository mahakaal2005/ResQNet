# ResQNet command dashboard

```powershell
npm install --workspaces --include-workspace-root
npm run dev:dashboard
```

The default data source is `public/mockApi`, so the command UI runs with no
other service. Set `NEXT_PUBLIC_DATA_SOURCE=live`, `NEXT_PUBLIC_API_URL`, and
`NEXT_PUBLIC_REALTIME_URL` to use API and gateway data without changing a
component. All reads and realtime actions are in `lib/data-source.ts`.

Voice uses browser WebRTC with Socket.IO only as SDP/ICE signalling. Open two
live dashboard tabs, permit microphone access, and press **Connect survivor
voice** in one tab; the other tab acts as the simulated survivor endpoint.
If signalling or microphone access fails, the UI shows the radio/phone
fallback. NAT-restricted deployments need a TURN server in addition to the
public STUN entry. `docker compose up turn` starts the local coturn relay; set
`NEXT_PUBLIC_TURN_HOST` to the relay's externally reachable hostname (it
defaults to `localhost`). Test relay behaviour over a genuinely restrictive
network such as guest Wi-Fi or a phone hotspot—localhost usually uses a direct
or STUN path and does not exercise TURN.
