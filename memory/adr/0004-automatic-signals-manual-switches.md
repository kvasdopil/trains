# ADR 0004 - Automatic signals, manual switches

Status: Active (2026-10-11)

## Decision

Signals are fully automatic (three-aspect block signalling with route locking derived from switch states and train positions). The player only throws switches.

## Why

- The brief asks the player to "change the switches in time so trains won't get stuck"; signals are the safety system that makes a wrong or late switch setting visible (red) rather than catastrophic.
- One control type keeps the first release learnable: every problem on the board is solved by throwing a switch.
- Automatic aspects still produce rich feedback: yellow on approach to an occupied platform, red starters until the exit route is set.

## Amendment (2026-10-11)

The dispatcher may additionally **hold** any signal at red by clicking it. Aspects stay automatic otherwise; the hold is the one manual control that lets a player keep a train waiting, for example to clear the ladder for a through train. It does not set routes.

## Trade-offs

- Real dispatchers set routes (which clear signals); players who expect to "clear a signal" may look for a control that does not exist. The help text explains the model, and the roadmap lists manual route setting as a candidate alternative.
- Because signals clear as soon as a route is set and free, a stopping train may enter a platform the player did not intend; this is scored as a wrong platform rather than prevented. Through trains are tolerant of routing: any platform is acceptable as long as they do not stop.
