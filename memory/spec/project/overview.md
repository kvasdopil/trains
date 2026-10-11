# Game Overview

Status: Active (2026-10-11)

Rails Dispatcher is a browser game in which the player works as a railway station dispatcher. Trains arrive on a timetable, each booked for a specific passenger platform, and the player throws switches so every train reaches its platform and leaves again without getting stuck.

Related documents:

- [Signals and blocks](../domain/signals-and-blocks.md): The automatic blocking system that keeps trains apart. Read this to understand why trains stop without player input.
- [Timetable and scoring](../domain/timetable-and-scoring.md): How shifts, arrivals, and points work. Read this to understand what the player is optimising.
- [Roadmap](../../plans/roadmap.md): Planned features beyond the first release. Read this before proposing new gameplay.

## Player loop

1. A train appears on the inbound track with a booked destination (a platform, or `T` for the through line) shown on the train and in the timetable.
2. The player clicks switches to build a route from the home signal to the booked platform.
3. Signals clear automatically when the route is set and the section ahead is free.
4. The train stops at the platform for its dwell time, then departs once its starter signal clears.
5. The player sets the exit route through the trailing switches to the outbound track.
6. Points are awarded when the train leaves: a bonus for the booked platform, penalties for the wrong platform and for lateness.

## Scope of the first release (feature 1)

- One station, "Central Station", with one inbound track, three platforms, a centre through line, ten switches, a diamond crossing, fifteen signals (three approach blocks, entrance, home, four incoming, four outgoing, two exit), and two outbound tracks (north and south).
- Every train is booked for a track and an exit; the crossover with its diamond lets trains swap sides at the cost of blocking the other diagonal.
- Two kinds of train: stopping trains booked for a platform, and through trains that must not stop but may use the through line or any platform track.
- A queue of upcoming trains with their booked-platform colours shown above the inbound track.
- Single-direction traffic (west to east).
- Automatic three-aspect signalling; manual switches.
- A deterministic 14-train shift generated from a seed, with bunched arrivals so several trains share the station; a new seed on restart.
- Pause and 1x/2x/4x speed.

## Out of scope for now

- Bidirectional running, shunting, or freight.
- Manual signal control or route setting by clicking signals.
- Multiple stations, persistence, leaderboards.
