# ADR 0002 - PixiJS for rendering

Status: Active (2026-10-11)

## Decision

Render the station view with PixiJS 8 (`Graphics`, `Text`, `Container`, pointer events, ticker).

## Why

- The view is a schematic diagram redrawn every frame: lines, circles, text, and hit areas. PixiJS's retained scene graph and immediate-mode `Graphics` fit this exactly.
- It is a widely used web game rendering engine with first-class TypeScript types and WebGL/WebGPU acceleration, keeping the frame budget comfortable as layouts grow.
- Phaser would bring physics, scenes, and asset pipelines that this game does not use; raw canvas or SVG would require hand-written hit testing and redraw management.

## Trade-offs

- PixiJS adds roughly 90 kB gzipped to the bundle.
- Pixi's pointer coordinates rely on the canvas being scaled uniformly via CSS; non-uniform scaling must be avoided.
