# EP-001 - Station dispatcher core

Status: Active (2026-10-11)

## Goal

Deliver a playable single-station dispatcher game: trains arrive, the player throws switches, automatic signals keep trains apart, and the shift is scored.

## Scope

- In scope: one station layout, switches, three-aspect signals with route locking, timetable, dwell, scoring, HUD, through trains on a centre through line.
- Out of scope: bidirectional running, manual signal control, multiple stations, persistence.

## Features

- [FT-0001 Station outline, signals and routing](features/FT-0001-station-outline-signals-routing/index.md): Station view with switches and lights plus incoming trains routed to platforms. Read this for the delivered slice and its acceptance criteria.
- [FT-0002 Through line and through trains](features/FT-0002-through-trains/index.md): Centre through line and non-stopping trains. Read this for the second slice.
- [FT-0003 Entrance and exit signals, arrival lane](features/FT-0003-entrance-exit-signals-and-arrival-lane/index.md): Entrance queue and arrival visualisation. Read this for the third slice.
- [FT-0004 Two exits and a diamond crossing](features/FT-0004-two-exits-and-diamond/index.md): Booked exits and the crossover conflict. Read this for the fourth slice.
- Feature catalog: [features/index.md](features/index.md).

## Dependencies

- [Domain specs](../../../spec/domain/index.md) define every rule implemented here.

## Risks

- Players may not understand that trailing switches must be set for departures; mitigated by the help text and red starters.
- Timetable pressure may be too low or too high; tune `generateSchedule` gaps after playtesting.

## Definition of done

- All features in the catalog delivered with passing `yarn lint:full`.
- Specs, scenarios, and ADRs updated.
