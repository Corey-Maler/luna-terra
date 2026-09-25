import { describe, expect, it } from 'vitest';
import type { CanvasRenderer } from '@lunaterra/core';
import { compileChart, sampleSeries } from './compile';
import type { ChartSpec } from './schema';
const emptyChart = (): ChartSpec => ({ schemaVersion: 1, title: 'Time series', x: { type: 'time', min: 0, max: 72 * 3_600_000 }, y: { label: 'Values' }, series: [] });
import type { ChartSeries } from './schema';

const series: ChartSeries = {
  id: 'observed', label: 'Observed', color: '#cf823d', maxGapX: 2,
  data: [{ x: 0, y: 10 }, { x: 1, y: 12 }, { x: 2, y: null }, { x: 3, y: 14 }, { x: 8, y: 20 }],
};

describe('reusable chart view', () => {
  it('does not interpolate tooltip values across gaps or outside provenance', () => {
    expect(sampleSeries(series, 0.5)).toBe(11);
    for (const x of [-1, 1.5, 2, 2.5, 4, 9]) expect(sampleSeries(series, x)).toBeNull();
    expect(sampleSeries(series, 8)).toBe(20);
  });

  it('shares a scene with a timeline in the browser and without UI for static output', () => {
    const spec = emptyChart();
    const layout = { width: 800, height: 420, pixelRatio: 1 };
    const view = compileChart(spec, layout);
    expect(view.timeline?.getState().windowSize).toBe(72 * 3_600_000);
    view.resize(400, 420);
    expect(view.options.width).toBe(400);
    const next = { ...spec, x: { ...spec.x, min: spec.x.min + 24 * 3_600_000 } };
    view.setSpec(next);
    expect(view.timeline?.getState().windowMin).toBe(next.x.min);
    expect(compileChart(spec, layout, { interactive: false }).timeline).toBeUndefined();
    view.destroy();
  });
});

it('samples stepped signals at and between transitions without inventing intermediate logic levels', () => {
  const signal: ChartSeries = { ...series, interpolation: 'step-after' };
  expect(sampleSeries(signal, 0.5)).toBe(10);
  expect(sampleSeries(signal, 1)).toBe(12);
  expect(sampleSeries(signal, 1.5)).toBeNull();
  expect(sampleSeries(signal, 5)).toBeNull();
});

it('configures controls independently and lets static rendering override the viewport', () => {
  const spec = emptyChart();
  spec.controls = { zoom: false, pan: false, cursor: true, tooltip: false, minWindow: 3_600_000, initialWindow: 6 * 3_600_000 };
  const layout = { width: 800, height: 420, pixelRatio: 1 };
  const view = compileChart(spec, layout);
  expect(view.timeline?.getState().windowMin).toBe(spec.x.max - 6 * 3_600_000);
  expect(view.timeline?.children?.map(child => child.constructor.name)).toEqual(['ScaleRuler']);
  expect(view.timeline?.options.tooltip).toBeUndefined();
  expect(compileChart(spec, layout, { interactive: false }).timeline).toBeUndefined();
  expect(compileChart({ ...spec, controls: false }, layout).timeline).toBeUndefined();
  expect(compileChart({ ...spec, controls: { zoom: false, pan: false, cursor: false } }, layout).timeline).toBeUndefined();
});

  it('survives the small initial canvas size before a responsive host is measured', () => {
  const spec = emptyChart();
  spec.series = [0, 1, 2].map(i => ({ id: String(i), label: String(i), color: '#8295ad', data: [] }));
  const view = compileChart(spec, { width: 800, height: 440, pixelRatio: 1 }, { responsive: true });
  expect(() => view.compute({ width: 1, height: 1, hdpi: 1 } as CanvasRenderer)).not.toThrow();
  view.compute({ width: 747, height: 440, hdpi: 1 } as CanvasRenderer);
  expect(view.options.width).toBe(747);
  expect(view.options.height).toBe(440);
  view.destroy();
});

it('compiles a compact static chart layout', () => {
  const view = compileChart(emptyChart(), { width: 445, height: 95, pixelRatio: 1 }, { interactive: false });
  expect(view.options.width).toBe(445);
  expect(view.options.height).toBe(95);
  view.destroy();
});

it('keeps compact charts legible with range and time labels', () => {
  const spec = emptyChart();
  spec.y = { label: 'Temperature' };
  spec.series = [{ id: 'temperature', label: 'Temperature', color: '#2563EB', unit: '°C', data: [{ x: 0, y: 8 }, { x: 36 * 3_600_000, y: 16 }] }];
  spec.rules = [{ x: 0, label: '12:00' }, { x: 24 * 3_600_000, label: '12:00' }, { x: 12 * 3_600_000, label: 'Sunrise', marker: 'sunrise' }];
  const view = compileChart(spec, { width: 445, height: 95, pixelRatio: 1 }, { interactive: false });
  const texts = view.children?.filter((child) => child.constructor.name === 'TextElement').map((child) => (child as { options: { text: string } }).options.text);
  expect(texts).toEqual(expect.arrayContaining(['8°C', '16°C', '12:00']));
  view.destroy();
});
