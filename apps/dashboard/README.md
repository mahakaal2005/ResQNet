# apps/dashboard (owner: Ayush)

React/Next.js command dashboard: map, incident UI, drone status, priority
breakdown, audit log, WebRTC UI, offline-state indicator.

All backend/AI calls go through an interface layer (never call REST/WS
directly from a component) so `mockApi/*.json` can be swapped for real
endpoints with zero component-code changes.

Build `mockApi/` from the shared contracts on Day 1 — never wait on a real
backend to start UI work (Section 15, Section 23).

Never modify: `apps/api/**`, `apps/realtime/**`, `apps/ai-service/**`, `apps/simulator/**`.
