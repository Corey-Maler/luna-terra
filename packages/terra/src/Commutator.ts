import type { MapyGeometry } from './types/Mapy';
import { LegacyJsonTileClient, type TerraTileClient } from './TileClient';

export class CommutatorClient {
  private readonly tileClient: TerraTileClient;

  constructor(tileClientOrBaseUrl?: TerraTileClient | string) {
    this.tileClient = typeof tileClientOrBaseUrl === 'string' || tileClientOrBaseUrl === undefined
      ? new LegacyJsonTileClient(tileClientOrBaseUrl)
      : tileClientOrBaseUrl;
  }

  public request = async (index: number, level: number): Promise<MapyGeometry[]> => {
    return await this.tileClient.getTile(level, String(index)) ?? [];
  };
}
