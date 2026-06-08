import type { MapyGeometry } from './types/Mapy';

const DEFAULT_TILE_BASE_URL = 'http://localhost:11111';

export class CommutatorClient {
  constructor(private baseUrl = DEFAULT_TILE_BASE_URL) {}

  public request = async (index: number, level: number): Promise<MapyGeometry[]> => {
    const data = await fetch(`${this.baseUrl}/${level}/${index}.json`);
    if (data.status >= 300) {
      return [];
    }
    return data.json();
  };
}
