# Priority score weights (owner: Rudra)

Transparent additive score, always returned with its breakdown. Fill in caps
and exact weight table here as the priority engine is implemented — Ayush
renders this breakdown verbatim in the UI and never recomputes it client-side.

Example from the PRD:
```
people_count     +30
isolation         +20
time_factor       +17
distress_flag     +20
-----------------------
total              87
```
