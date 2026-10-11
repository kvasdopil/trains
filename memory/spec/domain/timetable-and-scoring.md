# Timetable and Scoring

Status: Active (2026-10-11)

A shift is a deterministic list of scheduled trains. Money rewards routing each train to its booked platform and exit on time.

Related documents:

- [Train movement](train-movement.md): Dwell and exit rules that determine when a train pays and is settled.
- [Game overview](../project/overview.md): Product framing for shifts and scoring.

## Scheduled train

- `id` (display name), `at` (shift second it is due on the entry track), `destination` (a platform id for a stopping train, or a through-track id for a through train), `exit` (the exit the train must leave by, chosen at random among the layout's exits), `length` (90–140 units), `dwell` (seconds at the platform; 0 for through trains).
- Dwell depends on length: `round(dwellBase + dwellPerUnit · length)` with defaults 4 s + 0.06 s per unit, so a 90-unit train dwells 9 s and a 140-unit train 12 s. Longer trains take longer to unload and load.
- Service prefixes hint at the kind: `RE`, `S`, `RB` stop; `IC`, `EC`, `ICE` run through; expresses are named `X` plus three digits with no space (`X123`).
- `express` (optional, through trains only): an express always runs through, always leaves by the South exit (`expressExit: 'S'` in the game; random when the option is omitted), runs much faster (top speed 240 vs 110, harder acceleration and braking), and is worth three times the money (see Money).

## Shift generation

- `generateSchedule({ seed, count, platforms, throughTracks, throughShare })` uses a mulberry32 PRNG so a seed always yields the same shift. By default 30% of trains are through trains when a through track exists, and 30% of through trains (`expressShare`) are expresses, up to at most 2 per shift (`maxExpress`); later would-be expresses run as ordinary through trains.
- Defaults: first train at 4 s, gaps of 13–21 s between arrivals, and with 35% probability the next train is **bunched** 9–12 s behind the previous one, so two or three trains are routinely inside the station together while the dispatcher always has at least 9 s between arrivals to throw the switches. Stopping trains dwell 9–12 s depending on length. The game runs 14 trains per shift.
- **Platform clearance**: two stopping trains are never booked for the same platform less than `platformGap` (default 30 s) apart, so a train never arrives while the previous one is still standing there. Only platforms that are clear by the arrival time are eligible; if none is, the arrival is pushed later to the first clear platform. Bunched arrivals therefore always target different platforms (or the through line).
- The simulation step and scheduling are deterministic; restarting with the same seed replays the same shift.

## Spawning

- A due train spawns onto the first approach section only when that section is neither occupied nor route-locked. Up to four trains can queue physically on the approach; beyond that, trains wait in the timetable (shown as "waiting") and their lateness accumulates.
- Trains spawn in timetable order.

## Money

There is no score: the dispatcher runs a cash balance (`Simulation.money`, starting at `$0`, may go negative). Every change is a single coin event (`kind: 'money'`, with `train`, `amount`, `reason`) that originates from a train, so the renderer can show where it came from.

- **Unloading** (`unload`, from a random point along the train body): a stopping train pays its fare coin by coin, evenly spread across its dwell. At the booked platform it pays `10 × $10`; at a wrong platform half as many coins, `5 × $10`.
- **Running through** (`through`, from the train body): a through train pays `10 × $10` as its head runs along the first through or platform track it enters (between the platform-bar margins), whichever route it took.
- **Missed stop** (`missed-stop`, from the exit point): a stopping train sent down the through line never unloads; its passengers are compensated the full fare, `10 × -$10`. Nothing is charged while it runs through; the refund is paid as it leaves, like a wrong exit.
- **Wrong exit** (`wrong-exit`, from the exit point at the far end of the exit track; the event carries `exit`): when a train leaves by an exit other than its booked one, its passengers are compensated the full fare, `10 × -$10`, paid as it crosses the exit point.
- **Refund timing**: all refund coins a train owes are paid evenly while it crosses the exit point, from the head reaching it until the tail clears it (the last coin falls as it leaves). Missed-stop coins come first, then wrong-exit coins.
- Penalties stack: a stopping train that misses its stop and also leaves by the wrong exit refunds the fare twice (`-$200`, 20 coins as it crosses the exit point).
- **Lateness** (`late`, from the train head): `deadline = at + nominalTrip (30 s) + dwell`. Every whole second past `deadline + 8 s` grace while the train is on the layout costs `-$2`. Seconds a train spent waiting in the timetable before spawning are charged in a burst when it spawns.
- **Express**: every coin an express earns or costs is tripled (`EXPRESS_MULTIPLIER`): `10 × $30` for running through, `10 × -$30` for a wrong exit, and `-$6` per late second. It has no grace: lateness is charged from the first second past `deadline`. An express is also late the moment it is held up: as soon as it has to brake for a red signal or an unset route (or stands at one), it is charged `-$6` at once and again every further second it stays held. Planned slowdowns (the platform-track speed limit, accelerating from a stop) are not charged. The charge is the larger of the two counts, so a held, overdue express is not charged twice for the same second.

When a train leaves, its result records whether it was **correct** (a stopping train stopped at its booked platform; a through train never stopped), **correctExit**, `delaySeconds = max(0, exitTime - deadline)`, and `earned`, the net money from all its coin events.

The shift ends when every scheduled train has left; the overlay shows the final balance, correct-route count, and late count.
