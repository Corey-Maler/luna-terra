# Luna-Terra – Workspace Instructions

## Overview

A **pnpm monorepo** (no NX, no Turborepo) for the Luna-Terra canvas rendering library and its documentation website.
Org scope: `@lunaterra/*`.

---

## Workspace layout

```
apps/
  docs/             # React + Vite documentation website (name: "docs")
packages/
  core/             # @lunaterra/core   – canvas renderer (WebGL + Canvas2D)
  elements/         # @lunaterra/elements – reusable drawing primitives
  charts/           # @lunaterra/charts – chart components
  ui/               # @lunaterra/ui – panels and viewport UI helpers
  color/            # @lunaterra/color  – Color class and colour utilities
  math/             # @lunaterra/math   – V2, M3, Rect2D math primitives
  tracing/          # @lunaterra/tracing – lightweight perf tracing util
  legacy/           # @lunaterra/legacy  – old prototype, kept for reference
```

---

## Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| pnpm | 9.x | package manager + workspace orchestration |
| Vite | 7.x | bundler for `docs`; vitest runner for `core`/`color` |
| TypeScript | 5.7 | strict mode across all packages |
| vitest | 4.x | unit tests (`core`, `color`) |
| ESLint | 9.x (flat config) | linting, extends root `eslint.config.mjs` |

No NX. No Turborepo. No project.json files.

---

## Common commands (run from workspace root)

```bash
pnpm dev          # start docs website on http://localhost:4200
pnpm build        # tsc-build all libraries + vite-build docs
pnpm test:run     # run vitest in all packages that have a test script
pnpm lint         # eslint across all packages
pnpm typecheck    # tsc --noEmit across all packages
```

Per-package (examples):
```bash
pnpm --filter @lunaterra/core run build
pnpm --filter @lunaterra/core run test
pnpm --filter docs run dev
```

---

## TypeScript path aliases

Defined in `tsconfig.base.json` (workspace root). All package `tsconfig.json` files extend this.

```json
"@lunaterra/math"    → packages/math/src/index.ts
"@lunaterra/core"    → packages/core/src/index.ts
"@lunaterra/color"   → packages/color/src/index.ts
"@lunaterra/tracing" → packages/tracing/src/index.ts
```

`rootDir: "."` is set so cross-package path aliases don't cause "file not under rootDir" errors.
Vite resolves these via `vite-tsconfig-paths` (replaces the old `nxViteTsPaths()`).

---

## Package structure conventions

- Libraries output CommonJS (`"type": "commonjs"`) and point `main`/`types` at `./src/index.js` / `./src/index.d.ts` (source, not a built dist — these are internal-only packages).
- `tsconfig.lib.json` in each library is used for the `build` script (`tsc -p tsconfig.lib.json`).
- `apps/docs` is `"type": "module"` and uses Vite directly.

---

## Reuse-first rule

Before creating any new drawable primitive, check existing implementations in:

- `packages/elements/src/lib`
- `packages/charts/src/lib`
- `packages/ui/src/lib`

Prefer composition and extension over creating duplicate classes in app-local folders.

For pointer arrows, use `Line` markers (`startMarker` / `endMarker`) from `@lunaterra/elements` instead of adding a dedicated arrow element class.

---

## Known issues / WIP

- `packages/core/src/render/` files use `@/Math`, `@/MicroPlotter/...` aliases that are not yet wired up — they are migrated from `packages/legacy` and still reference legacy internal paths.
- `packages/color/src/lib/color.spec.ts` is a stale NX stub; the `color()` function it imports doesn't exist (the package exports `Color` class + `Colors` object).
- `packages/legacy` is the old monolithic prototype — useful as a reference but not part of the active build.
