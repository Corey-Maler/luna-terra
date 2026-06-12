import { GeometryClient } from './Geometry';
import { isGeometryEnclosed } from './GeometryHelpers';

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
  triangles: Uint16Array;
  area: true;
}

export type OptimizedGroup = OptimizedLines | OptimizedArea;

export interface GeometryCollectionSource {
  level: number;
  index: number;
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
    for (const [key, value] of grouped.entries()) {
      if (isGeometryEnclosed(key)) {
        const optimized = value.map((g) => this.optimizeArea(g.typeid, g));
        this.optimizedGroups.push(...optimized);
      } else {
        this.optimizedGroups.push(this.optimizeGroup(key, value));
      }
    }
  }

  private optimizeArea(typeid: number, geometry: GeometryClient): OptimizedArea {
    const count = geometry.points.length;
    const optimized = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      optimized[i * 2] = geometry.points[i].x;
      optimized[i * 2 + 1] = geometry.points[i].y;
    }
    const triangles = new Uint16Array(earcut(optimized));
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
