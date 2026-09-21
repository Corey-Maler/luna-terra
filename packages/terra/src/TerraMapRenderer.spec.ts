import { describe, expect, it } from 'vitest';
import { V3 } from '@lunaterra/math';
import { TerraMapRenderer } from './TerraMapRenderer';

describe('TerraMapRenderer road ribbons', () => {
  it('expands a line into a three-pixel minimum road surface and wider casing', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      lineRibbonPoints: (
        group: { points: Float32Array; offsets: number[]; sizes: number[] },
        frame: unknown,
        widthMeters: number,
        minimumWidthPixels: number,
        casingPixels?: number,
      ) => Float32Array;
    };
    const group = {
      points: new Float32Array([0.25, 0.5, 0.75, 0.5]),
      offsets: [0],
      sizes: [2],
    };
    const frame = {
      surface: 'plane',
      pixelsPerLocalUnit: 100,
      projectPoint: (x: number, y: number) => new V3(x, y, 0),
      surfaceNormal: () => new V3(0, 0, 1),
    };

    const surface = renderer.lineRibbonPoints(group, frame, 1.5, 3);
    const casing = renderer.lineRibbonPoints(group, frame, 1.5, 3, 1);

    expect(surface).toHaveLength(18);
    expect(Math.abs(surface[1] - surface[4])).toBeCloseTo(0.03);
    expect(Math.abs(casing[1] - casing[4])).toBeCloseTo(0.05);
  });

  it('renders river and stream centerlines as width-scaled triangles above terrain', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      renderCollection: (renderer: unknown, collection: unknown, frame: unknown) => void;
    };
    const draws: { points: Float32Array; bias: number }[] = [];
    const frame = {
      surface: 'plane',
      pixelsPerLocalUnit: 100,
      projectPoint: (x: number, y: number) => new V3(x, y, 0),
      surfaceNormal: () => new V3(0, 0, 1),
    };
    const group = { points: new Float32Array([0.25, 0.5, 0.75, 0.5]), offsets: [0], sizes: [2] };
    renderer.renderCollection({
      webgl3d: {
        drawTriangles: (points: Float32Array, _color: string, _camera: unknown, _model: unknown, options: { polygonOffsetUnits: number }) => {
          draws.push({ points, bias: options.polygonOffsetUnits });
        },
        drawLineStrips: () => { throw new Error('Waterways must not use native lines'); },
      },
    }, { optimizedGroups: [{ ...group, typeid: 400 }, { ...group, typeid: 401 }] }, frame);

    expect(draws).toHaveLength(2);
    expect(draws[0].points).toHaveLength(18);
    expect(Math.abs(draws[0].points[1] - draws[0].points[4])).toBeCloseTo(0.03);
    expect(Math.abs(draws[1].points[1] - draws[1].points[4])).toBeCloseTo(0.02);
    expect(draws.map(draw => draw.bias)).toEqual([-40, -40]);
  });

  it('keeps metre widths on the globe and a visible casing at close zoom', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      lineHalfWidth: (frame: unknown, y: number, meters: number, pixels: number, extra: number) => number;
    };
    const frame = { surface: 'globe', pixelsPerLocalUnit: 10_000_000 };
    const river = renderer.lineHalfWidth(frame, 0.5, 20, 3, 0);
    const stream = renderer.lineHalfWidth(frame, 0.5, 3, 2, 0);
    expect(river * 2).toBeCloseTo(20 / 6_371_008.8, 12);
    expect(river).toBeGreaterThan(stream);
    expect(renderer.lineHalfWidth(frame, 0.5, 20, 3, 2) - river).toBeCloseTo(2 / frame.pixelsPerLocalUnit, 12);
  });

  it('renders fill and casing in one ribbon ahead of terrain', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      renderRoads: (renderer: unknown, group: unknown, feature: unknown, frame: unknown) => void;
    };
    const depthBiases: number[] = [];
    const ribbons: Float32Array[] = [];
    const frame = {
      surface: 'plane',
      pixelsPerLocalUnit: 100,
      projectPoint: (x: number, y: number) => new V3(x, y, 0),
      surfaceNormal: () => new V3(0, 0, 1),
    };

    renderer.renderRoads(
      {
        webgl3d: {
          drawTriangles: () => { throw new Error('Roads must use one shader-colored ribbon'); },
          drawRibbon: (points: Float32Array, fill: string, border: string, _camera: unknown, _model: unknown, options: { polygonOffsetUnits: number }) => {
            ribbons.push(points);
            depthBiases.push(options.polygonOffsetUnits);
            expect(fill).toBe('#ffffff');
            expect(border).toBe('#d8d5cd');
          },
        },
      },
      { points: new Float32Array([0.25, 0.5, 0.75, 0.5]), offsets: [0], sizes: [2] },
      { kind: 'road', name: 'residential' },
      frame,
    );

    expect(depthBiases).toEqual([-80]);
    expect(ribbons).toHaveLength(1);
    expect(ribbons[0]).toHaveLength(30);
    expect(Math.abs(ribbons[0][1] - ribbons[0][6])).toBeCloseTo(0.05);
    expect([0, 1, 2, 3, 4, 5].map(i => ribbons[0][i * 5 + 3])).toEqual([-1, 1, -1, 1, 1, -1]);
    for (let i = 0; i < 6; i += 1) {
      expect(ribbons[0][i * 5 + 4]).toBeCloseTo(3 / 5);
    }
  });
});
