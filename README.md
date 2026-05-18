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

## Publishing packages

This repo is set up to publish each `@lunaterra/*` package independently using Changesets and GitHub Actions.

### One-time setup

1. In npm, open each package and add a Trusted Publisher.
2. Configure it for this GitHub repository, workflow `release-packages.yml`, environment `github-actions`, and branch `main`.
3. Ensure your default branch is `main` (or update `.changeset/config.json` and `.github/workflows/release-packages.yml`).

No `NPM_TOKEN` secret is required when using Trusted Publishing.

### Release flow

1. Add a changeset in a feature branch:

```bash
pnpm changeset
```

2. Commit the generated file in `.changeset/*.md` with your code changes.
3. Merge to `main`.
4. The `Release Packages` workflow will:
	- create/update a release PR with version bumps when there are pending changesets;
	- publish changed packages to npm when the release PR is merged.

### Helpful local commands

```bash
pnpm changeset         # create a release note + bump intent
pnpm version-packages  # apply all pending version bumps locally
pnpm release           # publish changed packages (typically CI-only)
```
