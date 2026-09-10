# missions (owner: Charan)

`POST /missions`, `GET /missions`, `GET /missions/:id`,
`PATCH /missions/:id/status`. Table: `missions`.
Mock fixture: `packages/contracts/mocks/mock_missions.json`.

`:id` accepts either identifier — the surrogate uuid or the external
`mission_id` (`MISSION-DEMO-1`) that every other service puts on the wire.

Creating a mission also assigns its sectors (demo steps 1–2 of Section 27):
the zone is split into `sector_count` equal strips, so a mission is never
sector-less. It starts in `created` — nothing flies until it goes `active`.

Publishes the three Section 10.6 mission events on the state-machine edges:

| from → to | event |
|---|---|
| created → active, paused → active | `mission.started` |
| active → paused | `mission.paused` |
| active/paused → completed | `mission.completed` |

Chirag's gateway starts and stops simulated drone motion on these, so an
invalid transition is rejected before anything is published.

`EventEmitter2` is in-process and `apps/realtime` is a separate process, so
`mission-realtime.publisher.ts` connects to the gateway's `/realtime` namespace
as a Socket.IO client and forwards the events. It is **off unless
`REALTIME_GATEWAY_URL` is set** — Section 1's design law means neither service
may require the other to be running — and every failure is logged, never
thrown, so a gateway that is down cannot fail a mission action. Events are
dropped rather than buffered while disconnected: a replayed `mission.started`
would restart drone motion for a mission that has since completed.

The seam is covered by `test/mission-events.e2e-spec.ts` (`npm run
demo:realtime`), which applies the gateway's own acceptance guard — the payload
it rejects, it rejects silently.

Responses are snake_case via `mission.presenter.ts`, matching
`mock_missions.json` and the frozen contract.
