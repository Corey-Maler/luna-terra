import { afterEach, describe, expect, it, vi } from 'vitest';
import { LazyQuadTree, type LazyQuadTreeContext } from './LazyQuadTree';
import { TerraTileStoreClient } from './TileClient';
import type { MapyGeometry } from './types/Mapy';

function makeContext(
  request: LazyQuadTreeContext['commutator']['request'],
): LazyQuadTreeContext {
  return {
    commutator: { request } as unknown as LazyQuadTreeContext['commutator'],
    engine: {
      requestUpdate: vi.fn(),
      renderer: { rectToScreen: () => ({ width: 128 }) },
    } as unknown as LazyQuadTreeContext['engine'],
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['network', 'HTTP 500'])('recovers from %s errors after backoff without caching a missing tile', async (failure) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('offline'));
    else fetchMock.mockResolvedValueOnce({ status: 500, ok: false });
    fetchMock.mockResolvedValue({ status: 200, ok: true, json: async () => [lineGeometry()] });
    vi.stubGlobal('fetch', fetchMock);
    const client = new TerraTileStoreClient('http://tiles');
    const context = makeContext((index, level) => client.getTile(level, String(index)));
    const root = LazyQuadTree.generate(context);

    await root.fetch();
    expect(root.fulfilled).toBe(false);
    expect(root.missing).toBe(false);
    await root.fetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(context.engine.requestUpdate).mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.engine.requestUpdate).toHaveBeenCalledOnce();
    await root.fetch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(root.getGeometryForTile(0, 0)?.geometry).toHaveLength(1);
    expect(root.fulfilled).toBe(true);
    expect(root.missing).toBe(false);
  });

  it('continues to cache confirmed missing tiles without scheduling retries', async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValue(null);
    const root = LazyQuadTree.generate(makeContext(request));
    await root.fetch();
    await vi.advanceTimersByTimeAsync(30_000);
    await root.fetch();
    expect(request).toHaveBeenCalledOnce();
    expect(root.fulfilled).toBe(true);
    expect(root.missing).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

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

  it('separates annotated place labels from WebGL geometry', async () => {
    const request = vi.fn(() => Promise.resolve([{
      typeId: 702,
      points: { lats: [32768], lons: [16384] },
      label: { text: 'Tórshavn', kind: 'town' },
    } satisfies MapyGeometry]));
    const root = LazyQuadTree.generate(makeContext(request));

    await root.fetch();

    expect(root.getGeometryForTile(0, 0)?.geometry).toEqual([]);
    expect(root.getLabelsForArea(root.boundaries)).toEqual([{
      text: 'Tórshavn',
      kind: 'town',
      x: expect.closeTo(0.25, 4),
      y: expect.closeTo(0.5, 4),
    }]);
  });

  it('keeps annotated road geometry and exposes its decoded path for label placement', async () => {
    const request = vi.fn(() => Promise.resolve([{
      ...lineGeometry(),
      label: { text: 'Ektorpsvägen', kind: 'road' },
    } satisfies MapyGeometry]));
    const root = LazyQuadTree.generate(makeContext(request));

    await root.fetch();

    expect(root.getGeometryForTile(0, 0)?.geometry).toHaveLength(1);
    expect(root.getLabelsForArea(root.boundaries)[0]).toMatchObject({
      text: 'Ektorpsvägen',
      kind: 'road',
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    });
  });
});
