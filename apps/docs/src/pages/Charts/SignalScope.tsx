import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { compileChart, type ChartSpec } from '@lunaterra/declarative';
import type { LunaTerraEngine } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

const signals = [
  { label: 'clk', color: '#bd863d', transitions: Array.from({ length: 63 }, (_, i) => (i + 1) * 10) },
  { label: 'reset_n', color: '#8499c2', transitions: [40] },
  { label: 'req', color: '#639b80', transitions: [92, 156, 244, 320, 416, 476] },
  { label: 'grant', color: '#9c89b9', transitions: [116, 156, 276, 320, 442, 476] },
  { label: 'valid', color: '#c28172', transitions: [136, 196, 294, 356, 454, 526] },
  { label: 'stall', color: '#6a9ea6', transitions: [170, 184, 482, 504] },
];

// A numeric chart with independently scaled lanes, using the same compiler as the forecast.
const spec: ChartSpec = {
  schemaVersion: 1,
  title: 'Bus signals',
  x: { type: 'number', min: 0, max: 640, label: 'ns' },
  y: { label: 'Logic levels · 0 / 1' },
  controls: { zoom: true, pan: true, cursor: true, tooltip: true, minWindow: 40 },
  series: signals.map((signal, i) => ({
    id: signal.label, label: signal.label, color: signal.color,
    interpolation: 'step-after',
    lane: { min: 0, max: 1, top: i / 6 + 0.02, bottom: (i + 1) / 6 - 0.04 },
    data: [
      { x: 0, y: 0 },
      ...signal.transitions.map((x, j) => ({ x, y: (j + 1) % 2 })),
      { x: 640, y: signal.transitions.length % 2 },
    ],
  })),
};

const source = `import { compileChart, type ChartSpec } from '@lunaterra/declarative';

const spec: ChartSpec = {
  schemaVersion: 1, title: 'Signal capture',
  x: { type: 'number', min: 0, max: 640, label: 'ns' },
  y: { label: 'Logic levels · 0 / 1' },
  controls: { zoom: true, pan: true, cursor: true, minWindow: 40 },
  series: [{
    id: 'req', label: 'req', color: '#639b80',
    interpolation: 'step-after',
    lane: { min: 0, max: 1, top: 0.1, bottom: 0.4 },
    data: [{ x: 0, y: 0 }, { x: 92, y: 1 },
           { x: 156, y: 0 }, { x: 640, y: 0 }],
  }, {
    id: 'grant', label: 'grant', color: '#9c89b9',
    interpolation: 'step-after',
    lane: { min: 0, max: 1, top: 0.6, bottom: 0.9 },
    data: [{ x: 0, y: 0 }, { x: 116, y: 1 },
           { x: 156, y: 0 }, { x: 640, y: 0 }],
  }],
};
engine.interactive = false;
engine.add(compileChart(spec, { width: 800, height: 480, pixelRatio: 1 },
  { responsive: true }));`;

export default function SignalScopePage() {
  const buildScene = useCallback((engine: LunaTerraEngine) => {
    engine.interactive = false;
    const view = compileChart(spec, { width: 800, height: 480, pixelRatio: 1 }, { responsive: true });
    engine.add(view);
    return view;
  }, []);
  return <DocPage title="Signal scope" section="Charts">
    <DocPage.Section id="scope" title="Inspect digital transitions">
      <p>Six signals share a numeric time axis. Zoom with the top ruler, pan the plot, and drag the bottom caret to inspect the logic levels. Ctrl + wheel zooms; touch supports pan and pinch.</p>
      <LiveCodeScene buildScene={buildScene} defaultConfig={{}} source={source} canvasHeight={480} zoom={false} scrollBounds={null} />
    </DocPage.Section>
    <DocPage.Section id="composition" title="Build a scope from a chart">
      <p><code>interpolation: 'step-after'</code> holds each value until the next timestamp, then draws its vertical transition. The cursor reports the held value, including the new value exactly at an edge. End each trace with a final sample at the capture boundary.</p>
      <p>A <code>lane</code> gives each signal an independent Y domain. Its <code>top</code> and <code>bottom</code> place it within the plot, from 0 at the top to 1 at the bottom. Tooltip values remain the original 0 or 1. Numeric X values and <code>minWindow</code> use your chosen unit, here nanoseconds.</p>
      <p>The demo contains no custom signal drawable. It uses <code>ChartSpec</code> and <code>compileChart</code>, like the <Link to="/charts/weather-forecast">weather forecast</Link>. See the <Link to="/declarative/overview">declarative API</Link> for the complete options, or send this specification to <Link to="/ground-crew/overview">Ground Crew</Link> for a PNG.</p>
      <p><a download="signal-scope.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ chart: spec, output: { width: 900, height: 480 } }, null, 2))}`}>Download the six-signal specification</a>.</p>
    </DocPage.Section>
  </DocPage>;
}
