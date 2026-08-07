import type { V2 } from '@lunaterra/math';

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
  label?: TerraPlaceLabelMetadata;
}

export interface TerraPlaceLabelMetadata {
  text: string;
  kind: 'city' | 'town' | 'village' | 'road';
}

export interface TerraPlaceLabel extends TerraPlaceLabelMetadata {
  x: number;
  y: number;
  /** The decoded source line for labels that should follow a road. */
  path?: V2[];
}
