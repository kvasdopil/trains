# Architectural Layers

Status: Active (2026-10-11)

The code is split into three layers with one-directional dependencies so the simulation stays testable without a browser.

Related documents:

- [ADR 0003 Pure simulation core](../../adr/0003-pure-simulation-core.md): Rationale for keeping the simulation free of rendering code. Read this before adding a dependency to the core.
- [Repository structure](../../structure.md): Folder map that mirrors these layers. Read this to find where each layer lives.

## Layers

1. **Core** (`src/core`): layout data, track graph, switch/signal logic, trains, timetable, scoring. Deterministic, synchronous, driven by `Simulation.step(dt)`. No DOM, no PixiJS, no timers.
2. **Game** (`src/game`): PixiJS renderer. Reads simulation state every frame and draws it. Translates pointer input on switches into `Simulation.toggleSwitch` calls via a callback.
3. **UI** (`src/ui`): DOM HUD. Reads simulation state and exposes pause/speed/restart controls via callbacks.

`src/main.ts` is the composition root: it owns the fixed-timestep loop and wires the three layers.

## Rules

- Core never imports from game or UI. Game and UI never import from each other.
- All gameplay rules (what stops a train, when a switch is locked, how points are computed) live in core and are covered by unit tests.
- Rendering code must not mutate simulation state except through the public `toggleSwitch` API.
- Time advances only through `Simulation.step` with a fixed `dt`, so a shift is reproducible from its seed.
