# Train Movement

Status: Active (2026-10-11)

Trains move along the track graph with simple kinematics and always stop short of the first obstacle ahead.

Related documents:

- [Signals and blocks](signals-and-blocks.md): Where red aspects and route locks come from. Read this to understand stop targets.
- [Timetable and scoring](timetable-and-scoring.md): When trains spawn and what happens when they leave.
- [GS3 Switch locking under a train](../testing/scenarios/gs3-switch-locking.md): Scenario that exercises path tracking and lock release.

## Representation

- A train is a head distance travelled since spawn plus an ordered list of traversed edges with their cumulative start offsets. The tail is `head - length`.
- Occupied edges are those intersecting `[tail, head]`. Fully passed edges are pruned each step and their route locks released.
- A train spawns with its head at the start of the first off-stage approach section and runs towards the entrance signal, stopping at any red approach block signal on the way. Each section (180 units) is longer than any train, so a queue forms with one train per section, four deep, before the timetable itself has to wait.

## Stop target

Each step the train looks ahead along the path it would take with current switch states and stops at the first of:

1. for a stopping train only, the stop point of a platform it has not yet served: `margin` units before the end of the platform edge, aligned with the end of the platform bar rather than with the outgoing light;
2. a signal showing red;
3. a switch set against the movement (safety fallback; normally a signal protects it).

If the walk reaches the exit there is no stop target.

## Kinematics

- Default physics: max speed 110, acceleration 35, deceleration 55 (track units per second, per second squared).
- Target speed is `min(maxSpeed, sqrt(2 · deceleration · remaining))`, where `remaining` is the distance to the stop point. Signal and blocked-switch stops are 3 units short of the node; platform stops use the platform margin. Speed moves towards the target by at most `acceleration·dt` or `deceleration·dt`.
- Movement per step is clamped to `remaining`, so a train can never pass a red signal, even at high simulation speed.

## Through trains

- A train booked for a through track never stops at a platform; it may be routed via the through line or via any platform.
- While a through train is on a platform edge its speed limit drops to 45% of its maximum, and it brakes ahead of the platform so it enters at that speed; routing via a platform costs time, not money.
- Entering a through track sets the train's `viaThrough` flag and logs a `passing` event (marked incorrect only for a stopping train, which is missing its stop); a through train entering a platform logs a `passing` event marked correct.

## Dwell and departure

- Reaching an unserved platform stop puts the train into `dwelling` for its booked dwell seconds and records the served platform (whether or not it was the booked one).
- Dwelling is independent of the starter: the starter shows the real route state (green if the exit route is set and clear) while the train loads.
- After dwell the train is `running` again and departs at once if its starter is not red, otherwise it waits in front of it.

## Exit

- Once the head runs off the exit edge the train keeps moving; it is removed and settled when the tail clears the exit edge.
