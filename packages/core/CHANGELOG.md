# @lunaterra/core

## 0.1.0

### Minor Changes

- d3a221b: Add reusable declarative ChartView scenes with shared timeline controls, responsive layout, and dashed time series. Render the same scenes as PNGs through the Ground Crew Node package or an Express route, with an optional standalone CLI. Support static Canvas2D surfaces, restore nested screen transforms correctly, and preserve gaps in line series.

### Patch Changes

- efc3b0d: Add a thin React canvas host that manages Luna-Terra engine mounting, scene setup, and disposal without coupling scene primitives to React.

  Correct the `Line` constructor style type so inherited color and opacity styles are accepted alongside line-specific styles.

  Release renderer observers and DOM event listeners when an engine is destroyed so framework hosts can mount and unmount canvas scenes safely.

  Make viewport fitting work for real-world coordinate ranges instead of assuming normalized 0–1 scenes, and allow an immediate zero-duration fit for first layout.

  Accept standard compact and fractional-alpha `rgb()`/`rgba()` color strings so themed canvas controls do not fail during rendering.

  Expose the canvas `ScaleRuler` as a controlled, keyboard-accessible React component, add optional discrete step intervals, and provide a focused `@lunaterra/ui/scale-ruler` package entry point.

- 244d578: Render road fills and borders with one shader-colored ribbon to eliminate their depth fighting, halve road draw calls and vertex counts, and reduce geometry uploads. Add a bordered ribbon draw method to the WebGL 3D backend.
- b6e52ea: Refresh all publishable packages through the repaired release workflow so their latest workspace builds are available on npm.
- Updated dependencies [efc3b0d]
- Updated dependencies [b6e52ea]
  - @lunaterra/color@0.0.5
  - @lunaterra/math@0.0.5
  - @lunaterra/tracing@0.0.5

All notable changes to this package will be documented in this file.
