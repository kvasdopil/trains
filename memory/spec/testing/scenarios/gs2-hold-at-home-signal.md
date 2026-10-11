# GS2 - Hold at platform entry light

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`, switches `C` and `E` reverse (route set to P3).
- Schedule: train `A` due at 0 s with a 20 s dwell; train `B` due at 1 s. Both booked `P3`.

## Action

1. Step until `A` is dwelling at P3.
2. Step until `B` has stopped (speed 0) on `e_swc_p3`, in front of entry light `E3`.
3. Attempt to toggle switch `C`.
4. Step until `A` has left and `B` is moving again, then until the shift finishes.

## Assertions

- While `A` dwells, `E3` is red (platform occupied) and `S3` is green (exit route set and clear), and with the ladder free `H` is yellow.
- `B` passes `H` at yellow, stops on `e_swc_p3`, and never enters `e_p3` while `A` is there.
- With `B` in the ladder, `C` is locked (toggle refused) and `H` is red.
- After `A` departs and clears P3, `E3` clears, `B` proceeds, and both trains are scored at `P3`.

## Operations

- `computeAspects`, `Simulation.findStopTarget`, `Simulation.toggleSwitch`, route locking.
