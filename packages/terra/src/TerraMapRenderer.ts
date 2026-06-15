import { Camera3D, type CanvasRenderer } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';
import { ResolutionByRoadType, getFeatureTypeById, type TerraFeatureType } from './helpers';
import type { GeometryCollection, OptimizedArea, OptimizedLines } from './GeometryCollection';
import type { TerraManifestBounds } from './TileClient';

export interface TerraMapRenderOptions {
  debugGrid?: boolean;
  pitchDegrees?: number;
  sourceBounds?: TerraManifestBounds | null;
}

const TERRAIN_COLORS = {
  debug: '#666666',
  water: '#c5d2d9',
  vegetation: '#c7d0c6',
  airport: '#a8a5a0',
  building: '#8f8f8f',
  fallbackArea: '#cccccc',
  fallbackNaturalLine: '#aaaaaa',
  fallbackBuildingLine: '#bbbbbb',
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

  render(
    renderer: CanvasRenderer,
    collections: GeometryCollection[],
    options: TerraMapRenderOptions = {},
  ) {
    const frame = this.buildFrame(renderer, options.pitchDegrees ?? 0);

    for (const collection of collections) {
      this.renderCollection(renderer, collection, frame);
    }

    if (options.debugGrid) {
      this.renderDebugGrid(renderer, frame, options.sourceBounds ?? null);
    }
  }

  private buildFrame(renderer: CanvasRenderer, pitchDegrees: number) {
    const visibleArea = renderer.visibleArea;
    const anchorWorld = renderer.viewportCenter;
    const halfWidth = Math.abs(visibleArea.v2.x - visibleArea.v1.x) / 2;
    const halfHeight = Math.abs(visibleArea.v2.y - visibleArea.v1.y) / 2;
    const pitchRadians = Math.max(0, Math.min(75, pitchDegrees)) * Math.PI / 180;

    return {
      anchorWorld,
      camera: pitchRadians === 0
        ? this.flatCamera(halfWidth, halfHeight)
        : this.pitchedCamera(halfWidth, halfHeight, renderer, pitchRadians),
      modelMatrix: M4.identity(),
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

  private renderCollection(
    renderer: CanvasRenderer,
    collection: GeometryCollection,
    frame: ReturnType<TerraMapRenderer['buildFrame']>,
  ) {
    for (const group of collection.optimizedGroups) {
      const feature = getFeatureTypeById(group.typeid);

      if ('area' in group) {
        renderer.webgl3d.drawTriangles(
          this.areaPoints3D(group, frame.anchorWorld),
          this.areaColor(feature),
          frame.camera,
          frame.modelMatrix,
        );
        continue;
      }

      const style = this.lineStyle(feature);
      renderer.webgl3d.drawLineStrips(
        this.linePoints3D(group, frame.anchorWorld),
        group.offsets,
        group.sizes,
        style.color,
        frame.camera,
        frame.modelMatrix,
        style.lineWidth,
      );
    }
  }

  private renderDebugGrid(
    renderer: CanvasRenderer,
    frame: ReturnType<TerraMapRenderer['buildFrame']>,
    sourceBounds: TerraManifestBounds | null,
  ) {
    const visible = renderer.visibleArea;
    const minX = Math.max(0, Math.min(visible.v1.x, visible.v2.x));
    const maxX = Math.min(1, Math.max(visible.v1.x, visible.v2.x));
    const minY = Math.max(0, Math.min(visible.v1.y, visible.v2.y));
    const maxY = Math.min(1, Math.max(visible.v1.y, visible.v2.y));

    this.drawPolylineSet(renderer, frame, this.rectLines(0, 0, 1, 1), '#6f7882', 2);

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
    frame: ReturnType<TerraMapRenderer['buildFrame']>,
    lines: number[][],
    color: string,
    lineWidth: number,
  ) {
    const points = new Float32Array(lines.length * 2 * 3);
    const offsets: number[] = [];
    const sizes: number[] = [];

    let pointOffset = 0;
    for (const line of lines) {
      offsets.push(pointOffset);
      sizes.push(2);
      points[pointOffset * 3] = line[0] - frame.anchorWorld.x;
      points[pointOffset * 3 + 1] = line[1] - frame.anchorWorld.y;
      points[pointOffset * 3 + 2] = 0;
      points[pointOffset * 3 + 3] = line[2] - frame.anchorWorld.x;
      points[pointOffset * 3 + 4] = line[3] - frame.anchorWorld.y;
      points[pointOffset * 3 + 5] = 0;
      pointOffset += 2;
    }

    renderer.webgl3d.drawLineStrips(
      points,
      offsets,
      sizes,
      color,
      frame.camera,
      frame.modelMatrix,
      lineWidth,
    );
  }

  private linePoints3D(group: OptimizedLines, anchorWorld: { x: number; y: number }) {
    const points = new Float32Array((group.points.length / 2) * 3);
    for (let source = 0, target = 0; source < group.points.length; source += 2, target += 3) {
      points[target] = group.points[source] - anchorWorld.x;
      points[target + 1] = group.points[source + 1] - anchorWorld.y;
      points[target + 2] = 0;
    }
    return points;
  }

  private areaPoints3D(group: OptimizedArea, anchorWorld: { x: number; y: number }) {
    const points = new Float32Array(group.triangles.length * 3);
    for (let i = 0; i < group.triangles.length; i += 1) {
      const source = group.triangles[i] * 2;
      const target = i * 3;
      points[target] = group.points[source] - anchorWorld.x;
      points[target + 1] = group.points[source + 1] - anchorWorld.y;
      points[target + 2] = 0;
    }
    return points;
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
