import type { MapyGeometry } from './types/Mapy';
import { LegacyJsonTileClient, type TerraTileClient } from './TileClient';
import { tileIndexToString, type TileIndex } from './TileIndex';

export class CommutatorClient {
  private readonly tileClient: TerraTileClient;

  constructor(tileClientOrBaseUrl?: TerraTileClient | string) {
    this.tileClient = typeof tileClientOrBaseUrl === 'string' || tileClientOrBaseUrl === undefined
      ? new LegacyJsonTileClient(tileClientOrBaseUrl)
      : tileClientOrBaseUrl;
  }

  public request = async (index: TileIndex, level: number): Promise<MapyGeometry[] | null> => {
    return await this.tileClient.getTile(level, tileIndexToString(index));
  };
}
