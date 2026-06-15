import type { CanvasRenderer } from '@lunaterra/core';
import { ResolutionByRoadType, getFeatureTypeById, type TerraFeatureType } from './helpers';
import type { GeometryCollection } from './GeometryCollection';

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
  render(renderer: CanvasRenderer, collections: GeometryCollection[]) {
    const frame = this.buildFrame(renderer);

    for (const collection of collections) {
      this.renderCollection(renderer, collection, frame);
    }
  }

  private buildFrame(renderer: CanvasRenderer) {
    return {
      anchorWorld: renderer.viewportCenter,
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
        renderer.webgl.p3FillRelative(
          group.points,
          group.triangles,
          this.areaColor(feature),
          frame.anchorWorld,
        );
        continue;
      }

      const style = this.lineStyle(feature);
      const colors = new Array(group.offsets.length).fill(style.color);
      renderer.webgl.p3Relative(
        group.points,
        group.offsets,
        group.sizes,
        colors,
        style.lineWidth,
        frame.anchorWorld,
      );
    }
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
