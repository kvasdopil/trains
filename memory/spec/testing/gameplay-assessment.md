# Gameplay Assessment Harness

Status: Active (2026-10-11)

A scripted dispatcher plays many seeded shifts in fake time so gameplay pressure, waits, queues and deadlocks can be measured without a human.

Related documents:

- [Timetable and scoring](../domain/timetable-and-scoring.md): The generator the harness exercises. Read this before tuning gaps or clearance.
- [Testing index](index.md): Parent catalog for verification docs.

## How to run

```bash
yarn assess
```

Environment: `ASSESS_SHIFTS` (default 100), `ASSESS_REACTION` seconds per decision (default 1), `ASSESS_OUT` path for a JSON report, `ASSESS_DUMP=<seed>` to print the end state of an unfinished shift.

## The scripted dispatcher

- Re-plans every 0.5 s and executes one switch change at a time, each `reaction` seconds after it was decided.
- Routes the train nearest to the home signal: stopping trains always to their booked platform; through trains to the through line if free, else a free platform.
- Sets the exit route (trailing switch plus crossover) for the train furthest along each exit ladder, one ladder at a time when their crossover needs conflict.
- Holds a train's starter at red until its exit route is completely set, then releases it, so no train runs straight out of the wrong exit; this is the manual signal hold a careful player would use.
- Never looks further ahead than the nearest arriving train, which is also what the switch locking allows a human to do.

## Metrics

Per shift: finished or not (20 min cap = deadlock), duration, score, wrong routes, delays, stationary seconds by location (approach, inbound, ladder, starter), max trains in the station, max approach queue, timetable waits, decision slack (seconds between the facing route being completed and the train passing the home signal), and the share of time with a train waiting.

## Baseline (2026-10-11, 100 shifts, 14 trains, default timetable)

| Reaction | Deadlocks | Mean score | Wrong routes | Mean delay | Slack p10 / p50 | Late routes |
| -------- | --------- | ---------- | ------------ | ---------- | --------------- | ----------- |
| 0 s      | 0         | 1398       | 1            | 0.0 s      | 1.8 / 7.7 s     | 0%          |
| 1 s      | 0         | 1387       | 8            | 0.1 s      | 1.4 / 7.2 s     | 1%          |
| 3 s      | 0         | 1182       | 112          | 3.2 s      | −0.8 / 5.9 s    | 15%         |

Read: with 9–17 s gaps and 4–7 s bunches the game was comfortable at a 1 s reaction and degraded sharply at 3 s, with a median decision window of about 7 s.

## After raising the minimum gap (13–21 s, bunches 9–12 s)

| Reaction | Deadlocks | Mean score | Wrong routes | Mean delay | Slack p10 / p50 | Late routes |
| -------- | --------- | ---------- | ------------ | ---------- | --------------- | ----------- |
| 1 s      | 0         | 1400       | 0            | 0.0 s      | 5.8 / 8.1 s     | 0.2%        |
| 3 s      | 0         | 1400       | 0            | 0.0 s      | 5.6 / 6.1 s     | 1.9%        |

Read: every train is routable even with a 3 s reaction; the few late routes are absorbed by the margin before the home signal. The shift is about 50 s longer and peaks at three trains in the station instead of four.

## Two exits and the diamond (current layout)

| Reaction | Deadlocks | Mean score | Wrong tracks | Wrong exits | Mean delay | Max delay | Late routes |
| -------- | --------- | ---------- | ------------ | ----------- | ---------- | --------- | ----------- |
| 1 s      | 0         | 1400       | 0            | 0           | 0.0 s      | 9.8 s     | 0.3%        |
| 3 s      | 0         | 1399       | 0            | 0           | 0.6 s      | 17.4 s    | 2.1%        |

Read: with booked exits the bot had to learn two things a player must learn too. First, exit signals clear automatically, so a departing train runs out by whatever route is set unless its starter is held until the crossover is right; the manual hold exists for this. Second, when two departures need opposite settings of the crossover, set one at a time. With those habits the shift is clean; without the hold, roughly one train in twelve left by the wrong exit. This is the current default.
