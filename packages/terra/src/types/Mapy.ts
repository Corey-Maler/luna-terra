export interface TilePoints {
  lats: number[];
  lons: number[];
}

export interface LegacySinglePrecisionPoints {
  lats8: number[];
  lons8: number[];
}

export interface LegacyDoublePrecisionPoints {
  lats16: number[];
  lons16: number[];
}

export interface MapyGeometry {
  typeId: number;
  points: TilePoints | LegacySinglePrecisionPoints | LegacyDoublePrecisionPoints;
}
