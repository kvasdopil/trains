# Testing - Index

Status: Active (2026-10-11)

This section holds deterministic verification docs. Unit tests in `src/core/__tests__/` implement the scenarios below against the seed layout.

Related documents:

- [Gameplay assessment harness](gameplay-assessment.md): Scripted-dispatcher batch simulation with metrics and the current baseline. Read this before changing timetable density or signalling rules.
- [Scenario index](scenarios/index.md): Catalog of end-to-end acceptance scenarios. Read this when adding or updating a critical flow.
- [Seed index](seeds/index.md): Catalog of deterministic test setup docs. Read this when tests need reusable starting state.
- [Planning rules](../../plans/how-we-plan.md): Defines how plans should point to scenarios and tests. Read this to keep delivery and verification aligned.
- [Memory Bank workflows](../../mbb/workflows.md): Step-by-step guidance for adding seeds and golden scenarios.

## Strategy

- Gameplay rules are tested with Vitest at the simulation level by stepping with a fixed `dt` of 1/60 s until a condition holds.
- The timetable generator is tested for determinism and for the through-train mix.
- Rendering and HUD are verified manually in the browser; they contain no gameplay rules.
