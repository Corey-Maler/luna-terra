# @lunaterra/react

## 0.1.0

### Minor Changes

- efc3b0d: Add a thin React canvas host that manages Luna-Terra engine mounting, scene setup, and disposal without coupling scene primitives to React.

  Correct the `Line` constructor style type so inherited color and opacity styles are accepted alongside line-specific styles.

  Release renderer observers and DOM event listeners when an engine is destroyed so framework hosts can mount and unmount canvas scenes safely.

  Make viewport fitting work for real-world coordinate ranges instead of assuming normalized 0–1 scenes, and allow an immediate zero-duration fit for first layout.

  Accept standard compact and fractional-alpha `rgb()`/`rgba()` color strings so themed canvas controls do not fail during rendering.

  Expose the canvas `ScaleRuler` as a controlled, keyboard-accessible React component, add optional discrete step intervals, and provide a focused `@lunaterra/ui/scale-ruler` package entry point.

### Patch Changes

- b6e52ea: Refresh all publishable packages through the repaired release workflow so their latest workspace builds are available on npm.
- Updated dependencies [d3a221b]
- Updated dependencies [efc3b0d]
- Updated dependencies [244d578]
- Updated dependencies [d3a221b]
- Updated dependencies [d3a221b]
- Updated dependencies [b6e52ea]
  - @lunaterra/core@0.1.0
  - @lunaterra/ui@0.1.0

## 0.0.0

Initial package scaffold.
