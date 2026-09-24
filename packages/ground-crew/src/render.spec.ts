import { describe, expect, it } from 'vitest';
import { validateChartSpec } from '@lunaterra/declarative';
import { readFileSync } from 'node:fs';
const spec = validateChartSpec(JSON.parse(readFileSync(new URL('../examples/chart.json', import.meta.url), 'utf8')).chart);
import { renderChart, validateRenderOptions } from './index';

describe('Ground Crew render', () => {
  it('creates a PNG in Node without browser globals', async () => {
    expect(typeof window).toBe('undefined');
    const image = await renderChart(spec, { width: 600, height: 300, pixelRatio: 2 });
    expect(image.mimeType).toBe('image/png');
    expect([image.width, image.height]).toEqual([1200, 600]);
    expect(image.bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(image.bytes.length).toBeGreaterThan(5000);
  });

  it('rejects excessive allocation before creating a surface', () => {
    expect(() => validateRenderOptions({ width: 4096, height: 4096 })).toThrow(RangeError);
  });

  it('renders a nonweather numeric chart from the same specification', async () => {
    const image = await renderChart({
      schemaVersion: 1,
      title: 'Pressure',
      x: { type: 'number', min: 0, max: 3, label: 'Sample' },
      y: { label: 'kPa' },
      series: [{ id: 'pressure', label: 'Pressure', color: '#2586d4', data: [{ x: 0, y: 99 }, { x: 1, y: null }, { x: 2, y: 101 }, { x: 3, y: 100 }] }],
    }, { width: 600, height: 300 });
    expect(image.bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(image.metadata.summary).toContain('Pressure');
  });
});

it('renders interval widths, colors, and digital steps using the Node canvas', async () => {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const image = await renderChart({
    schemaVersion: 1, title: 'Styled lanes',
    x: { type: 'number', min: 0, max: 2 }, y: { label: 'Values' },
    series: [{ id: 'strip', label: 'Cover', color: '#8295ad',
      lane: { min: 0, max: 100, top: 0.25, bottom: 0.25 },
      data: [{ x: 0, y: 0, width: 2, color: '#e8b323' }, { x: 1, y: 100, width: 12 }, { x: 2, y: 100 }],
    }, { id: 'signal', label: 'Signal', color: '#639b80', interpolation: 'step-after',
      lane: { min: 0, max: 1, top: 0.5, bottom: 0.9 },
      data: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    }],
    theme: { background: '#ffffff', foreground: '#000000', grid: '#cccccc' },
  }, { width: 600, height: 300 });
  const canvas = createCanvas(600, 300), ctx = canvas.getContext('2d');
  ctx.drawImage(await loadImage(image.bytes), 0, 0);
  const count = (x: number, rgb: number[]) => {
    const pixels = ctx.getImageData(x, 85, 1, 140).data;
    let hits = 0;
    for (let i = 0; i < pixels.length; i += 4) if (rgb.every((value, j) => pixels[i + j] === value)) hits++;
    return hits;
  };
  expect(count(188, [232, 179, 35])).toBeGreaterThanOrEqual(1);
  expect(count(412, [130, 149, 173])).toBeGreaterThanOrEqual(10);
  // At x=0.5, step-after remains low near the bottom of its lane.
  const low = ctx.getImageData(188, 216, 1, 3).data;
  expect(Array.from(low).some((value, i) => i % 4 === 0 && value === 99)).toBe(true);
});
