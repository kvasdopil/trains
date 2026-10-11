# GS1 - Route to booked platform

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`, all switches `normal`.
- Schedule: one stopping train `RE 1`, due at 0 s, booked `P3`, exit `S`, length 100, dwell 2 s.

## Action

1. Toggle switches `C` and `E` (route into and out of P3).
2. Step the simulation until it reports `finished`.

## Assertions

- The train served `P3`, `correct` is true, delay is 0, points are `+100`.
- Events occur in the order `arrival`, `stopped`, `departed`, `left` (after the two `switch` events).
- The stopped head sits at the end of the platform bar (offset 380 on `e_p3`, x = 780).
- Variant: with the switches left `normal`, the train runs down the through line, never stops, and scores `-50` with a `passing` event marked incorrect.
- Variant: booked `P1` but routed to P3, the train stops at P3 and scores `-50`.
- Variant: booked `P1`/`S`, routed to P1 with the crossover left straight: leaves by `N`, `correctExit` false, scores `+50`. With `G` and `L` reverse it crosses the diamond to `S` and scores `+100`.

## Operations

- `Simulation.toggleSwitch`, `Simulation.step`, scoring in `completeTrain`.
