# GS3 - Switch locking

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`, all switches `normal`.
- Schedule: one train due at 0 s, booked `P3`, length 100; switches `C` and `E` thrown before it arrives.

## Action

1. Step until the train's head is on `e_swa_swc` (between switches A and C).
2. Attempt to toggle switch `A`.
3. Step until the train is dwelling at P3.

## Assertions

- While on `e_swa_swc`: `A` and `C` are locked, the toggle of `A` is refused with a `switch-locked` event, and `B` (off the route) is free.
- Once dwelling at P3: `A` and `C` are free again, and `E` is not yet locked because the train has not passed its starter.
- With only `C` thrown (so `E` is set against P3), the train stops on `e_p3` with speed 0 and `S3` red, and never proceeds.

## Operations

- `Simulation.isSwitchLocked`, route locking in `crossEdgeBoundaries`, lock release in `Train.prune`.
