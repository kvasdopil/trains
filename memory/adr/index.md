# ADR - Index

Status: Active (2026-10-11)

Durable architectural and policy decisions. Create a numbered ADR when a tradeoff should not have to be rediscovered later.

Related documents:

- [Artifact types](../mbb/artifacts.md): Explains what belongs in an ADR versus a spec or plan.
- [Authoring workflows](../mbb/workflows.md): Step-by-step guidance for recording a new decision.

- [0001 Vite + TypeScript without a UI framework](0001-vite-typescript-vanilla-stack.md): Why the app is plain TypeScript on Vite with ESLint and Prettier. Read this before adding a framework.
- [0002 PixiJS for rendering](0002-pixijs-for-rendering.md): Why PixiJS was chosen over Phaser, raw canvas, or SVG. Read this before changing the renderer.
- [0003 Pure simulation core](0003-pure-simulation-core.md): Why gameplay rules live in a dependency-free, fixed-step core. Read this before adding browser APIs to `src/core`.
- [0004 Automatic signals, manual switches](0004-automatic-signals-manual-switches.md): Why the player controls switches only and signals derive from state. Read this before adding signal controls.
