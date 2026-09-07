# Priority Score — Weights & Formula

Owner: Rudra. This is the single source of truth for the transparent priority
engine (PRD §5.4). The dashboard (Ayush) renders this breakdown verbatim and
never recomputes it client-side.

Score is additive, always returned with its breakdown:

| Factor | Cap | Input |
|---|---|---|
| `people_count` | 30 | `min(peopleCount * 10, 30)` |
| `isolation` | 20 | `isolationScore (0–1) * 20` |
| `time_factor` | 20 | `min(minutesSinceLastMovement / 60, 1) * 20` |
| `distress_flag` | 20 | `20` if true, else `0` |

`total = people_count + isolation + time_factor + distress_flag` (max 90).

## Input sourcing (Phase 1)

- **`peopleCount`** — `incident.survivor_count_estimate`, incremented when a
  new drone independently confirms the same incident (see dedup).
- **`isolationScore`** — Phase 1 has no road/access-point dataset, so this is
  a fixed placeholder (`0.5`) until a real geo-isolation lookup is wired in.
  Documented here so it's an explicit, disclosed simplification, not a hidden
  one.
- **`minutesSinceLastMovement`** — elapsed minutes between `first_seen` and
  `last_seen` on the incident.
- **`distress_flag`** — operator-entered via `PATCH /incidents/:id/status`,
  defaults to `false` at creation.

## Worked example

```
people_count       +30
isolation           +20
time_factor          +17
distress_flag       +20
--------------------
total                87
```

Implementation: [`apps/api/src/priority/priority-engine.ts`](../../apps/api/src/priority/priority-engine.ts).
