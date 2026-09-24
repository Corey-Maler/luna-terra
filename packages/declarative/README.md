# @lunaterra/declarative

Describe a chart as serializable data, then compile it into a reusable Luna-Terra `ChartView`. Numeric sensor captures, digital scopes, and temperature forecasts share the same API and rendering primitives. Browser views use Luna-Terra's canvas rulers, gestures, crosshair, and tooltip; Ground Crew renders the same specification in Node.

```sh
pnpm add @lunaterra/declarative @lunaterra/core
```

```ts
import { compileChart, type ChartSpec } from '@lunaterra/declarative';

const spec: ChartSpec = {
  schemaVersion: 1, title: 'Sensor capture',
  x: { type: 'number', min: 0, max: 3, label: 's' },
  y: { label: 'Voltage (V)' },
  controls: { zoom: true, pan: true, cursor: true, tooltip: true },
  series: [{
    id: 'voltage', label: 'Voltage', color: '#639b80', unit: 'V',
    data: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: null }, { x: 3, y: 1.5 }],
  }],
};

// Mount a LunaTerraEngine in a sized container first.
engine.interactive = false; // Chart controls own gestures.
const view = compileChart(spec, { width: 800, height: 420, pixelRatio: 1 }, {
  responsive: true,
  onStateChange: ({ windowMin, windowMax, cursorValue }) => {
    // Synchronize another application view.
  },
});
engine.add(view);
```

## ChartSpec

- `schemaVersion: 1`, `title`, `x`, `y`, and `series` are required.
- `x`: `type` (`number` or `time`), `min`, `max`; optional `label`, `timeZone`, `locale`. Time values are epoch milliseconds; formatting defaults to UTC / en-GB.
- `y`: `label`, optional `min` and `max`. Automatic bounds fit ordinary series with padding, excluding lane series.
- `series`: up to 12 series, with at most 10,000 points total. Each requires a unique `id`, `label`, `color`, and `data` array of `{ x, y }`. X values must be sorted and unique. Null Y breaks the line.
- Series options: `stroke: { width, dash }`, `maxGapX`, `unit`, `interpolation`, `lane`. Stroke width defaults to 2 logical pixels; dashes default to solid. Gaps exceeding `maxGapX` break drawing and tooltip sampling; omitted means no gap limit.
- `rules`: up to 24 `{ x, label, color? }` vertical annotations.
- `regions`: up to 24 `{ from, to, color, opacity? }` shaded intervals; opacity is 0–1.
- `theme`: optional `background`, `foreground`, `grid`. Without overrides, labels follow the engine theme and the host supplies the background. Interactive controls follow the engine UI theme.

Colors are six-digit hex strings. Widths must be greater than 0 and at most 20 logical pixels. Dash arrays contain at most 8 positive lengths. `validateChartSpec(unknown)` validates JSON; compilation validates too. Invalid input throws `ChartValidationError` with a field `path`; unknown fields are rejected.

### Digital signals and independent lanes

```ts
const trace = {
  id: 'req', label: 'req', color: '#639b80',
  interpolation: 'step-after' as const,
  lane: { min: 0, max: 1, top: 0.1, bottom: 0.4 },
  data: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
};
```

`interpolation` defaults to `linear`. `step-after` holds each value until the next timestamp; cursor sampling uses the same rule. Include a final sample to close the capture interval. No value is extrapolated outside the data domain or across nulls/gaps.

A lane has an independent value domain (`min < max`) and plot bounds (`0 <= top <= bottom <= 1`, top to bottom). Values are clamped visually to the lane while tooltip values remain unchanged. When all series have lanes, names replace numeric Y ticks. Equal top/bottom values produce a horizontal strip while preserving original sample values for inspection.

### Per-point styles

Points can include `width` and `color`. These override the series style for the outgoing interval until the next point. Styles hold constant within each interval; widths do not taper. Each styled interval restarts its dash pattern. These fields can encode cloud cover, confidence, load, or signal quality without adding domain-specific drawing code.

## Optional controls

Set `controls: false` for a static chart. Otherwise, `zoom`, `pan`, `cursor`, and `tooltip` each default to true:

- `zoom`: top ScaleRuler, Ctrl + wheel, and touch pinch.
- `pan`: plot dragging, ordinary wheel, and one-finger pan.
- `cursor`: bottom ScaleRuler and crosshair.
- `tooltip`: readings while dragging the cursor; requires cursor.
- `minWindow`: minimum visible span in X units (milliseconds for time axes). Defaults to one twelfth of the domain, or the smaller initial window.
- `initialWindow`: initial span, aligned to the right edge; defaults to the full domain. Explicit windows must be positive and fit the domain; initialWindow must be at least minWindow.

Hidden rulers free plot space. Axis labels remain when the cursor is hidden. Runtime `interactive: false` overrides all controls and renders the full domain. The specification remains JSON; callbacks belong to runtime options.

## Lifecycle and React

`compileChart(spec, layout, options)` returns `ChartView`, composed from existing `LineSeries`, `ScreenContainer`, and `TimelineChartChrome` elements. `interactive` defaults to true; `responsive` defaults to false. Responsive views follow the engine canvas size with a minimum 320 × 280 layout. Allow more height for controls and long legends.

- `view.setSpec(nextSpec)` validates/rebuilds and resets the visible window.
- `view.resize(width, height)` updates explicit sizing and resets the window.
- `view.timeline?.getState()` returns cursor and viewport state when controls exist.
- `onStateChange(state)` reports range and cursor changes.
- `engine.destroy()` releases the view and listeners. To remove it separately, call `view.destroy()` and remove it from `engine.children`.

React consumers can add the view in a stable `LunaTerraCanvas` `onCreate` callback from `@lunaterra/react`. The adapter owns engine creation and cleanup. See the docs app's **Declarative API → Chart API** for a complete component and interactive control switches.

## Examples and server rendering

The docs **Charts** section includes **Weather forecast**, **Signal scope**, and **Historic temperatures**. The forecast and scope both use this generic compiler. Each offers downloadable input.

```ts
import { renderChart } from '@lunaterra/ground-crew';
const image = await renderChart(spec, { width: 900, height: 420 });
```

See the [Ground Crew guide](../ground-crew/README.md) for Express and native Canvas2D examples.
