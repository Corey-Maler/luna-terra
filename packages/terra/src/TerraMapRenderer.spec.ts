import { describe, expect, it } from 'vitest';
import { V3 } from '@lunaterra/math';
import { TerraMapRenderer } from './TerraMapRenderer';

describe('TerraMapRenderer road ribbons', () => {
  it('expands a line into a three-pixel minimum road surface and wider casing', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      roadRibbonPoints: (
        group: { points: Float32Array; offsets: number[]; sizes: number[] },
        frame: unknown,
        widthMeters: number,
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

    const surface = renderer.roadRibbonPoints(group, frame, 1.5);
    const casing = renderer.roadRibbonPoints(group, frame, 1.5, 1);

    expect(surface).toHaveLength(18);
    expect(Math.abs(surface[1] - surface[4])).toBeCloseTo(0.03);
    expect(Math.abs(casing[1] - casing[4])).toBeCloseTo(0.05);
  });

  it('biases road casing and fill ahead of coplanar terrain', () => {
    const renderer = new TerraMapRenderer() as unknown as {
      renderRoads: (renderer: unknown, group: unknown, feature: unknown, frame: unknown) => void;
    };
    const depthBiases: number[] = [];
    const frame = {
      surface: 'plane',
      pixelsPerLocalUnit: 100,
      projectPoint: (x: number, y: number) => new V3(x, y, 0),
      surfaceNormal: () => new V3(0, 0, 1),
    };

    renderer.renderRoads(
      {
        webgl3d: {
          drawTriangles: (...args: unknown[]) => depthBiases.push(
            (args[4] as { polygonOffsetUnits: number }).polygonOffsetUnits,
          ),
        },
      },
      { points: new Float32Array([0.25, 0.5, 0.75, 0.5]), offsets: [0], sizes: [2] },
      { kind: 'road', name: 'residential' },
      frame,
    );

    expect(depthBiases).toEqual([-80, -81]);
  });
});
