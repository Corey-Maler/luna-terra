---
"@lunaterra/react": minor
"@lunaterra/elements": patch
"@lunaterra/core": patch
"@lunaterra/color": patch
"@lunaterra/ui": minor
---

Add a thin React canvas host that manages Luna-Terra engine mounting, scene setup, and disposal without coupling scene primitives to React.

Correct the `Line` constructor style type so inherited color and opacity styles are accepted alongside line-specific styles.

Release renderer observers and DOM event listeners when an engine is destroyed so framework hosts can mount and unmount canvas scenes safely.

Make viewport fitting work for real-world coordinate ranges instead of assuming normalized 0–1 scenes, and allow an immediate zero-duration fit for first layout.

Accept standard compact and fractional-alpha `rgb()`/`rgba()` color strings so themed canvas controls do not fail during rendering.

Expose the canvas `ScaleRuler` as a controlled, keyboard-accessible React component, add optional discrete step intervals, and provide a focused `@lunaterra/ui/scale-ruler` package entry point.
