import { Rect2D, V2 } from '@lunaterra/math';
import type { MapyGeometry } from './types/Mapy';

export abstract class GeometryBase {
  id: number;
  typeid: number;

  constructor(id: number, typeid: number) {
    this.id = id;
    this.typeid = typeid;
  }
}

export class GeometryClient extends GeometryBase {
  points: V2[] = [];

  constructor(id: number, typeid: number) {
    super(id, typeid);
  }

  static deserialize(
    obj: MapyGeometry,
    origin: Rect2D,
    precision: 8 | 16
  ): GeometryClient {
    const geom = new GeometryClient(
      Math.random() * 100000000 + Math.random() * 100000000,
      obj.typeId
    );

    const points = obj.points;
    const resolution = 'lats' in points ? 65535 : 'lats8' in points ? 255 : 65535;
    const lats = 'lats' in points ? points.lats : 'lats8' in points ? points.lats8 : points.lats16;
    const lons = 'lons' in points ? points.lons : 'lons8' in points ? points.lons8 : points.lons16;
    const scaleX = origin.width;
    const scaleY = origin.height;
    const offsetX = origin.bottomLeft.x;
    const offsetY = origin.bottomLeft.y;

    geom.points = lats.map((lat, i) => new V2(
      (lons[i] / resolution) * scaleX + offsetX,
      (lat   / resolution) * scaleY + offsetY,
    ));

    return geom;
  }
}
