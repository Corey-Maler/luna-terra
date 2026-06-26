import { GeometryClient } from './Geometry';
import { isGeometryEnclosed } from './GeometryHelpers';
import type { TileIndex } from './TileIndex';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – earcut v3 ships without bundled type declarations
import earcut from 'earcut';

export interface OptimizedLines {
  typeid: number;
  points: Float32Array;
  offsets: number[];
  sizes: number[];
}

export interface OptimizedArea {
  typeid: number;
  points: Float32Array;
  triangles: Uint16Array | Uint32Array;
  area: true;
}

export type OptimizedGroup = OptimizedLines | OptimizedArea;

export interface GeometryCollectionSource {
  level: number;
  index: TileIndex;
}

export class GeometryCollection {
  geometry: GeometryClient[];
  optimizedGroups: OptimizedGroup[] = [];
  source?: GeometryCollectionSource;

  constructor(geom: GeometryClient[], source?: GeometryCollectionSource) {
    this.geometry = geom;
    this.source = source;
    this.optimizeForWebGL();
  }

  public filterByTypeIds(typeIds: ReadonlySet<number>) {
    return new GeometryCollection(
      this.geometry.filter((geometry) => typeIds.has(geometry.typeid)),
      this.source,
    );
  }

  private groupByType() {
    const grouped = new Map<number, GeometryClient[]>();
    for (const geometry of this.geometry) {
      if (!grouped.has(geometry.typeid)) {
        grouped.set(geometry.typeid, []);
      }
      grouped.get(geometry.typeid)!.push(geometry);
    }
    return grouped;
  }

  private optimizeForWebGL() {
    const grouped = this.groupByType();
    grouped.forEach((value, key) => {
      if (isGeometryEnclosed(key)) {
        const optimized = value.map((geometry) => this.optimizeArea(geometry.typeid, geometry));
        this.optimizedGroups.push(...optimized);
      } else {
        this.optimizedGroups.push(this.optimizeGroup(key, value));
      }
    });
  }

  private optimizeArea(typeid: number, geometry: GeometryClient): OptimizedArea {
    const count = geometry.points.length;
    const optimized = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      optimized[i * 2] = geometry.points[i].x;
      optimized[i * 2 + 1] = geometry.points[i].y;
    }
    const triangleIndices = earcut(optimized);
    const triangles = count > 65535
      ? new Uint32Array(triangleIndices)
      : new Uint16Array(triangleIndices);
    return { typeid, points: optimized, triangles, area: true };
  }

  private optimizeGroup(typeid: number, geometries: GeometryClient[]): OptimizedLines {
    let totalCount = 0;
    const offsets: number[] = [];
    const sizes: number[] = [];

    for (const geometry of geometries) {
      totalCount += geometry.points.length;
    }

    const optimized = new Float32Array(totalCount * 2);
    let offset = 0;

    for (const geometry of geometries) {
      for (let i = 0; i < geometry.points.length; i++) {
        optimized[offset * 2 + i * 2] = geometry.points[i].x;
        optimized[offset * 2 + i * 2 + 1] = geometry.points[i].y;
      }
      offsets.push(offset);
      sizes.push(geometry.points.length);
      offset += geometry.points.length;
    }

    return { typeid, points: optimized, offsets, sizes };
  }
}
