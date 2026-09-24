import { describe, expect, it } from 'vitest';
import { compileChart, validateChartSpec, type ChartSpec } from './index';

const chart: ChartSpec = {
  schemaVersion: 1, title: 'Logic capture',
  x: { type: 'number', min: 0, max: 100, label: 'ns' }, y: { label: 'Logic' },
  series: [{ id: 'req', label: 'req', color: '#639b80', interpolation: 'step-after',
    lane: { min: 0, max: 1, top: 0.1, bottom: 0.4 },
    data: [{ x: 0, y: 0 }, { x: 20, y: 1, width: 4, color: '#e8b323' }, { x: 100, y: 0 }] }],
};

describe('generic chart JSON', () => {
  it('round-trips lanes, interval styles, and controls for browser and static scenes', () => {
    const spec = validateChartSpec(JSON.parse(JSON.stringify({ ...chart, controls: { minWindow: 10, initialWindow: 40 } })));
    for (const interactive of [true, false]) {
      const view = compileChart(spec, { width: 800, height: 420, pixelRatio: 1 }, { interactive });
      expect(Boolean(view.timeline)).toBe(interactive);
      view.destroy();
    }
  });
  it.each([
    { controls: true }, { controls: { zoom: 'yes' } }, { controls: { minWindow: 0 } },
    { controls: { initialWindow: 101 } }, { controls: { minWindow: 50, initialWindow: 20 } },
    { series: [{ ...chart.series[0], lane: { min: 0, max: 1, top: 0.5, bottom: 0.2 } }] },
    { series: [{ ...chart.series[0], lane: { min: 1, max: 1, top: 0, bottom: 1 } }] },
    { series: [{ ...chart.series[0], data: [{ x: 0, y: 1, width: 21 }] }] },
    { series: [{ ...chart.series[0], data: [{ x: 0, y: 1, color: 'yellow' }] }] },
    { series: [{ ...chart.series[0], interpolation: 'spline' }] },
  ])('rejects unsupported or unsafe options: %j', patch => {
    expect(() => validateChartSpec({ ...chart, ...patch })).toThrow();
  });
});
