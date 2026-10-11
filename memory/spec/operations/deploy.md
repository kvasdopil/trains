# Deploy to Vercel

Status: Active (2026-10-11)

The game is a static Vite bundle deployed to Vercel. No server, no environment variables.

Related documents:

- [Quality gates](quality-gates.md): Run these before every production deploy.
- [ADR 0001 Vite + TypeScript without a UI framework](../../adr/0001-vite-typescript-vanilla-stack.md): Why the output is a static bundle.

## Configuration

`vercel.json` at the repository root fixes the build so the dashboard settings cannot drift:

- framework `vite`
- install `yarn install --frozen-lockfile` (fails if `yarn.lock` is out of date)
- build `yarn build` (type check, then Vite bundle)
- output `dist`
- `cleanUrls` on

`.vercel/` (written by `vercel link`) is git-ignored.

## First-time setup

1. `vercel login` (Vercel CLI 55 is installed globally).
2. `vercel link` from the project root: creates or selects the Vercel project.
3. Optional: `vercel git connect` (or import the GitHub repo in the dashboard) for automatic deploys on push; previews for branches, production for the default branch.

## Deploying

- `yarn deploy:preview` deploys the working tree to a preview URL.
- `yarn deploy` deploys to production (`vercel --prod`).
- Always run `yarn lint:full` and `yarn build` first; the remote build runs the same `yarn build` and fails on the same errors.

## Rollback

Use `vercel rollback` (or promote a previous deployment in the dashboard); every deployment is immutable.
