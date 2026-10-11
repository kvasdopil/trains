# GS4 - Through train

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`, all switches `normal` (through route set).
- Schedule: one through train `IC 9`, due at 0 s, booked `T`, dwell 0.

## Action

1. Step until the shift finishes.
2. Variant: toggle `C` and `E` first so the train runs through P3, and record its top speed on `e_p3`.

## Assertions

- Default route: the train passes `T` without stopping, `viaThrough` is true, no `stopped` event, `correct` is true, points `+100`, and it leaves within 16 s.
- Via P3: no `stopped` event, a `passing` event for `P3` marked correct, `correct` is true, points `+100`, and its speed on `e_p3` never exceeds 45% of maximum.

## Operations

- `Simulation.findStopTarget` (no platform stop for through trains), `Simulation.speedLimit`, `noteTrackEntered`, scoring.
