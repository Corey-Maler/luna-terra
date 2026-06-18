import type { MapyGeometry } from './types/Mapy';

export const DEFAULT_TILE_BASE_URL = 'http://localhost:11111';

export interface TerraManifestLevel {
  level: number;
  indexFile: string;
  dataFile: string;
  tileCount: number;
  dataFormat?: string;
}

export interface TerraManifest {
  version: number;
  projection: string;
  tileIndex: string;
  maxLevel: number;
  bounds?: TerraManifestBounds;
  levels: TerraManifestLevel[];
}

export interface TerraManifestBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TerraTileClient {
  getTile(level: number, index: string): Promise<MapyGeometry[] | null>;
  getManifest?(): Promise<TerraManifest | null>;
}

export class LegacyJsonTileClient implements TerraTileClient {
  constructor(private readonly baseUrl = DEFAULT_TILE_BASE_URL) {}

  async getTile(level: number, index: string): Promise<MapyGeometry[] | null> {
    const response = await fetchResponse(`${this.baseUrl}/${level}/${index}.json`);
    if (!response) {
      return null;
    }
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      return [];
    }
    return response.json();
  }
}

export class TerraTileStoreClient implements TerraTileClient {
  constructor(private readonly baseUrl = DEFAULT_TILE_BASE_URL) {}

  async getTile(level: number, index: string): Promise<MapyGeometry[] | null> {
    const response = await fetchResponse(`${this.baseUrl}/tiles/${level}/${index}`);
    if (!response) {
      return null;
    }
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      return [];
    }
    return response.json();
  }

  async getManifest(): Promise<TerraManifest | null> {
    const response = await fetchResponse(`${this.baseUrl}/manifest`);
    if (!response) {
      return null;
    }
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return response.json();
  }
}

async function fetchResponse(url: string) {
  try {
    return await fetch(url);
  } catch {
    return null;
  }
}
