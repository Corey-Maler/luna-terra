# @lunaterra/terra

## 0.0.4

### Patch Changes

- 244d578: Render roads as class-scaled filled ribbons with casings and a three-pixel minimum width, using polygon-depth bias to prevent terrain Z-fighting. Add collision-filtered city, town, village, and named-road labels from annotated tile geometry.
- 244d578: Render road fills and borders with one shader-colored ribbon to eliminate their depth fighting, halve road draw calls and vertex counts, and reduce geometry uploads. Add a bordered ribbon draw method to the WebGL 3D backend.
- 244d578: Render rivers, streams, and canals as width-scaled filled ribbons. Keep road casings visible at close zoom and retry failed tile requests with backoff instead of permanently caching empty tiles.
- b6e52ea: Refresh all publishable packages through the repaired release workflow so their latest workspace builds are available on npm.
- Updated dependencies [d3a221b]
- Updated dependencies [0a9ae9c]
- Updated dependencies [efc3b0d]
- Updated dependencies [244d578]
- Updated dependencies [b6e52ea]
  - @lunaterra/core@0.1.0
  - @lunaterra/elements@0.1.0
  - @lunaterra/math@0.0.5

All notable changes to this package will be documented in this file.
