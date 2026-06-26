import { describe, expect, it, vi } from 'vitest';
import { LazyQuadTree, type LazyQuadTreeContext } from './LazyQuadTree';
import type { MapyGeometry } from './types/Mapy';

function makeContext(
  request: LazyQuadTreeContext['commutator']['request'],
): LazyQuadTreeContext {
  return {
    commutator: { request } as unknown as LazyQuadTreeContext['commutator'],
    engine: { requestUpdate: vi.fn() } as unknown as LazyQuadTreeContext['engine'],
  };
}

function lineGeometry(): MapyGeometry {
  return {
    typeId: 1,
    points: {
      lats: [0, 65535],
      lons: [0, 65535],
    },
  };
}

describe('LazyQuadTree', () => {
  it('does not cache an empty parent collection while the parent is still loading', async () => {
    let resolveRoot!: (data: MapyGeometry[]) => void;
    const rootRequest = new Promise<MapyGeometry[]>((resolve) => {
      resolveRoot = resolve;
    });
    const request = vi.fn((_: number, level: number) => (
      level === 0 ? rootRequest : Promise.resolve(null)
    ));
    const root = LazyQuadTree.generate(makeContext(request));

    const fetchRoot = root.fetch();
    const childFallback = root.getGeometryForTile(0, 1);

    expect(childFallback).toBeUndefined();

    resolveRoot([lineGeometry()]);
    await fetchRoot;

    const rootCollection = root.getGeometryForTile(0, 0);

    expect(rootCollection?.geometry).toHaveLength(1);
    expect(root.getTileStatus(0, 0)).toMatchObject({
      loaded: true,
      loading: false,
      missing: false,
      geometryCount: 1,
    });
  });

  it('can disable parent fallback for exact tile rendering', async () => {
    const request = vi.fn((_: number, level: number) => (
      level === 0 ? Promise.resolve([lineGeometry()]) : Promise.resolve(null)
    ));
    const root = LazyQuadTree.generate(makeContext(request));

    await root.fetch();

    const childFallback = root.getGeometryForTile(0, 1);
    const childExact = root.getGeometryForTile(0, 1, { fallback: false });

    expect(childFallback?.source?.level).toBe(0);
    expect(childExact).toBeUndefined();
  });
});
