# FT-0001 - Station outline, signals and routing

Status: Delivered (2026-10-11)

## User value

The player sees a schematic station, throws switches, and routes timetabled trains to their booked platforms while automatic red/yellow/green signals prevent conflicts.

## Deliverables

- Core: track graph, switch resolution, three-aspect aspects with route locking, train kinematics with stop targets and dwell, seeded timetable, scoring (`src/core`).
- Layout: Central Station with 4 platforms, 6 switches, 9 signals: home, four incoming, four outgoing (`src/core/layouts/central-station.ts`).
- Game: PixiJS schematic renderer with clickable switches and an upcoming-train queue above the inbound track (`src/game/renderer.ts`).
- UI: HUD with clock, score, speed/pause/restart, timetable, log, end-of-shift overlay (`src/ui/hud.ts`, `index.html`, `src/style.css`).
- Tests: graph, signals, and simulation unit tests (`src/core/__tests__`).

## Context

- [Track graph](../../../../../spec/domain/track-graph.md): Graph model and next-edge rule.
- [Switches and locking](../../../../../spec/domain/switches-and-locking.md): Locking rule enforced by `toggleSwitch`.
- [Signals and blocks](../../../../../spec/domain/signals-and-blocks.md): Aspect table and route locks.
- [Train movement](../../../../../spec/domain/train-movement.md): Stop targets, kinematics, dwell.
- [Timetable and scoring](../../../../../spec/domain/timetable-and-scoring.md): Shift generation and points.
- [Station view](../../../../../spec/ui/station-view.md) and [HUD](../../../../../spec/ui/hud.md): What is drawn.

## Acceptance

### Setup

- Seed: `S1 Central Station`.

### Action

1. Run GS1, GS2, GS3 as unit tests.
2. Open the app, route a few trains, confirm switches lock and signals change as specified.

### Assert

- [GS1](../../../../../spec/testing/scenarios/gs1-route-to-booked-platform.md), [GS2](../../../../../spec/testing/scenarios/gs2-hold-at-home-signal.md), [GS3](../../../../../spec/testing/scenarios/gs3-switch-locking.md) pass.
- `yarn lint:full` and `yarn build` succeed.

## Tests

- Unit: `src/core/__tests__/graph.test.ts`, `signals.test.ts`, `simulation.test.ts`.
- Manual: browser smoke test of rendering and HUD.

## Docs updates

- Domain, UI, and testing specs created; ADRs 0001–0004 recorded.
