# How We Plan

Status: Active (2026-10-11)

This document defines the default planning workflow for work tracked in `memory/plans/`. Plans stay small, end to end, and traceable back to specs, ADRs, and tests.

Related documents:

- [Authoring workflows](../mbb/workflows.md): Operating rules for bootstrapping, feature planning, and keeping docs in sync. Read this for the full step-by-step workflow.
- [Artifact types](../mbb/artifacts.md): Explains what belongs in plans versus specs and ADRs. Read this before creating a new planning document.
- [Testing index](../spec/testing/index.md): Entry point for scenarios and seeds. Read this to link verification into every plan.

## Planning rules

- Start from the canonical spec docs the work changes.
- Keep one plan file per feature and one index per epic.
- State user value, deliverables, dependencies, risks, and acceptance criteria.
- Link the exact specs, ADRs, scenarios, and seeds that govern the change.
- Prefer vertical slices: `core rules -> tests -> renderer/HUD -> docs`.

## Definition of done

- `yarn lint:full` passes (types, ESLint, Prettier, unit tests).
- Relevant spec docs are updated if behavior changed.
- Relevant ADRs exist for stable tradeoffs or policy choices.
- Acceptance scenarios and tests are named explicitly.
- The nearest plan and index files are updated so the work stays discoverable.
