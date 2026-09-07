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
