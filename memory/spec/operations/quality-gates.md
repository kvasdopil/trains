# Quality Gates

Status: Active (2026-10-11)

Every change must pass the same gates locally that the Vercel build runs remotely.

Related documents:

- [Stack and toolchain](../project/stack.md): Tool versions and conventions.
- [Gameplay assessment harness](../testing/gameplay-assessment.md): The optional batch simulation (`yarn assess`) for timetable or signalling changes.

## Commands

| Gate   | Command            | Must pass when                                               |
| ------ | ------------------ | ------------------------------------------------------------ |
| Types  | `yarn lint`        | Always; `tsc --noEmit` runs first and stops on any error.    |
| Lint   | `yarn lint`        | Always; ESLint type-checked presets, see `eslint.config.js`. |
| Format | `yarn lint:format` | Always; run `yarn format` to fix.                            |
| Tests  | `yarn test`        | Always; Vitest over `src/core/__tests__`.                    |
| All    | `yarn lint:full`   | Before handing over or deploying.                            |
| Build  | `yarn build`       | Before deploying; identical to the Vercel build command.     |

## Rules

- `yarn format` is run after finishing code changes; Prettier also formats the memory bank, so documentation edits go through the same check.
- A change to timetable density, signalling rules or the layout should also run `yarn assess` and record the result in the assessment doc.
- `yarn build` must succeed locally before `yarn deploy`; a type error that passes the dev server still fails the production build.
