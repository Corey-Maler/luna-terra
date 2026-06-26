import { describe, expect, it, vi, afterEach } from 'vitest';
import { LegacyJsonTileClient, TerraTileStoreClient } from './TileClient';

const mockFetch = (body: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const mockFetchStatus = (status: number) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const mockFetchReject = () => {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LegacyJsonTileClient', () => {
  it('requests the legacy static JSON path', async () => {
    const fetchMock = mockFetch([]);
    const client = new LegacyJsonTileClient('http://tiles');

    await client.getTile(2, '131074');

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/2/131074.json');
  });

  it('treats missing legacy JSON tiles as empty', async () => {
    mockFetchStatus(404);
    const client = new LegacyJsonTileClient('http://tiles');

    await expect(client.getTile(2, '131074')).resolves.toBeNull();
  });

  it('treats rejected legacy tile fetches as empty', async () => {
    mockFetchReject();
    const client = new LegacyJsonTileClient('http://tiles');

    await expect(client.getTile(2, '131074')).resolves.toBeNull();
  });
});

describe('TerraTileStoreClient', () => {
  it('requests the tile-store server path', async () => {
    const fetchMock = mockFetch([]);
    const client = new TerraTileStoreClient('http://tiles');

    await client.getTile(2, '131074');

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/tiles/2/131074');
  });

  it('treats missing tile-store tiles as empty', async () => {
    mockFetchStatus(404);
    const client = new TerraTileStoreClient('http://tiles');

    await expect(client.getTile(2, '131074')).resolves.toBeNull();
  });

  it('treats rejected tile-store tile fetches as empty', async () => {
    mockFetchReject();
    const client = new TerraTileStoreClient('http://tiles');

    await expect(client.getTile(2, '131074')).resolves.toBeNull();
  });

  it('requests manifest from the tile-store server', async () => {
    const fetchMock = mockFetch({
      version: 1,
      projection: 'web-mercator-north-up',
      tileIndex: 'morton-u64-v1',
      maxLevel: 16,
      bounds: {
        minX: 0.25,
        minY: 0.5,
        maxX: 0.75,
        maxY: 0.9,
      },
      levels: [
        {
          level: 0,
          indexFile: 'level-0.index.bin',
          dataFile: 'level-0.data.bin',
          tileCount: 1,
          dataFormat: 'binary-json-geometry-v1',
        },
      ],
    });
    const client = new TerraTileStoreClient('http://tiles');

    const manifest = await client.getManifest();

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/manifest');
    expect(manifest?.version).toBe(1);
  });

  it('treats rejected manifest fetches as unavailable', async () => {
    mockFetchReject();
    const client = new TerraTileStoreClient('http://tiles');

    await expect(client.getManifest()).resolves.toBeNull();
  });

  it('requests tile diagnostics from the tile-store server', async () => {
    const fetchMock = mockFetch({
      level: 2,
      index: 7,
      centerLonDegrees: -10,
      centerLatDegrees: 64,
      latitudeScale: 0.438,
      simplificationScale: 2.283,
      rdpScreenErrorPx: 0.45,
      rdpEpsilon: 263.1,
      coastlineRdpEpsilon: 1169.6,
      waterwayRdpEpsilon: 876.9,
      quantizedUnitsPerPixel: 584.8,
      nominalPixels: 256,
      estimatedPixels: 112.1,
      geometryCount: 2,
      pointCount: 8,
      lineGeometryCount: 1,
      areaGeometryCount: 1,
      skippedAreaGeometryCount: 3,
      skippedAreaPointCount: 12,
      skippedLineGeometryCount: 2,
      skippedLinePointCount: 4,
      typeStats: [
        { typeId: 101, geometries: 1, points: 4 },
      ],
    });
    const client = new TerraTileStoreClient('http://tiles');

    const diagnostics = await client.getTileDiagnostics(2, '7');

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/tiles/2/7/debug');
    expect(diagnostics?.pointCount).toBe(8);
  });

  it('treats missing tile diagnostics as unavailable', async () => {
    mockFetchStatus(404);
    const client = new TerraTileStoreClient('http://tiles');

    await expect(client.getTileDiagnostics(2, '7')).resolves.toBeNull();
  });
});
