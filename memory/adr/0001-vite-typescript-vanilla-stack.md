# ADR 0001 - Vite + TypeScript without a UI framework

Status: Active (2026-10-11)

## Decision

Build the game as a static Vite app in strict TypeScript with ESLint (typescript-eslint, type-checked) and Prettier, using plain DOM for the HUD. No React, Next.js, or other UI framework.

## Why

- The requested stack is TypeScript + ESLint + Vite + Prettier; the memory bank conventions come from a Next.js template but the app itself does not need server rendering or routing.
- The HUD is a handful of lists and buttons; a framework would add bundle size and a second rendering model next to PixiJS.
- Vite gives fast dev reload and a one-command production build.

## Trade-offs

- HUD updates are done by rebuilding small `innerHTML` fragments a few times per second; if the panel grows significantly, a small view library may be worth revisiting.
