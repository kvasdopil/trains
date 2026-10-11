# Rails Dispatcher

A browser game about the railway station dispatcher's job. Trains arrive on a timetable, each booked for a platform (or the through line) and an exit; you throw the switches and hold signals so every train reaches its track and leaves by the right exit. Signals are automatic (three-aspect block system with route locking and a diamond crossing), so a wrong or late switch shows up as a red light and a waiting train, never a crash.

## Getting started

```bash
yarn install
yarn dev
```

Open [http://localhost:5173](http://localhost:5173).

## How to play

- Click a yellow switch dot to throw it. Build the route from the home signal to the booked track before the train reaches it.
- Click a signal head to hold it at red (orange frame); click again to release. Hold a train's starter until its exit route through the crossover is set.
- Red = section ahead occupied or route not set, yellow = next signal red, green = clear. Switches lock (orange) while a train occupies them or holds a route through them.
- Through trains (violet, booked `T`) must never stop; the centre line is fastest, but any platform works at reduced speed.
- You earn money, shown as `+$` coming off each train: `$100` as passengers unload at the booked platform (half at a wrong one), `$100` for a through train running through. A stopping train that misses its stop, or any train leaving by the wrong exit, refunds the full `$100` fare, and a late train costs `$2` every second beyond a short grace. Space pauses; the speed button cycles 1x/2x/4x.

## Scripts

| Script                | What it does                                                               |
| --------------------- | -------------------------------------------------------------------------- |
| `yarn dev`            | Vite dev server with hot reload on port 5173.                              |
| `yarn lint`           | `tsc --noEmit` (strict type check) followed by ESLint over the whole repo. |
| `yarn lint:format`    | Prettier check; fails if any file is not formatted.                        |
| `yarn test`           | Vitest unit tests for `src/core` (the simulation).                         |
| `yarn lint:full`      | `lint`, `lint:format` and `test` in sequence: the full quality gate.       |
| `yarn format`         | Prettier write over the whole repo. Run before finishing a change.         |
| `yarn build`          | Type check, then production bundle into `dist/`.                           |
| `yarn preview`        | Serve `dist/` locally to check the production bundle.                      |
| `yarn assess`         | Scripted-dispatcher batch simulation of 100 shifts with gameplay metrics.  |
| `yarn deploy:preview` | Deploy the current directory to a Vercel preview URL.                      |
| `yarn deploy`         | Deploy to production on Vercel.                                            |

## Lint and format

- ESLint runs the type-checked `typescript-eslint` presets (`recommendedTypeChecked` and `stylisticTypeChecked`) with Prettier conflicts disabled; configuration is in `eslint.config.js`. Type-only imports must use `import type`; unused parameters are prefixed with `_`.
- Prettier formats TypeScript, CSS, HTML, JSON and Markdown (including the memory bank) using `.prettierrc`; `.prettierignore` skips `dist`, `node_modules`, `coverage` and `yarn.lock`.
- The expected loop while working: `yarn lint` and `yarn test` as you go, `yarn format` when done, `yarn lint:full` before handing over.

## Build

`yarn build` runs `tsc --noEmit` first, so a type error fails the build before Vite runs. The bundle in `dist/` is static (HTML, CSS, JS, PixiJS chunks) and can be served by any static host. Check it locally with `yarn preview`.

## Deploy to Vercel

The app is a static Vite site; `vercel.json` pins the framework (`vite`), the install command (`yarn install --frozen-lockfile`), the build command (`yarn build`) and the output directory (`dist`).

First time, from the project root:

```bash
vercel login
```

```bash
vercel link
```

`vercel link` creates or selects the Vercel project and writes `.vercel/` (git-ignored). Then:

```bash
yarn deploy:preview
```

deploys a preview and prints its URL, and

```bash
yarn deploy
```

deploys to production. Run `yarn lint:full` before `yarn deploy`; the build on Vercel runs the same `yarn build` and will fail on a type error.

To deploy on every push instead, import the GitHub repository in the Vercel dashboard (or run `vercel git connect` after linking); Vercel picks up `vercel.json` and builds each commit, with previews for branches and production for the default branch.

## Stack

TypeScript, Vite, PixiJS 8 for the station canvas, plain DOM for the HUD, GSAP for the money animations, ESLint (typescript-eslint, type-checked), Prettier, Vitest.

## Project layout

- `src/core/` — pure simulation (track graph, switches, signals, crossings, trains, timetable, scoring) with unit tests and the gameplay assessment harness.
- `src/game/` — PixiJS renderer and switch/signal input.
- `src/ui/` — DOM HUD.
- `memory/` — the memory bank: specs, ADRs, plans, and testing scenarios. Start at [memory/index.md](memory/index.md).
