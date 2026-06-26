import { describe, expect, it } from 'vitest';
import { GeometryClient } from './Geometry';
import { GeometryCollection, type OptimizedArea } from './GeometryCollection';
import { LAND_MASK_TYPE_ID } from './helpers';
import { V2 } from '@lunaterra/math';

describe('GeometryCollection', () => {
  it('uses 32-bit triangle indices for large land-mask polygons', () => {
    const geometry = new GeometryClient(1, LAND_MASK_TYPE_ID);
    const pointCount = 70_000;
    geometry.points = Array.from({ length: pointCount }, (_, index) => {
      const angle = (index / pointCount) * Math.PI * 2;
      return new V2(
        0.5 + Math.cos(angle) * 0.45,
        0.5 + Math.sin(angle) * 0.45,
      );
    });

    const collection = new GeometryCollection([geometry]);
    const area = collection.optimizedGroups[0] as OptimizedArea;
    let maxIndex = 0;
    for (const index of area.triangles) {
      maxIndex = Math.max(maxIndex, index);
    }

    expect(area.triangles).toBeInstanceOf(Uint32Array);
    expect(maxIndex).toBeGreaterThan(65535);
  });
});
