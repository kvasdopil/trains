# FT-0004 - Two exits and a diamond crossing

Status: Delivered (2026-10-11)

## User value

Trains must leave by a booked exit, north or south, so the dispatcher plans the departure side as well as the platform, and the diamond crossing creates a real conflict point at the east end.

## Deliverables

- Layout: switch F replaced by a crossover: facing `G`/`J`, diamond `X`, trailing `K`/`L`, exits `N` and `S`, exit signals `O1`/`O2` (`src/core/layouts/central-station.ts`).
- Core: `Crossing` and `Exit` layout elements, crossing resolution in `nextEdge`, crossing conflicts in `routeAhead`/`computeAspects`, same-step aspect refresh on route locking, exit booking, `exitTaken`, exit scoring (`src/core`).
- Timetable: each train gets a random exit.
- UI: exit labels, `X` label, train labels and queue pills with the exit, timetable exit column, log lines, help text.
- Tests: crossing graph and signal tests, GS1 exit variants, GS6; assessment bot routes by track group and exit.

## Context

- [Track graph](../../../../../spec/domain/track-graph.md): Crossing and exit elements.
- [Signals and blocks](../../../../../spec/domain/signals-and-blocks.md): Conflicts and the same-step refresh.
- [Timetable and scoring](../../../../../spec/domain/timetable-and-scoring.md): Exit booking and penalty.
- [Seed S1](../../../../../spec/testing/seeds/s1-central-station.md): New ids and exit routes.

## Acceptance

### Setup

- Seed: `S1 Central Station`.

### Action

1. Run GS1 (exit variants) and GS6 as unit tests.
2. Open the app; route a train from P1 to the south exit and watch the diamond hold the other side.

### Assert

- [GS6](../../../../../spec/testing/scenarios/gs6-diamond-crossing.md) passes with GS1–GS5.
- `yarn lint:full` and `yarn build` succeed.

## Tests

- Unit: `graph.test.ts`, `signals.test.ts`, `simulation.test.ts`, `schedule.test.ts`.
- Manual: browser smoke test.

## Docs updates

- Overview, track graph, signals, timetable, station view, HUD, seed S1, scenarios index, GS1, GS6.
