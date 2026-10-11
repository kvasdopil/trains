# FT-0003 - Entrance and exit signals, arrival lane

Status: Delivered (2026-10-11)

## User value

The dispatcher can see how soon each train arrives and watch trains stack up at the station entrance when the station is blocked, instead of trains popping onto the inbound track from nowhere.

## Deliverables

- Layout: four off-stage approach sections `e_ap1`..`e_ap4` with block signals `AP1`..`AP3` and entrance signal `IN`; edge `e_swf_x` after switch F with exit signal `OUT` (`src/core/layouts/central-station.ts`).
- Core: trains spawn onto the first approach section and queue one per section behind the block signals; `OUT` protects the outbound track; nominal trip raised to 30 s.
- Game: arrival lane whose lower band mirrors the approach sections (pills at real train positions, block-signal dots) and whose upper band slides pending pills down over the last 90 s before arrival (`src/game/renderer.ts`).
- Tests: entrance/exit signal routes and aspects, GS5.

## Context

- [Signals and blocks](../../../../../spec/domain/signals-and-blocks.md): `IN` and `OUT` definitions.
- [Train movement](../../../../../spec/domain/train-movement.md): Spawning on the approach.
- [Station view](../../../../../spec/ui/station-view.md): Arrival lane behaviour.

## Acceptance

### Setup

- Seed: `S1 Central Station`.

### Action

1. Run GS1–GS5 as unit tests.
2. Open the app and block the station; watch pills slide down and queue at `IN`.

### Assert

- [GS5](../../../../../spec/testing/scenarios/gs5-entrance-queue.md) passes along with GS1–GS4.
- `yarn lint:full` and `yarn build` succeed.

## Tests

- Unit: `src/core/__tests__/signals.test.ts`, `simulation.test.ts`.
- Manual: browser smoke test.

## Docs updates

- Signals, track graph, train movement, timetable, station view, seed S1, scenario index.
