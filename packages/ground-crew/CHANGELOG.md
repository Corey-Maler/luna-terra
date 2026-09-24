# @lunaterra/ground-crew

## 0.1.0

### Minor Changes

- d3a221b: Add reusable declarative ChartView scenes with shared timeline controls, responsive layout, and dashed time series. Render the same scenes as PNGs through the Ground Crew Node package or an Express route, with an optional standalone CLI. Support static Canvas2D surfaces, restore nested screen transforms correctly, and preserve gaps in line series.
- d3a221b: Expose a bounded Ground Crew HTTP rendering service that can be mounted in an existing application, and release pending jobs and request listeners during shutdown. The Docker docs demo uses this service behind a persistent, configurable Redis IP quota.

### Patch Changes

- b6e52ea: Refresh all publishable packages through the repaired release workflow so their latest workspace builds are available on npm.
- Updated dependencies [d3a221b]
- Updated dependencies [efc3b0d]
- Updated dependencies [244d578]
- Updated dependencies [d3a221b]
- Updated dependencies [b6e52ea]
  - @lunaterra/core@0.1.0
  - @lunaterra/declarative@0.1.0
