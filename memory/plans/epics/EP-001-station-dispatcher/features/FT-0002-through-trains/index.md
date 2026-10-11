# FT-0002 - Through line and through trains

Status: Delivered (2026-10-11)

## User value

Express trains that must not stop add a second kind of routing problem: the dispatcher has to keep the centre line clear for them while still parking stopping trains on the platforms.

## Deliverables

- Layout: platform 4 removed; the centre track became through line `T` with incoming light `T1` and outgoing light `T2` (`src/core/layouts/central-station.ts`).
- Core: `ThroughTrack` in the layout, `destination` on scheduled trains, non-stopping movement with a platform speed limit, `viaThrough` tracking, `passing` events, and correctness rules for both kinds: a through train is correct on any route as long as it never stops (`src/core`).
- Timetable: `generateSchedule` books a share of trains for the through line with dwell 0 and express service names.
- UI: violet through-line label and badge, violet queue pills and train labels, log lines for through passes and wrong-track passes, help text.
- Tests: GS1 variants, GS4, schedule determinism test.

## Context

- [Track graph](../../../../../spec/domain/track-graph.md): Through track element and destinations.
- [Train movement](../../../../../spec/domain/train-movement.md): Through-train stop and speed rules.
- [Timetable and scoring](../../../../../spec/domain/timetable-and-scoring.md): Through share and correctness rules.
- [Seed S1](../../../../../spec/testing/seeds/s1-central-station.md): New track and signal ids.

## Acceptance

### Setup

- Seed: `S1 Central Station`.

### Action

1. Run GS1, GS2, GS3, GS4 as unit tests.
2. Open the app, route a through train down the centre and a stopping train to a platform.

### Assert

- [GS4](../../../../../spec/testing/scenarios/gs4-through-train.md) passes along with GS1–GS3.
- `yarn lint:full` and `yarn build` succeed.

## Tests

- Unit: `src/core/__tests__/simulation.test.ts`, `signals.test.ts`, `graph.test.ts`, `schedule.test.ts`.
- Manual: browser smoke test.

## Docs updates

- Overview, track graph, train movement, timetable and scoring, signals, UI specs, seed S1, scenarios GS1–GS4, roadmap.
