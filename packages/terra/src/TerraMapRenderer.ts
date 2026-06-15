import { Camera3D, type CanvasRenderer } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';
import { ResolutionByRoadType, getFeatureTypeById, type TerraFeatureType } from './helpers';
import type { GeometryCollection, OptimizedArea, OptimizedLines } from './GeometryCollection';
import type { TerraManifestBounds } from './TileClient';

export interface TerraMapRenderOptions {
  debugGrid?: boolean;
  mapMode?: TerraMapMode;
  pitchDegrees?: number;
  sourceBounds?: TerraManifestBounds | null;
}

export type TerraMapMode = 'auto' | 'plane' | 'globe';
export type TerraMapSurface = 'plane' | 'globe';

export const TERRA_GLOBE_AUTO_MAX_ZOOM = 2.5;

type TerraMapRenderFrame = {
  anchorWorld: { x: number; y: number };
  camera: Camera3D;
  modelMatrix: M4;
  surface: TerraMapSurface;
  projectPoint: (x: number, y: number) => V3;
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

    if (frame.surface === 'globe') {
      renderer.webgl3d.drawTriangles(
        this.globeSpherePoints(),
        TERRAIN_COLORS.globe,
        frame.camera,
        frame.modelMatrix,
      );
    }

    for (const collection of collections) {
      this.renderCollection(renderer, collection, frame);
    }

    if (options.debugGrid) {
      this.renderDebugGrid(renderer, frame, options.sourceBounds ?? null);
    }

    return frame.surface;
  }

  public resolveMapSurface(renderer: CanvasRenderer, mapMode: TerraMapMode): TerraMapSurface {
    if (mapMode === 'auto') {
      return renderer.zoom <= TERRA_GLOBE_AUTO_MAX_ZOOM ? 'globe' : 'plane';
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

    if (mapMode === 'globe') {
      const projector = this.globeProjector(anchorWorld.x, anchorWorld.y);
      return {
        anchorWorld,
        camera: this.globeCamera(renderer),
        modelMatrix: M4.identity(),
        surface: 'globe',
        projectPoint: (x, y) => projector(x, y, 1.003),
      };
    }

    return {
      anchorWorld,
      camera: pitchRadians === 0
        ? this.flatCamera(halfWidth, halfHeight)
        : this.pitchedCamera(halfWidth, halfHeight, renderer, pitchRadians),
      modelMatrix: M4.identity(),
      surface: 'plane',
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

  private globeCamera(renderer: CanvasRenderer) {
    const aspect = renderer.height === 0 ? 1 : renderer.width / renderer.height;
    const normalizedZoom = Math.max(0, Math.log2(Math.max(renderer.zoom, 1)) / 12);
    const distance = Math.max(1.45, 3.2 - normalizedZoom * 1.4);

    return new Camera3D({
      mode: 'perspective',
      eye: new V3(0, 0, distance),
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      fovYRadians: Math.PI / 4,
      aspect,
      near: 0.01,
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
    const minX = frame.surface === 'globe'
      ? 0
      : Math.max(0, Math.min(visible.v1.x, visible.v2.x));
    const maxX = frame.surface === 'globe'
      ? 1
      : Math.min(1, Math.max(visible.v1.x, visible.v2.x));
    const minY = frame.surface === 'globe'
      ? 0
      : Math.max(0, Math.min(visible.v1.y, visible.v2.y));
    const maxY = frame.surface === 'globe'
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
    const subdivisions = frame.surface === 'globe'
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
    if (frame.surface === 'plane') {
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
