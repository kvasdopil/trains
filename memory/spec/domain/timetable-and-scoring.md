# Timetable and Scoring

Status: Active (2026-10-11)

A shift is a deterministic list of scheduled trains. The score rewards routing each train to its booked platform on time.

Related documents:

- [Train movement](train-movement.md): Dwell and exit rules that determine when a train is scored.
- [Game overview](../project/overview.md): Product framing for shifts and scoring.

## Scheduled train

- `id` (display name), `at` (shift second it is due on the entry track), `destination` (a platform id for a stopping train, or a through-track id for a through train), `exit` (the exit the train must leave by, chosen at random among the layout's exits), `length` (90–140 units), `dwell` (seconds at the platform; 0 for through trains).
- Dwell depends on length: `round(dwellBase + dwellPerUnit · length)` with defaults 4 s + 0.06 s per unit, so a 90-unit train dwells 9 s and a 140-unit train 12 s. Longer trains take longer to unload and load.
- Service prefixes hint at the kind: `RE`, `S`, `RB` stop; `IC`, `EC`, `ICE` run through.

## Shift generation

- `generateSchedule({ seed, count, platforms, throughTracks, throughShare })` uses a mulberry32 PRNG so a seed always yields the same shift. By default 30% of trains are through trains when a through track exists.
- Defaults: first train at 4 s, gaps of 13–21 s between arrivals, and with 35% probability the next train is **bunched** 9–12 s behind the previous one, so two or three trains are routinely inside the station together while the dispatcher always has at least 9 s between arrivals to throw the switches. Stopping trains dwell 9–12 s depending on length. The game runs 14 trains per shift.
- **Platform clearance**: two stopping trains are never booked for the same platform less than `platformGap` (default 30 s) apart, so a train never arrives while the previous one is still standing there. Only platforms that are clear by the arrival time are eligible; if none is, the arrival is pushed later to the first clear platform. Bunched arrivals therefore always target different platforms (or the through line).
- The simulation step and scheduling are deterministic; restarting with the same seed replays the same shift.

## Spawning

- A due train spawns onto the first approach section only when that section is neither occupied nor route-locked. Up to four trains can queue physically on the approach; beyond that, trains wait in the timetable (shown as "waiting") and their lateness accumulates.
- Trains spawn in timetable order.

## Scoring

When a train leaves the layout:

- `expectedExit = at + nominalTrip (30 s) + dwell`
- `delay = max(0, exitTime - expectedExit)`
- A stopping train is **correct** when the platform it stopped at equals its booked platform. A through train is correct whenever it never stopped, whichever route it took: the through line is the fast route, but any platform track is allowed. A stopping train sent down the through line misses its stop and is incorrect.
- A train that leaves by an exit other than its booked one is **wrong exit**.
- Points = `+100` if correct, otherwise `-50`; `-50` more for a wrong exit; minus `2` per whole second of delay beyond an `8 s` grace.
- The shift ends when every scheduled train has left; the HUD shows the final score, correct-platform count, and late count.
