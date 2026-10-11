# Stack and Toolchain

Status: Active (2026-10-11)

The project is a static single-page web app with no backend.

Related documents:

- [ADR 0001 Vite + TypeScript without a UI framework](../../adr/0001-vite-typescript-vanilla-stack.md): Why there is no React/Next layer. Read this before proposing a framework.
- [ADR 0002 PixiJS for rendering](../../adr/0002-pixijs-for-rendering.md): Why PixiJS rather than Phaser, canvas, or SVG. Read this before changing the rendering approach.

## Runtime

- TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Vite for dev server and production bundling.
- PixiJS 8 for the station canvas. Everything else is plain DOM.

## Quality gates

| Script                                | Purpose                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `yarn lint`                           | `tsc --noEmit` followed by ESLint (typescript-eslint type-checked + stylistic rules, Prettier conflicts disabled). |
| `yarn lint:format`                    | Prettier check.                                                                                                    |
| `yarn test`                           | Vitest unit tests for `src/core`.                                                                                  |
| `yarn lint:full`                      | All of the above.                                                                                                  |
| `yarn format`                         | Prettier write. Run after finishing code changes.                                                                  |
| `yarn build`                          | Type check and production bundle to `dist/`.                                                                       |
| `yarn assess`                         | Scripted-dispatcher batch simulation with gameplay metrics.                                                        |
| `yarn deploy:preview` / `yarn deploy` | Vercel preview / production deploy; see the operations runbook.                                                    |

## Conventions

- Package manager: Yarn 1 (`yarn.lock` is committed).
- Imports use `import type` for type-only imports (enforced by ESLint).
- Unused parameters are prefixed with `_`.
- No code in `src/core` may import from `pixi.js` or touch `document`/`window`.
- Deployment: static bundle on Vercel, configured by `vercel.json`; see [Deploy to Vercel](../operations/deploy.md).
