# Track Graph

Status: Active (2026-10-11)

A station is a directed graph of track nodes and edges. All movement, signalling, and rendering derive from this graph plus the current switch states.

Related documents:

- [Switches and locking](switches-and-locking.md): How switch nodes resolve the next edge. Read this together with the "next edge" rule below.
- [Seed S1 Central Station](../testing/seeds/s1-central-station.md): The concrete feature-1 layout used by tests. Read this for node and edge ids.

## Elements

- **Node**: an id and a screen position (track units are pixels on a 1200×500 stage).
- **Edge**: a directed track segment `from -> to`. Edges are oriented in the direction of travel; length is derived from node positions.
- **Switch**: a node with a `toe` edge and two leg edges (`normal`, `reverse`).
- **Signal**: stands at a node and is seen by trains travelling along its `fromEdge` towards that node.
- **Platform**: bound to one edge; the platform bar is inset `margin` units (default 20) from both ends of the edge, and stopping trains halt with their head at the far end of the bar, short of the outgoing light.
- **Through track**: bound to one edge; trains never stop on it. A train's booked **destination** is either a platform id or a through-track id.
- **Crossing**: a diamond where two tracks cross at a node without a switch. Each of its two pairs maps an incoming edge to the outgoing edge straight across. Routes over either pair conflict with each other.
- **Exit**: a track leaving the station, with an id (`N`, `S`), a name and an edge. A train's booking names an exit as well as a track.
- **Entry edge**: the first of the off-stage approach sections where new trains appear; the sections chain up to the entrance signal.

## Invariants

- Every edge referenced by a switch, signal, or platform must exist, and every edge's nodes must exist (validated when the graph is built).
- Traffic is single-direction: a train always traverses an edge from `from` to `to`. Bidirectional running is out of scope for feature 1.
- A non-switch node has at most one outgoing edge; a node with none is the exit.

## Next-edge rule

Given the edge a train is on, the next edge is resolved at the edge's `to` node:

- Non-switch node with one outgoing edge: that edge.
- Non-switch node with no outgoing edge: **exit** (the end of an exit track).
- Crossing node: the edge straight across from the one the train arrived on.
- Switch node, arriving on the toe (**facing** movement): the leg selected by the switch state.
- Switch node, arriving on a leg (**trailing** movement): the toe, but only if the switch is set for that leg; otherwise the route is **blocked** (`switch-not-set`).
