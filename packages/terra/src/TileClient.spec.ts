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
});

describe('TerraTileStoreClient', () => {
  it('requests the tile-store server path', async () => {
    const fetchMock = mockFetch([]);
    const client = new TerraTileStoreClient('http://tiles');

    await client.getTile(2, '131074');

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/tiles/2/131074');
  });

  it('requests manifest from the tile-store server', async () => {
    const fetchMock = mockFetch({
      version: 1,
      projection: 'local-raw-latlon',
      tileIndex: 'packed-xy-v1',
      maxLevel: 10,
      levels: [],
    });
    const client = new TerraTileStoreClient('http://tiles');

    const manifest = await client.getManifest();

    expect(fetchMock).toHaveBeenCalledWith('http://tiles/manifest');
    expect(manifest?.version).toBe(1);
  });
});
