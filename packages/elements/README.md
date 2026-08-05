# @lunaterra/elements

Reusable drawable elements for Luna-Terra scenes.

## Install

```bash
pnpm add @lunaterra/elements
```

## Highlights

- Line, text, rectangle, grid, and engineering-dimension primitives.
- Time controls and marker-capable line rendering.
- Designed to compose with `@lunaterra/core` scene APIs.

## Dimension lines

`DimensionLine` draws a measurement at any angle with conventional extension
lines, adaptive open arrows, and a screen-readable label. When the measured gap
cannot fit its label, `arrowPlacement: 'auto'` changes from arrows between the
witnesses to inward-pointing arrows outside them:

```ts
const sag = new DimensionLine({
  start: new V2(0, 4.6),
  end: new V2(0, 5.3),
  offset: -2,
  label: '0.7 m',
  labelAlongOffset: -0.5,
});
engine.add(sag);
```

## Build from source

```bash
pnpm --filter @lunaterra/elements run build
```
