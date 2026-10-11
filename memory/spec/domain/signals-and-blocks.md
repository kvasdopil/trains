# Signals and Blocks

Status: Active (2026-10-11)

Signals are automatic. They implement a three-aspect block system plus route locking so the player only has to worry about switches.

Related documents:

- [Switches and locking](switches-and-locking.md): How route locks feed into switch locking. Read this for the player-facing effect.
- [Train movement](train-movement.md): How a red aspect becomes a stop target. Read this to see how trains obey signals.
- [GS2 Hold at home signal](../testing/scenarios/gs2-hold-at-home-signal.md): Golden scenario for a red home signal clearing after a reroute.

## Sections

The section protected by a signal is the list of edges reached by walking forward from the signal, following current switch states, until the first edge that carries another signal (that edge is included) or the exit.

- If the walk hits a switch set against the movement, the route is **not set**.
- If the walk crosses a diamond, the other track of that diamond (its two other edges) becomes a **conflict** of the route: the signal treats those edges exactly like its own section when checking for trains and locks.

## Aspects

| Aspect | Condition                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| red    | The signal is _held_, or the route is not set, or any edge in the section or in its crossing conflicts is blocked (occupied or route-locked by another train). |
| yellow | Section clear and route set, but the next signal shows red.                                                                                                    |
| green  | Section clear and route set, and the next signal is yellow or green, or there is no next signal (exit).                                                        |

- Aspects are recomputed whenever a switch is toggled and at the start of every simulation step, so they always reflect current state.
- A platform **starter** is _not_ held while its train is loading: it shows the true state of the exit route, so a green starter over a dwelling train means the train is good to go the moment its dwell ends. The dwell itself keeps the train standing.
- The dispatcher may **hold any signal** manually (`toggleSignalHold`); a held signal shows red until released. Trains that have already passed it are unaffected; trains behind it stop in front of it like at any red. This is the only way to stop a train that is otherwise free to go, for example to keep the ladder clear for a through train.

## Route locking

- When a train's head passes a signal, the signal's section edges become that train's **route lock**, and all aspects are recomputed at once so that another train waiting at a conflicting signal (for example the other side of the diamond) is held in the same step.
- A locked edge counts as blocked for every other train's signal evaluation and for switch locking.
- An edge leaves the lock when the train's tail has fully passed it. The lock is cleared when the train leaves the layout.

## Feature-1 signals

Every platform and the through line have an incoming and an outgoing light, plus an entrance signal, a home signal in front of the ladder, and an exit signal after the last switch:

- `AP1`–`AP3` (approach block signals, off stage) between the four approach sections. Each section is longer than any train, so trains queue one per section with the block signals keeping them apart.
- `IN` (entrance) at the station boundary, at the end of the last approach section. Its section is the inbound track up to `H`.
- `H` (home) at the end of the inbound track, before switch A. Its section is the facing ladder up to the chosen platform entry.
- `E1`–`E3` (incoming / platform entry) at the west end of each platform, and `T1` at the west end of the through line. Their section is the platform or through track.
- `S1`–`S3` (outgoing / starters) at the east end of each platform, and `T2` at the east end of the through line. Their section is the trailing ladder (D or E) up to `O1` or `O2`.
- `O1` (upper) and `O2` (lower) exit signals in front of the crossover. Their section is the crossover route (straight, or over the diamond `X`) and the exit track; they show red while the previous train is still clearing the exit, or while the other diagonal of the diamond is in use.

Typical reading for the dispatcher: `H` yellow means the ladder is free but the booked platform is still occupied, so the train will stop at the platform entry light inside the ladder and block it; re-route before the train passes `H`. A green starter over a loading train means its exit is ready; a red one means the crossover or the exit track still needs attention before the dwell ends.
