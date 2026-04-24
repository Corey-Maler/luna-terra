# Luna-Terra – Copilot Instructions

## Repo overview

pnpm monorepo. No NX, no Turborepo. Org scope: `@lunaterra/*`.

```
apps/docs/              React + Vite documentation app (name: "docs")
packages/core/          @lunaterra/core   – WebGL + Canvas2D renderer
packages/elements/      @lunaterra/elements – reusable drawing primitives
packages/charts/        @lunaterra/charts – chart components
packages/ui/            @lunaterra/ui – panel/overlay components
packages/color/         @lunaterra/color  – Color class + colour utilities
packages/math/          @lunaterra/math   – V2, M3, Rect2D primitives
packages/tracing/       @lunaterra/tracing – perf tracing util
packages/legacy/        @lunaterra/legacy  – old prototype, reference only
```

## Key commands (run from root)

```bash
pnpm dev          # Vite dev server → http://localhost:4200
pnpm build        # tsc all libs + vite build docs
pnpm test:run     # vitest in all packages that have a test script
pnpm lint         # eslint across all packages
pnpm typecheck    # tsc --noEmit across all packages
```

Per-package: `pnpm --filter @lunaterra/core run build`

## Tooling

- **Vite 7** — bundler for docs + vitest runner for core/color
- **TypeScript 5.7** — strict, rootDir set to workspace root (`.`)
- **vitest 4** — tests in `packages/core` and `packages/color`
- **ESLint 9** (flat config) — root `eslint.config.mjs`, per-package configs extend it

## TypeScript path aliases (tsconfig.base.json)

```
@lunaterra/math     → packages/math/src/index.ts
@lunaterra/core     → packages/core/src/index.ts
@lunaterra/color    → packages/color/src/index.ts
@lunaterra/tracing  → packages/tracing/src/index.ts
```

`rootDir: "."` is required so cross-package aliases don't cause "file not under rootDir" errors.
Vite resolves these via `vite-tsconfig-paths`.

## Package conventions

- Libraries: `"type": "commonjs"`, `main`/`types` point at `./src/index.js` / `./src/index.d.ts` (source-only, not a dist build — internal packages).
- Build script: `tsc -p tsconfig.lib.json`
- `apps/docs`: `"type": "module"`, Vite-managed.

## Reuse-first guidance (important)

Before creating a new drawable primitive, always check existing packages first:

1. `packages/elements/src/lib`
2. `packages/charts/src/lib`
3. `packages/ui/src/lib`

Prefer composing existing elements over re-implementing similar behavior in app-local files.

For pointer arrows, use `Line` marker options (`startMarker`/`endMarker`) from `@lunaterra/elements` instead of building a separate arrow element class.

## Element system (`LTElement` / `LTStyledElement`)

- Base class is `LTElement` (was `MPElement`). Styled variant is `LTStyledElement`.
- Every element has `position: V2`, `rotation: number`, `scale: V2` that compose into `get localTransform(): M3 | null`.
- `CanvasRenderer` maintains a **software transform stack** (`pushLocalTransform` / `popLocalTransform`). Do **not** use `ctx.save()`, `ctx.setTransform()`, or `ctx.restore()` for element transforms — all transforms are applied by multiplying the accumulated M3 into `Batch.updateViewMatrix()`. This keeps Canvas2D line widths in screen-pixel space (1 px line stays 1 px regardless of zoom/rotation).
- Style inheritance uses `renderer.pushStyles()` / `renderer.popStyles()`. Opacity multiplies through the hierarchy; color is inherited (first non-null ancestor value wins).

## Known WIP / broken things

- `packages/core/src/render/` uses `@/Math`, `@/MicroPlotter/...` aliases — unresolved, migrated from legacy, not yet wired up.
- `packages/color/src/lib/color.spec.ts` — stale NX stub, imports a `color()` function that doesn't exist.
- `packages/legacy` — reference only, not part of the active build.
