# GS5 - Entrance queue

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`, switch `C` reverse only (route into P3; the exit route from P3 is not set, so `S3` stays red).
- Schedule: trains `A` (dwell 60 s), `B` (due 1 s), `C` (due 2 s), `D` (due 3 s), all booked `P3`.

## Action

1. Step until all four trains have spawned and `D` has stopped.

## Assertions

- `A` dwells at P3; `B` waits in front of `E3` on `e_swc_p3`; `C` waits in front of `H` on `e_in`; `D` waits off stage on the last approach section `e_ap4` in front of `IN`.
- `H` is red (ladder occupied by `B`); `IN` is red (inbound track occupied by `C`).
- Variant with seven trains (dwell 120 s): the trains come to rest on `e_p3`, `e_swc_p3`, `e_in`, `e_ap4`, `e_ap3`, `e_ap2`, `e_ap1`, one per section, with `AP1` and `AP3` red.

## Operations

- Spawning onto the approach, `computeAspects` for `IN`, stop targets at red signals.
