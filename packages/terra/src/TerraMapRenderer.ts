import { Camera3D, type CanvasRenderer } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';
import { ResolutionByRoadType, getFeatureTypeById, type TerraFeatureType } from './helpers';
import type { GeometryCollection, OptimizedArea, OptimizedLines } from './GeometryCollection';

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

  render(renderer: CanvasRenderer, collections: GeometryCollection[]) {
    const frame = this.buildFrame(renderer);

    for (const collection of collections) {
      this.renderCollection(renderer, collection, frame);
    }
  }

  private buildFrame(renderer: CanvasRenderer) {
    const visibleArea = renderer.visibleArea;
    const anchorWorld = renderer.viewportCenter;
    const halfWidth = Math.abs(visibleArea.v2.x - visibleArea.v1.x) / 2;
    const halfHeight = Math.abs(visibleArea.v2.y - visibleArea.v1.y) / 2;

    return {
      anchorWorld,
      camera: new Camera3D({
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
      }),
      modelMatrix: M4.identity(),
    };
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
