# Domain Specs - Index

Status: Active (2026-10-11)

This section holds the gameplay rules and invariants of the station simulation. Each file owns one concept; together they define what `src/core` must do.

Related documents:

- [Track graph](track-graph.md): Nodes, directed edges, entry/exit, and how the next edge is resolved. Read this before touching layout data or movement.
- [Switches and locking](switches-and-locking.md): Switch states, facing vs trailing movements, and when a switch may be thrown. Read this to implement or test interlocking.
- [Signals and blocks](signals-and-blocks.md): Three-aspect automatic signalling and route locking. Read this to understand why a signal shows a given aspect.
- [Train movement](train-movement.md): Kinematics, stop targets, dwell, and exit. Read this to change how trains accelerate, brake, or stop.
- [Timetable and scoring](timetable-and-scoring.md): Shift generation, spawning, delay, and money (coin events). Read this to tune difficulty or the economy.
- [Specifications index](../index.md): Parent catalog for all normative docs.
