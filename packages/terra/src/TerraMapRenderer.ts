import { Camera3D, type CanvasRenderer } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';
import { ResolutionByRoadType, getFeatureTypeById, type TerraFeatureType } from './helpers';
import type { GeometryCollection, OptimizedArea, OptimizedLines } from './GeometryCollection';
import type { TerraManifestBounds } from './TileClient';

export interface TerraMapRenderOptions {
  debugGrid?: boolean;
  debugTiles?: TerraDebugTile[];
  debugTileFill?: boolean;
  mapMode?: TerraMapMode;
  pitchDegrees?: number;
  sourceBounds?: TerraManifestBounds | null;
}

export type TerraMapMode = 'auto' | 'plane' | 'globe';
export type TerraMapSurface = 'plane' | 'globe' | 'unwrap';

export const TERRA_GLOBE_AUTO_MAX_ZOOM = 16;
export const TERRA_GLOBE_MAX_TILE_LEVEL = 5;
export const TERRA_UNWRAP_FULL_ZOOM = 512;

export function terraUnwrapAmount(zoom: number) {
  const start = Math.log2(TERRA_GLOBE_AUTO_MAX_ZOOM);
  const end = Math.log2(TERRA_UNWRAP_FULL_ZOOM);
  const t = (Math.log2(Math.max(zoom, 1)) - start) / Math.max(1e-6, end - start);
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export interface TerraDebugTile {
  level: number;
  index: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type TerraMapRenderFrame = {
  anchorWorld: { x: number; y: number };
  camera: Camera3D;
  modelMatrix: M4;
  surface: TerraMapSurface;
  unwrap: number;
  projectPoint: (x: number, y: number) => V3;
  globeDepth: (x: number, y: number) => number;
};

const TERRAIN_COLORS = {
  debug: '#666666',
  water: '#c5d2d9',
  vegetation: '#c7d0c6',
  airport: '#a8a5a0',
  building: '#8f8f8f',
  fallbackArea: '#cccccc',
  fallbackNaturalLine: '#aaaaaa',
  fallbackBuildingLine: '#bbbbbb',
  globe: '#f4f6f4',
};

const MAP_SURFACE_Z = 1.01;
const SPHERE_DRAW_MAX_UNWRAP = 0.08;
const TANGENT_SURFACE_Z = MAP_SURFACE_Z;
const TANGENT_CAMERA_ZOOM_SCALE = 12;
const TANGENT_CAMERA_MIN_GAP = 0.0000001;

const roadLodColors = [
  '#333333', '#444444', '#555555', '#666666', '#777777',
  '#888888', '#999999', '#aaaaaa', '#bbbbbb',
];

const waterFeatureNames = new Set([
  'coastline',
  'water',
  'river',
  'stream',
  'canal',
  'drain',
  'ditch',
  'riverbank',
  'reservoir',
  'basin',
]);

const vegetationFeatureNames = new Set([
  'wood',
  'forest',
  'scrub',
  'heath',
  'wetland',
  'tree_row',
  'grassland',
  'grass',
  'meadow',
  'farmland',
  'farmyard',
  'recreation_ground',
  'cemetery',
  'orchard',
  'vineyard',
]);

export class TerraMapRenderer {
  public readonly renderMode = 'core-3d-plane' as const;
  private globeSpherePointsCache: Float32Array | null = null;

  render(
    renderer: CanvasRenderer,
    collections: GeometryCollection[],
    options: TerraMapRenderOptions = {},
  ): TerraMapSurface {
    const frame = this.buildFrame(
      renderer,
      this.resolveMapSurface(renderer, options.mapMode ?? 'plane'),
      options.pitchDegrees ?? 0,
    );

    if (options.debugTileFill) {
      this.renderTileFill(renderer, collections, frame, options.debugTiles);
    } else {
      for (const collection of collections) {
        this.renderCollection(renderer, collection, frame);
      }
    }

    if (options.debugGrid) {
      this.renderDebugGrid(renderer, frame, options.sourceBounds ?? null);
    }

    return frame.surface;
  }

  public resolveMapSurface(renderer: CanvasRenderer, mapMode: TerraMapMode): TerraMapSurface {
    if (mapMode === 'auto') {
      return renderer.zoom <= TERRA_GLOBE_AUTO_MAX_ZOOM ? 'globe' : 'unwrap';
    }
    return mapMode;
  }

  private buildFrame(
    renderer: CanvasRenderer,
    mapMode: TerraMapSurface,
    pitchDegrees: number,
  ): TerraMapRenderFrame {
    const visibleArea = renderer.visibleArea;
    const anchorWorld = renderer.viewportCenter;
    const halfWidth = Math.abs(visibleArea.v2.x - visibleArea.v1.x) / 2;
    const halfHeight = Math.abs(visibleArea.v2.y - visibleArea.v1.y) / 2;
    const pitchRadians = Math.max(0, Math.min(75, pitchDegrees)) * Math.PI / 180;

    if (mapMode !== 'plane') {
      const unwrap = mapMode === 'unwrap' ? this.unwrapAmount(renderer.zoom) : 0;
      const projector = this.globeProjector(anchorWorld.x, anchorWorld.y);
      const tangentProjector = this.tangentProjector(anchorWorld.x, anchorWorld.y);
      return {
        anchorWorld,
        camera: this.globeCamera(renderer, unwrap),
        modelMatrix: M4.identity(),
        surface: mapMode,
        unwrap,
        globeDepth: (x, y) => projector(x, y, 1).z,
        projectPoint: (x, y) => {
          const globe = projector(x, y, MAP_SURFACE_Z);
          const tangent = tangentProjector(x, y, TANGENT_SURFACE_Z);
          return this.lerpV3(globe, tangent, unwrap);
        },
      };
    }

    return {
      anchorWorld,
      camera: pitchRadians === 0
        ? this.flatCamera(halfWidth, halfHeight)
        : this.pitchedCamera(halfWidth, halfHeight, renderer, pitchRadians),
      modelMatrix: M4.identity(),
      surface: 'plane',
      unwrap: 1,
      globeDepth: () => 1,
      projectPoint: (x, y) => new V3(x - anchorWorld.x, y - anchorWorld.y, 0),
    };
  }

  private flatCamera(halfWidth: number, halfHeight: number) {
    return new Camera3D({
      mode: 'orthographic',
      eye: new V3(0, 0, 1),
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      left: -halfWidth,
      right: halfWidth,
      bottom: -halfHeight,
      top: halfHeight,
      near: 0.1,
      far: 10,
    });
  }

  private pitchedCamera(
    halfWidth: number,
    halfHeight: number,
    renderer: CanvasRenderer,
    pitchRadians: number,
  ) {
    const fovYRadians = Math.PI / 4;
    const aspect = renderer.height === 0 ? 1 : renderer.width / renderer.height;
    const tanHalfFov = Math.tan(fovYRadians / 2);
    const distance = Math.max(halfHeight / tanHalfFov, halfWidth / (aspect * tanHalfFov));
    const eye = new V3(
      0,
      -Math.sin(pitchRadians) * distance,
      Math.cos(pitchRadians) * distance,
    );

    return new Camera3D({
      mode: 'perspective',
      eye,
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      fovYRadians,
      aspect,
      near: Math.max(distance * 0.001, 1e-7),
      far: Math.max(distance * 10, 1),
    });
  }

  private globeCamera(renderer: CanvasRenderer, unwrap = 0) {
    const aspect = renderer.height === 0 ? 1 : renderer.width / renderer.height;
    const normalizedZoom = Math.max(0, Math.log2(Math.max(renderer.zoom, 1)) / 12);
    const globeDistance = Math.max(1.45, 3.2 - normalizedZoom * 1.4);
    const tangentDistance =
      TANGENT_SURFACE_Z +
      Math.max(TANGENT_CAMERA_MIN_GAP, TANGENT_CAMERA_ZOOM_SCALE / Math.max(renderer.zoom, 1));
    const distance = globeDistance + (tangentDistance - globeDistance) * unwrap;

    return new Camera3D({
      mode: 'perspective',
      eye: new V3(0, 0, distance),
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      fovYRadians: Math.PI / 4,
      aspect,
      near: 0.00000001,
      far: 10,
    });
  }

  private renderCollection(
    renderer: CanvasRenderer,
    collection: GeometryCollection,
    frame: TerraMapRenderFrame,
  ) {
    for (const group of collection.optimizedGroups) {
      const feature = getFeatureTypeById(group.typeid);

      if ('area' in group) {
        renderer.webgl3d.drawTriangles(
          this.areaPoints3D(group, frame),
          this.areaColor(feature),
          frame.camera,
          frame.modelMatrix,
        );
        continue;
      }

      const style = this.lineStyle(feature);
      const lines = this.linePoints3D(group, frame);
      renderer.webgl3d.drawLineStrips(
        lines.points,
        lines.offsets,
        lines.sizes,
        style.color,
        frame.camera,
        frame.modelMatrix,
        style.lineWidth,
      );
    }
  }

  private renderDebugGrid(
    renderer: CanvasRenderer,
    frame: TerraMapRenderFrame,
    sourceBounds: TerraManifestBounds | null,
  ) {
    const visible = renderer.visibleArea;
    const minX = frame.surface !== 'plane'
      ? 0
      : Math.max(0, Math.min(visible.v1.x, visible.v2.x));
    const maxX = frame.surface !== 'plane'
      ? 1
      : Math.min(1, Math.max(visible.v1.x, visible.v2.x));
    const minY = frame.surface !== 'plane'
      ? 0
      : Math.max(0, Math.min(visible.v1.y, visible.v2.y));
    const maxY = frame.surface !== 'plane'
      ? 1
      : Math.min(1, Math.max(visible.v1.y, visible.v2.y));

    if (frame.surface === 'plane') {
      this.drawPolylineSet(renderer, frame, this.rectLines(0, 0, 1, 1), '#6f7882', 2);
    } else {
      this.drawPolylineSet(renderer, frame, this.graticuleLines(), '#c3c9ce', 1);
    }

    if (maxX > minX && maxY > minY) {
      const level = this.gridLevel(Math.max(maxX - minX, maxY - minY));
      const tileSize = 1 / 2 ** level;
      const lines: number[][] = [];

      for (
        let x = Math.ceil(minX / tileSize) * tileSize;
        x <= maxX + tileSize * 0.5;
        x += tileSize
      ) {
        lines.push([x, minY, x, maxY]);
      }

      for (
        let y = Math.ceil(minY / tileSize) * tileSize;
        y <= maxY + tileSize * 0.5;
        y += tileSize
      ) {
        lines.push([minX, y, maxX, y]);
      }

      this.drawPolylineSet(renderer, frame, lines, '#b7bdc3', 1);
    }

    if (sourceBounds) {
      this.drawPolylineSet(
        renderer,
        frame,
        this.rectLines(
          sourceBounds.minX,
          sourceBounds.minY,
          sourceBounds.maxX,
          sourceBounds.maxY,
        ),
        '#7f8f6b',
        2,
      );
    }
  }

  private renderTileFill(
    renderer: CanvasRenderer,
    collections: GeometryCollection[],
    frame: TerraMapRenderFrame,
    debugTiles?: TerraDebugTile[],
  ) {
    const tiles = debugTiles ?? collections.flatMap((collection): TerraDebugTile[] => {
      if (!collection.source) {
        return [];
      }
      const size = 1 / 2 ** collection.source.level;
      const xy = this.tileXY(collection.source.index, collection.source.level);
      return [{
        level: collection.source.level,
        index: collection.source.index,
        minX: xy.x * size,
        minY: xy.y * size,
        maxX: (xy.x + 1) * size,
        maxY: (xy.y + 1) * size,
      }];
    });

    for (const tile of tiles) {
      if (!this.isTileVisibleOnSurface(frame, tile.minX, tile.minY, tile.maxX, tile.maxY)) {
        continue;
      }

      renderer.webgl3d.drawTriangles(
        this.tileRectTriangles(frame, tile.minX, tile.minY, tile.maxX, tile.maxY),
        this.stableTileColor(tile.level, tile.index),
        frame.camera,
        frame.modelMatrix,
      );
    }
  }

  private isTileVisibleOnSurface(
    frame: TerraMapRenderFrame,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) {
    if (frame.surface === 'plane' || frame.unwrap > SPHERE_DRAW_MAX_UNWRAP) {
      return true;
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return frame.globeDepth(centerX, centerY) >= -0.03;
  }

  private isLineVisibleOnSurface(frame: TerraMapRenderFrame, line: number[]) {
    if (frame.surface === 'plane' || frame.unwrap > SPHERE_DRAW_MAX_UNWRAP) {
      return true;
    }
    const midX = (line[0] + line[2]) / 2;
    const midY = (line[1] + line[3]) / 2;
    return (
      frame.globeDepth(line[0], line[1]) >= -0.03 ||
      frame.globeDepth(line[2], line[3]) >= -0.03 ||
      frame.globeDepth(midX, midY) >= -0.03
    );
  }

  private tileRectTriangles(
    frame: TerraMapRenderFrame,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) {
    const p0 = frame.projectPoint(minX, minY);
    const p1 = frame.projectPoint(maxX, minY);
    const p2 = frame.projectPoint(maxX, maxY);
    const p3 = frame.projectPoint(minX, maxY);
    return new Float32Array([
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
      p2.x, p2.y, p2.z,
      p0.x, p0.y, p0.z,
      p2.x, p2.y, p2.z,
      p3.x, p3.y, p3.z,
    ]);
  }

  private tileXY(index: number, level: number) {
    let x = 0;
    let y = 0;
    for (let bit = 0; bit < level; bit += 1) {
      x += (Math.floor(index / 2 ** (bit * 2)) % 2) * 2 ** bit;
      y += (Math.floor(index / 2 ** (bit * 2 + 1)) % 2) * 2 ** bit;
    }
    return { x, y };
  }

  private stableTileColor(level: number, index: number) {
    let hash = (index ^ (level * 0x9e3779b1)) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b) >>> 0;
    hash ^= hash >>> 16;
    const r = 64 + (hash & 0x7f);
    const g = 64 + ((hash >>> 8) & 0x7f);
    const b = 64 + ((hash >>> 16) & 0x7f);
    return `rgba(${r}, ${g}, ${b}, 0.78)`;
  }

  private gridLevel(visibleSpan: number) {
    if (visibleSpan <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(15, Math.floor(Math.log2(8 / visibleSpan))));
  }

  private rectLines(minX: number, minY: number, maxX: number, maxY: number) {
    return [
      [minX, minY, maxX, minY],
      [maxX, minY, maxX, maxY],
      [maxX, maxY, minX, maxY],
      [minX, maxY, minX, minY],
    ];
  }

  private drawPolylineSet(
    renderer: CanvasRenderer,
    frame: TerraMapRenderFrame,
    lines: number[][],
    color: string,
    lineWidth: number,
  ) {
    const points: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];

    let pointOffset = 0;
    for (const line of lines) {
      if (!this.isLineVisibleOnSurface(frame, line)) {
        continue;
      }
      offsets.push(pointOffset);
      pointOffset = this.pushProjectedLine(points, pointOffset, frame, line);
      sizes.push(pointOffset - offsets[offsets.length - 1]);
    }

    renderer.webgl3d.drawLineStrips(
      new Float32Array(points),
      offsets,
      sizes,
      color,
      frame.camera,
      frame.modelMatrix,
      lineWidth,
    );
  }

  private pushProjectedLine(
    target: number[],
    pointOffset: number,
    frame: TerraMapRenderFrame,
    line: number[],
    skipFirst = false,
  ) {
    const subdivisions = frame.surface !== 'plane'
      ? Math.max(1, Math.ceil(Math.max(Math.abs(line[2] - line[0]), Math.abs(line[3] - line[1])) / 0.01))
      : 1;

    for (let i = 0; i <= subdivisions; i += 1) {
      if (skipFirst && i === 0) {
        continue;
      }
      const t = i / subdivisions;
      const x = line[0] + (line[2] - line[0]) * t;
      const y = line[1] + (line[3] - line[1]) * t;
      const p = frame.projectPoint(x, y);
      target.push(p.x, p.y, p.z);
      pointOffset += 1;
    }

    return pointOffset;
  }

  private linePoints3D(group: OptimizedLines, frame: TerraMapRenderFrame) {
    if (frame.surface === 'plane' || frame.unwrap >= 0.999) {
      const points = new Float32Array((group.points.length / 2) * 3);
      for (let source = 0, target = 0; source < group.points.length; source += 2, target += 3) {
        const p = frame.projectPoint(group.points[source], group.points[source + 1]);
        points[target] = p.x;
        points[target + 1] = p.y;
        points[target + 2] = p.z;
      }
      return {
        points,
        offsets: group.offsets,
        sizes: group.sizes,
      };
    }

    const points: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    let pointOffset = 0;

    for (let strip = 0; strip < group.offsets.length; strip += 1) {
      const sourceOffset = group.offsets[strip];
      const sourceSize = group.sizes[strip];
      offsets.push(pointOffset);

      for (let i = 0; i < sourceSize - 1; i += 1) {
        const source = (sourceOffset + i) * 2;
        pointOffset = this.pushProjectedLine(points, pointOffset, frame, [
          group.points[source],
          group.points[source + 1],
          group.points[source + 2],
          group.points[source + 3],
        ], i > 0);
      }

      sizes.push(pointOffset - offsets[offsets.length - 1]);
    }

    return {
      points: new Float32Array(points),
      offsets,
      sizes,
    };
  }

  private areaPoints3D(group: OptimizedArea, frame: TerraMapRenderFrame) {
    const points = new Float32Array(group.triangles.length * 3);
    for (let i = 0; i < group.triangles.length; i += 1) {
      const source = group.triangles[i] * 2;
      const target = i * 3;
      const p = frame.projectPoint(group.points[source], group.points[source + 1]);
      points[target] = p.x;
      points[target + 1] = p.y;
      points[target + 2] = p.z;
    }
    return points;
  }

  private globeProjector(centerX: number, centerY: number) {
    const centerLon = this.worldXToLonRad(centerX);
    const centerLat = this.worldYToLatRad(centerY);
    const sinLon = Math.sin(centerLon);
    const cosLon = Math.cos(centerLon);
    const sinLat = Math.sin(centerLat);
    const cosLat = Math.cos(centerLat);
    const east = new V3(-sinLon, 0, cosLon);
    const north = new V3(-sinLat * cosLon, cosLat, -sinLat * sinLon);
    const forward = new V3(cosLat * cosLon, sinLat, cosLat * sinLon);

    return (x: number, y: number, radius: number) => {
      const lon = this.worldXToLonRad(x);
      const lat = this.worldYToLatRad(y);
      const cosPointLat = Math.cos(lat);
      const point = new V3(
        cosPointLat * Math.cos(lon),
        Math.sin(lat),
        cosPointLat * Math.sin(lon),
      );
      return new V3(
        point.dot(east) * radius,
        point.dot(north) * radius,
        point.dot(forward) * radius,
      );
    };
  }

  private tangentProjector(centerX: number, centerY: number) {
    const centerLat = this.worldYToLatRad(centerY);
    const centerCosLat = Math.max(0.08, Math.cos(centerLat));

    return (x: number, y: number, z: number) => {
      const dx = this.wrapDelta(x - centerX) * Math.PI * 2 * centerCosLat;
      const dy = this.worldYToLatRad(y) - centerLat;
      return new V3(dx, dy, z);
    };
  }

  private unwrapAmount(zoom: number) {
    return terraUnwrapAmount(zoom);
  }

  private wrapDelta(delta: number) {
    return delta - Math.round(delta);
  }

  private lerpV3(a: V3, b: V3, t: number) {
    return new V3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t,
    );
  }

  private worldXToLonRad(x: number) {
    const wrappedX = ((x % 1) + 1) % 1;
    return wrappedX * Math.PI * 2 - Math.PI;
  }

  private worldYToLatRad(y: number) {
    const clampedY = Math.max(0, Math.min(1, y));
    return Math.atan(Math.sinh(Math.PI * (2 * clampedY - 1)));
  }

  private latRadToWorldY(latRad: number) {
    const mercator = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    return (1 + mercator / Math.PI) / 2;
  }

  private graticuleLines() {
    const lines: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = (lon + 180) / 360;
      for (let lat = -75; lat < 75; lat += 5) {
        lines.push([
          x,
          this.latRadToWorldY(lat * Math.PI / 180),
          x,
          this.latRadToWorldY((lat + 5) * Math.PI / 180),
        ]);
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = this.latRadToWorldY(lat * Math.PI / 180);
      for (let lon = -180; lon < 180; lon += 5) {
        lines.push([
          (lon + 180) / 360,
          y,
          (lon + 185) / 360,
          y,
        ]);
      }
    }
    return lines;
  }

  private globeSpherePoints() {
    if (this.globeSpherePointsCache) {
      return this.globeSpherePointsCache;
    }

    const latSteps = 24;
    const lonSteps = 48;
    const points: number[] = [];

    for (let latStep = 0; latStep < latSteps; latStep += 1) {
      const lat0 = -Math.PI / 2 + (latStep / latSteps) * Math.PI;
      const lat1 = -Math.PI / 2 + ((latStep + 1) / latSteps) * Math.PI;

      for (let lonStep = 0; lonStep < lonSteps; lonStep += 1) {
        const lon0 = -Math.PI + (lonStep / lonSteps) * Math.PI * 2;
        const lon1 = -Math.PI + ((lonStep + 1) / lonSteps) * Math.PI * 2;
        this.pushSphereTriangle(points, lat0, lon0, lat1, lon0, lat1, lon1, 1);
        this.pushSphereTriangle(points, lat0, lon0, lat1, lon1, lat0, lon1, 1);
      }
    }

    this.globeSpherePointsCache = new Float32Array(points);
    return this.globeSpherePointsCache;
  }

  private pushSphereTriangle(
    points: number[],
    lat0: number,
    lon0: number,
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radius: number,
  ) {
    this.pushSpherePoint(points, lat0, lon0, radius);
    this.pushSpherePoint(points, lat1, lon1, radius);
    this.pushSpherePoint(points, lat2, lon2, radius);
  }

  private pushSpherePoint(points: number[], lat: number, lon: number, radius: number) {
    const cosLat = Math.cos(lat);
    points.push(
      cosLat * Math.sin(lon) * radius,
      Math.sin(lat) * radius,
      cosLat * Math.cos(lon) * radius,
    );
  }

  private areaColor(feature: TerraFeatureType) {
    if (this.isWaterFeature(feature)) {
      return TERRAIN_COLORS.water;
    }
    if (this.isVegetationFeature(feature)) {
      return TERRAIN_COLORS.vegetation;
    }
    if (feature.kind === 'aeroway') {
      return TERRAIN_COLORS.airport;
    }
    if (feature.kind === 'building') {
      return TERRAIN_COLORS.building;
    }
    return TERRAIN_COLORS.fallbackArea;
  }

  private lineStyle(feature: TerraFeatureType) {
    if (feature.kind === 'natural') {
      return {
        color: this.isWaterFeature(feature)
          ? TERRAIN_COLORS.water
          : this.isVegetationFeature(feature)
            ? TERRAIN_COLORS.vegetation
            : TERRAIN_COLORS.fallbackNaturalLine,
        lineWidth: 1,
      };
    }

    if (feature.kind === 'waterway') {
      return { color: TERRAIN_COLORS.water, lineWidth: 1 };
    }
    if (feature.kind === 'landuse') {
      return { color: TERRAIN_COLORS.vegetation, lineWidth: 1 };
    }
    if (feature.kind === 'aeroway') {
      return { color: TERRAIN_COLORS.airport, lineWidth: 1 };
    }
    if (feature.kind === 'building') {
      return { color: TERRAIN_COLORS.fallbackBuildingLine, lineWidth: 1 };
    }
    if (feature.kind === 'road') {
      const roadLevel = ResolutionByRoadType[feature.name] ?? 0;
      return {
        color: roadLodColors[roadLevel] ?? TERRAIN_COLORS.debug,
        lineWidth: 2,
      };
    }

    return { color: TERRAIN_COLORS.debug, lineWidth: 1 };
  }

  private isWaterFeature(feature: TerraFeatureType) {
    return waterFeatureNames.has(feature.name);
  }

  private isVegetationFeature(feature: TerraFeatureType) {
    return vegetationFeatureNames.has(feature.name);
  }
}
