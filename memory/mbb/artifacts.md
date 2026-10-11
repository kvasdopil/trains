# Artifact Types

Status: Draft (2026-10-11)

This document maps the main document types in the memory bank to the question each one answers, so a new fact lands in the right container.

Related documents:

- [Principles](principles.md): Governing rules such as single source of truth and WHAT/WHY/HOW separation. Read this first; artifact types are the practical application of those rules.
- [Writing format](format.md): Shape, naming, and annotation conventions shared by every artifact type. Read this while authoring.
- [Examples](examples.md): Concrete templates for each artifact type. Read this when you want a starting point.

## Types

| Artifact     | Question it answers                             | Lives in                                              | Create it when                                                                |
| ------------ | ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Spec         | What must the system do?                        | `spec/<area>/<topic>.md`                              | A rule, invariant, or contract must hold regardless of how it is implemented. |
| ADR          | Why did we choose this?                         | `adr/NNNN-<decision>.md`                              | A tradeoff was made that should not be rediscovered or accidentally reversed. |
| Epic plan    | What initiative are we delivering?              | `plans/epics/EP-NNN-<name>/index.md`                  | Several features share a goal and need sequencing.                            |
| Feature plan | How will this slice be delivered and verified?  | `plans/epics/<epic>/features/FT-NNNN-<name>/index.md` | A vertical slice is ready to be built and must be verifiable.                 |
| Scenario     | Which end-to-end flow proves the rule?          | `spec/testing/scenarios/<id>-<name>.md`               | A high-risk flow must stay testable from setup to assertion.                  |
| Seed         | What deterministic starting state do tests use? | `spec/testing/seeds/<id>-<name>.md`                   | Tests need a reusable, documented fixture.                                    |
| Index        | Where is everything in this folder?             | `index.md` in every meaningful folder                 | Always; a folder without an index breaks navigation.                          |

## What does not belong

- Implementation details that are already obvious from the code.
- Temporary task notes; keep those in the task's working directory as lessons-learned or insights files.
- Copies of source files.
