export interface SinglePrecisionPoints {
  lats8: number[];
  lons8: number[];
}

export interface DoublePrecisionPoints {
  lats16: number[];
  lons16: number[];
}

export interface MapyGeometry {
  typeId: number;
  points: SinglePrecisionPoints | DoublePrecisionPoints;
}
