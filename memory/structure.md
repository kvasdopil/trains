# Repository Structure

Status: Active (2026-10-11)

This document is the map of the repository and of where memory bank docs should describe behavior. It stays high-level so specs, ADRs, and plans can own the details for their topics.

Related documents:

- [Memory Bank index](index.md): Entry point for the full memory bank. Read this to navigate the system from the top.
- [Memory Bank principles](mbb/principles.md): Governing rules such as single source of truth and one file per concept. Read this before adding new docs so the structure does not decay.
- [Architectural layers](spec/project/layers.md): The dependency rules between the simulation core, rendering, and UI. Read this before placing new source code.

## Repository map

- `src/core/` — Pure TypeScript simulation: track graph, switches, signals, trains, timetable, scoring. No DOM or PixiJS imports. Unit tests live in `src/core/__tests__/`.
- `src/core/layouts/` — Station layout data (nodes, edges, switches, signals, platforms). One file per station.
- `src/game/` — PixiJS rendering of the schematic station and input mapping (switch clicks).
- `src/ui/` — DOM HUD: money counter, timetable, event log, end-of-shift overlay.
- `src/main.ts` — Composition root: creates the simulation, renderer, HUD and the fixed-step game loop.
- `index.html`, `src/style.css` — Page shell and styling.
- `memory/` — This memory bank.
- `docs/` — Human-facing prompts and setup notes that are not normative.
- `vercel.json` — Vercel build settings for the static bundle; the runbook is in `memory/spec/operations/deploy.md`.

## Memory bank boundaries

- `memory/spec/` is the source of truth for product and engineering requirements.
- `memory/adr/` is the source of truth for durable architectural and policy decisions.
- `memory/plans/` is the source of truth for delivery sequencing and verification planning.
- Code is the source of truth for implementation details.

## Placement rules

- Put stable behavior, invariants, and contracts in `spec/`.
- Put rationale and tradeoffs in `adr/`.
- Put execution sequence and acceptance checklists in `plans/`.
- Update the nearest `index.md` whenever you add, rename, split, or remove a document.
