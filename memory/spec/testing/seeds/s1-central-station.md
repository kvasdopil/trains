# Seed S1 - Central Station

Status: Active (2026-10-11)

## Purpose

The layout exported from `src/core/layouts/central-station.ts`. Tests construct a `Simulation` from it with a hand-written schedule.

## Layout

```text
                       ┌─ B ── P1 (e_p1) ──┐
 (approach) IN ─ H ─ A ┤                   D ── G ──╮╭── K ── N ▶
                       │      P2 (e_p2) ───┘        ╳ X
                       └─ C ── T  (e_t) ── E ── J ──╯╰── L ── S ▶
                              P3 (e_p3) ──┘
```

- Approach sections `e_ap1`..`e_ap4` (x −690→30, 180 units each, off stage) with block signals `AP1`..`AP3` between them and entrance signal `IN` at the end of `e_ap4`; inbound edge `e_in` (x 30→180) with home signal `H` at its end.
- Facing switches: `A` (normal → C, reverse → B), `B` (normal → P2, reverse → P1), `C` (normal → T, reverse → P3).
- Platforms `e_p1`, `e_p2`, `e_p3` and through line `e_t`, all 400 units long. Incoming lights `E1`, `E2`, `E3`, `T1` at their west ends; outgoing lights `S1`, `S2`, `S3`, `T2` at their east ends.
- Trailing switches: `D` (normal ← P2, reverse ← P1), `E` (normal ← T, reverse ← P3).
- Exit signals `O1` (end of `e_swd_swg`) and `O2` (end of `e_swe_swj`).
- Crossover: `G` (upper, normal → straight `e_swg_swk`, reverse → diagonal `e_swg_x`), `J` (lower, normal → straight `e_swj_swl`, reverse → diagonal `e_swj_x`), diamond `X` at `n_x` pairing `e_swg_x → e_x_swl` and `e_swj_x → e_x_swk`, trailing `K` (normal ← straight, reverse ← diagonal from J) and `L` (normal ← straight, reverse ← diagonal from G).
- Exits `N` (`e_out_n`, y 220) and `S` (`e_out_s`, y 300).

## Handles

- Default route with all switches `normal`: `AP1 → AP2 → AP3 → IN → H → A → C → T → E → J → L → S` (through line to the south exit).
- Route to P1: `A`, `B`, `D` reverse. Route to P2: `A` reverse. Route to P3: `C`, `E` reverse.
- Exits from the upper group (P1, P2): `N` with `G`, `K` normal; `S` with `G`, `L` reverse. From the lower group (T, P3): `S` with `J`, `L` normal; `N` with `J`, `K` reverse.
