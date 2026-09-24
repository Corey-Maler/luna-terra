import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { compileChart, type ChartControls, type ChartSpec } from '@lunaterra/declarative';
import type { LunaTerraEngine } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

const data = Array.from({ length: 81 }, (_, i) => ({ x: i / 4, y: Math.sin(i / 5) * 1.5 + Math.cos(i / 11) * 0.4 }));
const chart: ChartSpec = {
  schemaVersion: 1, title: 'Sensor capture',
  x: { type: 'number', min: 0, max: 20, label: 's' },
  y: { min: -2.5, max: 2.5, label: 'Amplitude (V)' },
  series: [{ id: 'voltage', label: 'Voltage', color: '#639b80', unit: 'V', data }],
};
const source = `import { compileChart, type ChartSpec } from '@lunaterra/declarative';

const spec: ChartSpec = {
  schemaVersion: 1, title: 'Sensor capture',
  x: { type: 'number', min: 0, max: 20, label: 's' },
  y: { min: -2.5, max: 2.5, label: 'Amplitude (V)' },
  controls: { zoom: true, pan: true, cursor: true, tooltip: true, minWindow: 2 },
  series: [{
    id: 'voltage', label: 'Voltage', color: '#639b80', unit: 'V',
    data: Array.from({ length: 81 }, (_, i) => ({
      x: i / 4, y: Math.sin(i / 5) * 1.5 + Math.cos(i / 11) * 0.4,
    })),
  }],
};
engine.interactive = false; // The chart owns pan and zoom.
const view = compileChart(spec, { width: 800, height: 420, pixelRatio: 1 },
  { responsive: true });
engine.add(view);`;

export default function DeclarativePage() {
  const [enabled, setEnabled] = useState(true);
  const [controls, setControls] = useState<ChartControls>({ zoom: true, pan: true, cursor: true, tooltip: true, minWindow: 2 });
  const buildScene = useCallback((engine: LunaTerraEngine) => {
    engine.interactive = false;
    const view = compileChart({ ...chart, controls: enabled ? controls : false }, { width: 800, height: 420, pixelRatio: 1 }, { responsive: true });
    engine.add(view);
    return view;
  }, [enabled, controls]);
  return <DocPage title="Chart API" section="@lunaterra/declarative">
    <p>Describe a chart with data, axes, series, and optional controls. The same JSON specification produces an interactive Luna-Terra canvas in the browser and a PNG through Ground Crew.</p>
    <DocPage.Section id="chart" title="A chart with optional controls">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBlock: 16 }}>
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable controls</label>
        {(['zoom', 'pan', 'cursor', 'tooltip'] as const).map(key => <label key={key}>
          <input type="checkbox" checked={controls[key] !== false} disabled={!enabled} onChange={e => setControls(current => ({ ...current, [key]: e.target.checked }))} /> {key[0].toUpperCase() + key.slice(1)}
        </label>)}
      </div>
      <p>Try the switches, then drag the top ruler to zoom, the plot to pan, or the bottom caret to inspect a reading. Ctrl + wheel zooms; touch supports pan and pinch. Zoom in before panning a full-range chart.</p>
      <LiveCodeScene buildScene={buildScene} defaultConfig={{}} source={source} canvasHeight={420} zoom={false} scrollBounds={null} />
      <p>The example source enables all controls. The switches change the corresponding <code>spec.controls</code> fields and rebuild the live view.</p>
    </DocPage.Section>
    <DocPage.Section id="schema" title="ChartSpec reference">
      <DocPage.Pre>{`pnpm add @lunaterra/declarative @lunaterra/core
# For React: pnpm add @lunaterra/react`}</DocPage.Pre>
      <table><thead><tr><th>Field</th><th>Meaning</th></tr></thead><tbody>
        <tr><td><code>schemaVersion</code>, <code>title</code></td><td>Version 1 and the chart heading.</td></tr>
        <tr><td><code>x</code></td><td>Required type (number or time), min, max. Optional label, timeZone, locale. Time values use epoch milliseconds; time formatting defaults to UTC / en-GB.</td></tr>
        <tr><td><code>y</code></td><td>Required label; optional min and max. Unspecified bounds fit the data with padding. Lane series do not affect this axis.</td></tr>
        <tr><td><code>series</code></td><td>Up to 12 named series and 10,000 points total.</td></tr>
        <tr><td><code>rules</code></td><td>Vertical annotations: x, label, optional color. Up to 24.</td></tr>
        <tr><td><code>regions</code></td><td>Shaded X intervals: from, to, color, optional opacity (0–1). Up to 24.</td></tr>
        <tr><td><code>controls</code></td><td>False for a static chart, or individual controls described below. Omitted means all enabled.</td></tr>
        <tr><td><code>theme</code></td><td>Optional background, foreground, grid colors. Otherwise text follows the engine theme and the host supplies the background.</td></tr>
      </tbody></table>
      <p>Colors use six-digit hex strings. <code>validateChartSpec(unknown)</code> validates incoming JSON and returns a typed specification. <code>compileChart</code> validates too. Invalid input throws <code>ChartValidationError</code> with a field <code>path</code>; unknown fields are rejected.</p>
    </DocPage.Section>
    <DocPage.Section id="series" title="Lines, steps, lanes, and point styles">
      <table><thead><tr><th>Series field</th><th>Meaning</th></tr></thead><tbody>
        <tr><td><code>id</code>, <code>label</code>, <code>color</code>, <code>data</code></td><td>Required unique ID, legend/tooltip name, default color, and sorted samples with unique X values: {'{ x, y }'}. Null Y breaks the line.</td></tr>
        <tr><td><code>stroke</code></td><td>Optional width (greater than 0, at most 20 logical pixels) and dash array (up to 8 positive lengths). Defaults to width 2, solid.</td></tr>
        <tr><td><code>interpolation</code></td><td>Linear by default. Step-after holds the previous value until the next timestamp; both drawing and cursor sampling respect it.</td></tr>
        <tr><td><code>maxGapX</code></td><td>Positive maximum connected X interval. Larger gaps break drawing and tooltip sampling. Omitted means no gap limit.</td></tr>
        <tr><td><code>unit</code></td><td>Optional tooltip suffix, such as V, %, or °C.</td></tr>
        <tr><td><code>lane</code></td><td>Independent min/max value domain and top/bottom plot fractions (0–1). Values are clamped visually to the lane; tooltip values remain unchanged. Equal top/bottom creates a horizontal strip.</td></tr>
        <tr><td>Point <code>width</code>, <code>color</code></td><td>Optional overrides for the outgoing interval, holding that style until the next point. Width uses logical pixels (greater than 0, at most 20). Useful for cloud cover, quality, or confidence. Styling each interval restarts its dash pattern.</td></tr>
      </tbody></table>
      <p>When every series has a lane, the plot shows lane names instead of a shared numeric Y axis. Use separate lanes for digital traces, or mix an annotation strip with ordinary line series. The compiler composes the existing <code>LineSeries</code>, <code>ScreenContainer</code>, and <code>TimelineChartChrome</code> elements.</p>
      <p>See complete compositions in <Link to="/charts/signal-scope">Signal scope</Link> and <Link to="/charts/weather-forecast">Weather forecast</Link>. All rendering consumes the same <code>ChartSpec</code>.</p>
    </DocPage.Section>
    <DocPage.Section id="controls" title="Control configuration">
      <DocPage.Pre>{`controls: {
  zoom: true,      // Top ScaleRuler, Ctrl + wheel, and pinch zoom
  pan: true,       // Plot drag, wheel pan, and one-finger pan
  cursor: true,    // Bottom ScaleRuler and crosshair
  tooltip: true,   // Readings while dragging the cursor (requires cursor)
  minWindow: 2,    // Smallest visible span, in X units
  initialWindow: 8 // Optional: starts at the right end of the domain
}
// Or: controls: false`}</DocPage.Pre>
      <p>All four switches default to true. The default minimum span is one twelfth of the X domain (or the smaller initial window). The initial window defaults to the full domain. Explicit windows must be positive, fit the domain, and initialWindow must be at least minWindow. Time windows use milliseconds.</p>
      <p>Disabling zoom or cursor removes its ruler and frees plot space. Disabling cursor also disables its tooltip. The chart still draws axis labels when the cursor is hidden. Runtime <code>interactive: false</code> disables every control and renders the full domain, as Ground Crew does for PNG output.</p>
    </DocPage.Section>
    <DocPage.Section id="react" title="Mount and update in React">
      <p>Save your specification as <code>chart.json</code>. The React adapter owns the engine lifecycle; the chart owns the canvas controls.</p>
      <DocPage.Pre>{`import { useCallback } from 'react';
import { LunaTerraCanvas } from '@lunaterra/react';
import { compileChart, validateChartSpec } from '@lunaterra/declarative';
import payload from './chart.json';

export function Chart() {
  const onCreate = useCallback((engine) => {
    engine.interactive = false;
    const view = compileChart(validateChartSpec(payload),
      { width: 800, height: 420, pixelRatio: 1 },
      { responsive: true, onStateChange: state => {
        // state.windowMin, state.windowMax, state.cursorValue
      } },
    );
    engine.add(view);
  }, []);
  return <LunaTerraCanvas onCreate={onCreate}
    style={{ width: '100%', height: 420 }} aria-label="Sensor capture" />;
}`}</DocPage.Pre>
      <p>Without React, mount <code>LunaTerraEngine</code> in a sized host, append <code>engine.getHtmlElements()</code>, and add the compiled view. Destroy the engine when the host is removed.</p>
      <p><code>compileChart(spec, layout, options)</code> returns a reusable <code>ChartView</code>. Runtime options include <code>interactive</code> (true), <code>responsive</code> (false), and <code>onStateChange</code>. Layout contains width, height, pixelRatio, and optional fontFamily. Use at least 320 × 280 for a responsive host; 420 px height gives controls and a short legend room.</p>
      <DocPage.Pre>{`view.setSpec(nextSpec); // Validate and rebuild; resets visible window.
view.resize(960, 420);   // Explicit sizing; also resets visible window.
view.timeline?.getState(); // Current range and cursor, if controls exist.`}</DocPage.Pre>
      <p>Callbacks stay in runtime options; the specification is serializable. <code>engine.destroy()</code> releases the view. To remove it independently, call <code>view.destroy()</code> and remove it from <code>engine.children</code>.</p>
    </DocPage.Section>
    <DocPage.Section id="server" title="Render the same chart in Node">
      <DocPage.Pre>{`import { renderChart } from '@lunaterra/ground-crew';
const image = await renderChart(spec, { width: 900, height: 420 });
// image.bytes is a PNG Buffer.`}</DocPage.Pre>
      <p><Link to="/ground-crew/overview">Ground Crew</Link> documents Express integration, rendering options, and an interactive server preview.</p>
    </DocPage.Section>
  </DocPage>;
}
