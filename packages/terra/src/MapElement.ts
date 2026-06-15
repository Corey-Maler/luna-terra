import { LTElement, CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';
import { Grid } from '@lunaterra/elements';
import { getFeatureTypeById, R, ResolutionByRoadType, type TerraFeatureType } from './helpers';
import { CommutatorClient } from './Commutator';
import { LazyQuadTree } from './LazyQuadTree';
import { GeometryCollection } from './GeometryCollection';
import { emptyTerraRenderStats, type TerraRenderStats, type TerraTypeStats } from './TerraStats';
import type { TerraTileClient } from './TileClient';

export interface MapElementOptions {
  onStats?: (stats: TerraRenderStats) => void;
  tileClient?: TerraTileClient;
}

export class MapElement extends LTElement {
  private commutator: CommutatorClient;
  private lazyTreeRoot?: LazyQuadTree;
  private readonly onStats?: (stats: TerraRenderStats) => void;
  private lastStatsAt = 0;

  constructor(tileBaseUrl?: string, options: MapElementOptions = {}) {
    super();
    this.commutator = new CommutatorClient(options.tileClient ?? tileBaseUrl);
    this.onStats = options.onStats;
  }

  protected defaultOptions() {
    return {};
  }

  setup(engine: LunaTerraEngine) {
    super.setup(engine);
    this.appendChild(new Grid());
    this.lazyTreeRoot = LazyQuadTree.generate({ commutator: this.commutator, engine });
  }

  render(renderer: CanvasRenderer) {
    this.renderGeometry(renderer);
  }

  private renderGeometry(renderer: CanvasRenderer) {
    const collections = this.lazyTreeRoot
      ?.getGeometryForArea(renderer.visibleArea)
      .filter((el, ind, original) => original.indexOf(el) === ind)
      .filter((geometry): geometry is GeometryCollection => geometry !== undefined) ?? [];

    for (const geometry of collections) {
      this.renderGeometryCollection(renderer, geometry);
    }

    this.reportStats(renderer, collections);
  }

  private reportStats(renderer: CanvasRenderer, collections: GeometryCollection[]) {
    if (!this.onStats) {
      return;
    }

    const now = performance.now();
    if (now - this.lastStatsAt < 250) {
      return;
    }
    this.lastStatsAt = now;

    const stats = emptyTerraRenderStats();
    const byType = new Map<number, TerraTypeStats>();
    const visibleArea = renderer.visibleArea;
    stats.zoom = renderer.zoom;
    stats.renderMode = 'camera-relative';
    stats.viewportCenter = renderer.viewportCenter.toJson();
    stats.renderAnchor = renderer.viewportCenter.toJson();
    stats.viewportPixels = {
      width: renderer.width,
      height: renderer.height,
    };
    stats.visibleArea = {
      minX: Math.min(visibleArea.v1.x, visibleArea.v2.x),
      minY: Math.min(visibleArea.v1.y, visibleArea.v2.y),
      maxX: Math.max(visibleArea.v1.x, visibleArea.v2.x),
      maxY: Math.max(visibleArea.v1.y, visibleArea.v2.y),
    };
    stats.visibleCollections = collections.length;

    for (const collection of collections) {
      if (collection.source) {
        stats.minLevel = stats.minLevel === null
          ? collection.source.level
          : Math.min(stats.minLevel, collection.source.level);
        stats.maxLevel = stats.maxLevel === null
          ? collection.source.level
          : Math.max(stats.maxLevel, collection.source.level);
      }

      stats.sourceGeometries += collection.geometry.length;
      stats.groups += collection.optimizedGroups.length;

      for (const geometry of collection.geometry) {
        const typeStats = this.getTypeStats(byType, geometry.typeid);
        typeStats.geometries += 1;
      }

      for (const group of collection.optimizedGroups) {
        const typeStats = this.getTypeStats(byType, group.typeid);
        typeStats.groups += 1;

        if ('area' in group) {
          const points = group.points.length / 2;
          stats.areaGroups += 1;
          stats.areaPoints += points;
          stats.points += points;
          stats.triangles += group.triangles.length / 3;
          typeStats.areaPoints += points;
          typeStats.points += points;
          typeStats.triangles += group.triangles.length / 3;
        } else {
          const points = group.points.length / 2;
          stats.lineGroups += 1;
          stats.linePoints += points;
          stats.points += points;
          typeStats.linePoints += points;
          typeStats.points += points;
        }
      }
    }

    stats.topTypes = Array.from(byType.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);

    this.onStats(stats);
  }

  private getTypeStats(byType: Map<number, TerraTypeStats>, typeId: number): TerraTypeStats {
    let stats = byType.get(typeId);
    if (!stats) {
      stats = {
        typeId,
        name: getFeatureTypeById(typeId).name,
        geometries: 0,
        groups: 0,
        points: 0,
        linePoints: 0,
        areaPoints: 0,
        triangles: 0,
      };
      byType.set(typeId, stats);
    }
    return stats;
  }

  private renderGeometryCollection(renderer: CanvasRenderer, gc: GeometryCollection) {
    const debugColor = '#666666';
    const zoom = renderer.zoom;
    const renderAnchor = renderer.viewportCenter;
    const waterColor = '#c5d2d9';
    const vegetationColor = '#c7d0c6';
    const airportColor = '#a8a5a0';
    const buildingColor = '#8f8f8f';

    const cls = [
      '#333333', '#444444', '#555555', '#666666', '#777777',
      '#888888', '#999999', '#aaaaaa', '#bbbbbb',
    ];

    for (const go of gc.optimizedGroups) {
      if ('area' in go) {
        const color = this.areaColor(go.typeid, {
          water: waterColor,
          vegetation: vegetationColor,
          airport: airportColor,
          building: buildingColor,
          fallback: '#cccccc',
        });
        renderer.webgl.p3FillRelative(go.points, go.triangles, color, renderAnchor);
      } else {
        const feature = getFeatureTypeById(go.typeid);
        const rr = feature.kind === 'road'
          ? ResolutionByRoadType[feature.name] ?? 0
          : feature.zoomLevel;
        let color = cls[rr] ?? debugColor;
        let lineWidth = 2;

        if (feature.kind === 'natural') {
          color = this.isWaterFeature(feature)
            ? waterColor
            : this.isVegetationFeature(feature)
              ? vegetationColor
              : '#aaaaaa';
          lineWidth = 1;
        }

        if (feature.kind === 'waterway') {
          color = waterColor;
          lineWidth = 1;
        } else if (feature.kind === 'landuse') {
          color = vegetationColor;
          lineWidth = 1;
        } else if (feature.kind === 'aeroway') {
          color = airportColor;
          lineWidth = 1;
        } else if (feature.kind === 'building') {
          color = '#bbbbbb';
          lineWidth = 1;
        } else if (feature.kind === 'road') {
          const lw = (R.nano / (rr || 1)) * (zoom / 200);
          lineWidth = Math.max(Math.min(5, lw), 1);
          lineWidth = 2;
        }

        const colors = new Array(go.offsets.length).fill(color);
        renderer.webgl.p3Relative(
          go.points,
          go.offsets,
          go.sizes,
          colors,
          lineWidth,
          renderAnchor,
        );
      }
    }
  }

  private areaColor(
    typeId: number,
    colors: {
      water: string;
      vegetation: string;
      airport: string;
      building: string;
      fallback: string;
    }
  ) {
    const feature = getFeatureTypeById(typeId);

    if (this.isWaterFeature(feature)) {
      return colors.water;
    }
    if (this.isVegetationFeature(feature)) {
      return colors.vegetation;
    }
    if (feature.kind === 'aeroway') {
      return colors.airport;
    }
    if (feature.kind === 'building') {
      return colors.building;
    }
    return colors.fallback;
  }

  private isWaterFeature(feature: TerraFeatureType) {
    return waterFeatureNames.has(feature.name);
  }

  private isVegetationFeature(feature: TerraFeatureType) {
    return vegetationFeatureNames.has(feature.name);
  }
}

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
