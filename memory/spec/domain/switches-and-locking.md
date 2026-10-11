# Switches and Locking

Status: Active (2026-10-11)

Switches are the player's only control. The interlocking rules below guarantee a switch can never move under or directly in front of a committed train.

Related documents:

- [Track graph](track-graph.md): Facing and trailing movement resolution. Read this for how a switch state selects the next edge.
- [Signals and blocks](signals-and-blocks.md): Route locks that extend switch locking ahead of a moving train. Read this to see why a switch far from any train can still be locked.
- [ADR 0004 Automatic signals, manual switches](../../adr/0004-automatic-signals-manual-switches.md): Why the player controls switches but not signals.

## States

- Every switch is `normal` or `reverse`; all switches start `normal`.
- Toggling flips the state; there is no travel time (switches move instantly).

## Locking rule

A switch is **locked** when any of its three edges (toe, normal leg, reverse leg) is _blocked_, where blocked means occupied by any part of a train **or** route-locked for a train (see signals spec).

- A toggle on a locked switch is refused and logged as a `switch-locked` event; the state does not change.
- Locks are derived, not stored: they disappear as soon as the blocking train has cleared the relevant edges.

## Consequences the player must learn

- Set the facing switches (A, B, C) before the train passes the home signal; once it has passed, the whole route to the platform is locked.
- Set the trailing switches (D, E, F) for the departing train; its starter stays red until the exit route is set.
- A trailing switch set against a standing train only blocks that train's starter; it never damages anything.
