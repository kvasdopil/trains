# GS6 - Diamond crossing

Status: Active (2026-10-11)

## Setup

- Seed: `S1 Central Station`.
- Schedule: `A` booked `P2`/`S` (dwell 1 s), `B` a through train booked `T`/`N` due at 6 s.
- Switches: `A`, `G`, `J` reverse; `K`, `L` normal so both diagonals are selected but both exits are set against them.

## Action

1. Step until `A` stands at P2 and switch `A` is free; throw `A` back to normal for `B`.
2. Step until `A` stands at `O1` and `B` at `O2`, both red.
3. Throw `L` and `K` reverse in the same instant, then step until the shift finishes.

## Assertions

- Before step 3 both exit signals are red (their diagonals are set against at K/L).
- After step 3 at most one train is ever on the four diamond edges at the same time, and the other train waits with speed 0 while the first crosses.
- `A` leaves by `S` and `B` by `N`, both with `correctExit` true.

## Operations

- `routeAhead` conflicts, `computeAspects`, immediate aspect refresh in `crossEdgeBoundaries`.
