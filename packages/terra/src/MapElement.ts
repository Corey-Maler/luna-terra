import { LTElement, CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';
import { Grid } from '@lunaterra/elements';
import { Rect2D, V2 } from '@lunaterra/math';
import { getFeatureTypeById } from './helpers';
import { CommutatorClient } from './Commutator';
import { LazyQuadTree } from './LazyQuadTree';
import { GeometryCollection } from './GeometryCollection';
import { emptyTerraRenderStats, type TerraRenderStats, type TerraTypeStats } from './TerraStats';
import type { TerraTileClient } from './TileClient';
import { TerraMapRenderer } from './TerraMapRenderer';
import {
  TERRA_DEBUG_SURFACE_COVER_MAX_UNWRAP,
  TERRA_GLOBE_MAX_TILE_LEVEL,
  terraUnwrapAmount,
} from './TerraMapRenderer';
import type { TerraDebugTile, TerraMapMode, TerraMapSurface } from './TerraMapRenderer';
import type { TerraManifestBounds } from './TileClient';

export interface MapElementOptions {
  onStats?: (stats: TerraRenderStats) => void;
  tileClient?: TerraTileClient;
  debugGrid?: boolean;
  debugTileFill?: boolean;
  mapMode?: TerraMapMode;
  sourceBounds?: TerraManifestBounds | null;
  pitchDegrees?: number;
}

export class MapElement extends LTElement {
  private commutator: CommutatorClient;
  private lazyTreeRoot?: LazyQuadTree;
  private readonly onStats?: (stats: TerraRenderStats) => void;
  private readonly mapRenderer = new TerraMapRenderer();
  private debugGrid = false;
  private debugTileFill = false;
  private mapMode: TerraMapMode = 'plane';
  private lastSurface: TerraMapSurface = 'plane';
  private sourceBounds: TerraManifestBounds | null = null;
  private pitchDegrees = 0;
  private lastStatsAt = 0;

  constructor(tileBaseUrl?: string, options: MapElementOptions = {}) {
    super();
    this.commutator = new CommutatorClient(options.tileClient ?? tileBaseUrl);
    this.onStats = options.onStats;
    this.debugGrid = options.debugGrid ?? false;
    this.debugTileFill = options.debugTileFill ?? false;
    this.mapMode = options.mapMode ?? 'plane';
    this.sourceBounds = options.sourceBounds ?? null;
    this.pitchDegrees = options.pitchDegrees ?? 0;
  }

  public setDebugGrid(enabled: boolean) {
    this.debugGrid = enabled;
  }

  public setDebugTileFill(enabled: boolean) {
    this.debugTileFill = enabled;
  }

  public setMapMode(mapMode: TerraMapMode) {
    this.mapMode = mapMode;
  }

  public setSourceBounds(bounds: TerraManifestBounds | null) {
    this.sourceBounds = bounds;
  }

  public setPitchDegrees(pitchDegrees: number) {
    this.pitchDegrees = pitchDegrees;
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
    const surface = this.mapRenderer.resolveMapSurface(renderer, this.mapMode);
    if (surface !== 'plane') {
      this.normalizeGlobeViewport(renderer);
    }

    const queryArea = surface === 'globe'
      ? this.globeQueryArea()
      : surface === 'unwrap'
      ? this.unwrapQueryArea(renderer)
      : renderer.visibleArea;
    const collections = this.lazyTreeRoot
      ?.getGeometryForArea(
        queryArea,
        surface === 'globe' ? { maxLevel: TERRA_GLOBE_MAX_TILE_LEVEL } : {},
      )
      .filter((el, ind, original) => original.indexOf(el) === ind)
      .filter((geometry): geometry is GeometryCollection => geometry !== undefined) ?? [];

    this.lastSurface = this.mapRenderer.render(renderer, collections, {
      debugGrid: this.debugGrid,
      debugTiles: this.debugTileFill ? this.debugTilesForSurface(renderer, surface) : undefined,
      debugTileFill: this.debugTileFill,
      mapMode: this.mapMode,
      pitchDegrees: this.pitchDegrees,
      sourceBounds: this.sourceBounds,
    });

    this.reportStats(renderer, collections);
  }

  private globeQueryArea() {
    if (this.sourceBounds) {
      return new Rect2D(
        new V2(this.sourceBounds.minX, this.sourceBounds.minY),
        new V2(this.sourceBounds.maxX, this.sourceBounds.maxY),
      );
    }

    return new Rect2D(new V2(0, 0), new V2(1, 1));
  }

  private unwrapQueryArea(renderer: CanvasRenderer) {
    const visible = renderer.visibleArea;
    const minX = Math.min(visible.v1.x, visible.v2.x);
    const maxX = Math.max(visible.v1.x, visible.v2.x);
    const minY = Math.min(visible.v1.y, visible.v2.y);
    const maxY = Math.max(visible.v1.y, visible.v2.y);
    const marginX = Math.max((maxX - minX) * 1.5, 1e-6);
    const marginY = Math.max((maxY - minY) * 1.5, 1e-6);

    return new Rect2D(
      new V2(
        Math.max(0, minX - marginX),
        Math.max(0, minY - marginY),
      ),
      new V2(
        Math.min(1, maxX + marginX),
        Math.min(1, maxY + marginY),
      ),
    );
  }

  private normalizeGlobeViewport(renderer: CanvasRenderer) {
    const center = renderer.viewportCenter;
    const wrappedX = ((center.x % 1) + 1) % 1;
    const clampedY = Math.max(0, Math.min(1, center.y));

    if (Math.abs(wrappedX - center.x) < 1e-9 && Math.abs(clampedY - center.y) < 1e-9) {
      return;
    }

    renderer.moveViewportTo(new V2(wrappedX, clampedY));
  }

  private debugTilesForSurface(
    renderer: CanvasRenderer,
    surface: TerraMapSurface,
  ): TerraDebugTile[] | undefined {
    if (surface === 'plane') {
      return undefined;
    }

    const unwrap = this.unwrapAmount(renderer.zoom, surface);
    if (unwrap > TERRA_DEBUG_SURFACE_COVER_MAX_UNWRAP) {
      return undefined;
    }

    const center = renderer.viewportCenter;
    const centerVector = this.worldToSphere(center.x, center.y);
    const tiles: TerraDebugTile[] = [];

    const visit = (x: number, y: number, level: number) => {
      const tileSize = 1 / 2 ** level;
      const centerX = (x + 0.5) * tileSize;
      const centerY = (y + 0.5) * tileSize;
      const depth = this.sphereDot(this.worldToSphere(centerX, centerY), centerVector);
      const targetLevel = this.globeDebugTileLevel(depth, unwrap);

      if (level >= targetLevel) {
        tiles.push({
          level,
          index: this.tileIndexFromXY(x, y, level),
          minX: x * tileSize,
          minY: y * tileSize,
          maxX: (x + 1) * tileSize,
          maxY: (y + 1) * tileSize,
        });
        return;
      }

      const nextLevel = level + 1;
      const nextX = x * 2;
      const nextY = y * 2;
      visit(nextX, nextY, nextLevel);
      visit(nextX + 1, nextY, nextLevel);
      visit(nextX, nextY + 1, nextLevel);
      visit(nextX + 1, nextY + 1, nextLevel);
    };

    visit(0, 0, 0);
    return tiles;
  }

  private globeDebugTileLevel(depth: number, unwrap: number) {
    const unwrapBoost = Math.floor(unwrap * 2);
    if (depth > 0.72) {
      return TERRA_GLOBE_MAX_TILE_LEVEL + unwrapBoost;
    }
    if (depth > 0.42) {
      return Math.max(0, TERRA_GLOBE_MAX_TILE_LEVEL - 1 + unwrapBoost);
    }
    if (depth > 0.12) {
      return Math.max(0, TERRA_GLOBE_MAX_TILE_LEVEL - 2 + unwrapBoost);
    }
    return Math.max(0, TERRA_GLOBE_MAX_TILE_LEVEL - 3 + unwrapBoost);
  }

  private unwrapAmount(zoom: number, surface: TerraMapSurface) {
    if (surface === 'globe') {
      return 0;
    }
    return terraUnwrapAmount(zoom);
  }

  private tileIndexFromXY(x: number, y: number, level: number) {
    let index = 0;
    for (let bit = 0; bit < level; bit += 1) {
      index += (Math.floor(x / 2 ** bit) % 2) * 2 ** (bit * 2);
      index += (Math.floor(y / 2 ** bit) % 2) * 2 ** (bit * 2 + 1);
    }
    return index;
  }

  private worldToSphere(x: number, y: number) {
    const lon = (((x % 1) + 1) % 1) * Math.PI * 2 - Math.PI;
    const lat = Math.atan(Math.sinh(Math.PI * (2 * Math.max(0, Math.min(1, y)) - 1)));
    const cosLat = Math.cos(lat);
    return {
      x: cosLat * Math.cos(lon),
      y: Math.sin(lat),
      z: cosLat * Math.sin(lon),
    };
  }

  private sphereDot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
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
    stats.renderMode = this.lastSurface === 'globe'
      ? 'core-3d-globe'
      : this.lastSurface === 'unwrap'
      ? 'core-3d-unwrap'
      : this.pitchDegrees > 0
      ? 'core-3d-pitched-plane'
      : this.mapRenderer.renderMode;
    stats.pitchDegrees = this.pitchDegrees;
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

}
