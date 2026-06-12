import type { MapyGeometry } from './types/Mapy';

export const DEFAULT_TILE_BASE_URL = 'http://localhost:11111';

export interface TerraManifestLevel {
  level: number;
  indexFile: string;
  dataFile: string;
  tileCount: number;
}

export interface TerraManifest {
  version: number;
  projection: string;
  tileIndex: string;
  maxLevel: number;
  levels: TerraManifestLevel[];
}

export interface TerraTileClient {
  getTile(level: number, index: string): Promise<MapyGeometry[] | null>;
  getManifest?(): Promise<TerraManifest | null>;
}

export class LegacyJsonTileClient implements TerraTileClient {
  constructor(private readonly baseUrl = DEFAULT_TILE_BASE_URL) {}

  async getTile(level: number, index: string): Promise<MapyGeometry[] | null> {
    const response = await fetch(`${this.baseUrl}/${level}/${index}.json`);
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
    const response = await fetch(`${this.baseUrl}/tiles/${level}/${index}`);
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      return [];
    }
    return response.json();
  }

  async getManifest(): Promise<TerraManifest | null> {
    const response = await fetch(`${this.baseUrl}/manifest`);
    if (response.status === 404 || response.status === 204) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return response.json();
  }
}
