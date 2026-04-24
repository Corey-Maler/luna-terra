# Luna-Terra

Opinionated monorepo for drawing and interaction on JavaScript canvas.

## Workspace map

- `apps/docs` - Documentation website (React + Vite) with live scenes and package docs.
- `packages/core` - Engine, renderer, interaction manager, element base classes.
- `packages/elements` - Reusable drawing primitives (Line, RectElement, TextElement, TimeControl).
- `packages/charts` - Reusable charting components (Axis, LineSeries, FunctionPlot, Crosshair, StackedAreaSeries).
- `packages/ui` - Reusable UI overlays/panels for canvas workflows (ScaleRuler, Panel, FpsPanel).
- `packages/math` - Geometry primitives and transform math (`V2`, `M3`, `Rect2D`).
- `packages/color` - `Color` model and color-space helpers.
- `packages/tracing` - Performance tracing utilities.
- `packages/legacy` - Legacy prototype; reference only.

## Commands

Run from repository root:

```bash
pnpm dev          # start docs website on http://localhost:4200
pnpm build        # build all workspace packages/apps
pnpm test:run     # run tests in packages that define test scripts
pnpm lint         # eslint across all packages/apps
pnpm typecheck    # tsc --noEmit across all packages/apps
```

## Documentation structure

`apps/docs` is the product documentation site, not a throwaway preview app.

- Getting Started: project intent and first-run guidance.
- Package Reference: API-by-package docs (`@lunaterra/math`, `@lunaterra/core`, `@lunaterra/color`, `@lunaterra/elements`, `@lunaterra/charts`).
- Benchmarks: focused performance investigations.

## Reuse-first policy

Before creating a new drawing element, first check:

1. `packages/elements/src/lib`
2. `packages/charts/src/lib`
3. `packages/ui/src/lib`

If an existing primitive can express the behavior, extend or compose it instead of creating a duplicate implementation.

Pointer arrows should be implemented via `Line` marker options in `@lunaterra/elements` (`endMarker` / `startMarker`) rather than adding a separate arrow element class.

## In-development note

The project is still evolving and APIs may shift.
