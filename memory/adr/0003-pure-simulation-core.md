# ADR 0003 - Pure simulation core

Status: Active (2026-10-11)

## Decision

All gameplay rules live in `src/core`, which has no DOM, PixiJS, or timer dependencies and advances only through `Simulation.step(dt)` with a fixed timestep driven by the composition root.

## Why

- Interlocking logic (signal aspects, route locks, switch locking, stop targets) is the part most likely to hide bugs; it must be unit-testable in milliseconds without a browser.
- A fixed timestep plus a seeded timetable makes every shift reproducible, which simplifies bug reports and future replays.
- Rendering can be swapped (for example to a different engine or a headless test harness) without touching the rules.

## Trade-offs

- Derived state (aspects, occupancy, locks) is recomputed every step rather than incrementally; this is cheap at the current layout size but would need caching for very large stations.
