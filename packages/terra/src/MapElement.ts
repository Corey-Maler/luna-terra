import { LTElement, CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';
import { Rect2D, V2 } from '@lunaterra/math';
import { getFeatureTypeById } from './helpers';
import { CommutatorClient } from './Commutator';
import { LazyQuadTree } from './LazyQuadTree';
import { GeometryCollection } from './GeometryCollection';
import { emptyTerraRenderStats, type TerraRenderStats, type TerraTypeStats } from './TerraStats';
import type { TerraTileClient } from './TileClient';
import { TerraMapRenderer } from './TerraMapRenderer';
import {
  TERRA_GLOBE_MAX_TILE_LEVEL,
} from './TerraMapRenderer';
import type { TerraDebugTile, TerraMapMode, TerraMapSurface } from './TerraMapRenderer';
import type { TerraManifestBounds } from './TileClient';
import {
  TerraGlobeLocalFrame,
  terraGlobeLocalFrameView,
  terraGlobeStableTargetLevel,
  type TerraGlobeTileSelection,
} from './TerraGlobeLocalFrame';
import {
  worldUToLongitudeRadians,
  worldVToLatitudeRadians,
} from './TerraSurfaceModel';
import { mortonTileIndexFromXYLevel } from './TileIndex';

const TERRA_GLOBE_TARGET_PIXELS = 256;

export interface MapElementOptions {
  onStats?: (stats: TerraRenderStats) => void;
  tileClient?: TerraTileClient;
  debugGrid?: boolean;
  debugTileFill?: boolean;
  mapMode?: TerraMapMode;
  sourceBounds?: TerraManifestBounds | null;
  maxTileLevel?: number | null;
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
  private maxTileLevel: number | null = null;
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
    this.maxTileLevel = options.maxTileLevel ?? null;
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

  public setMaxTileLevel(maxTileLevel: number | null) {
    this.maxTileLevel = maxTileLevel;
  }

  public setPitchDegrees(pitchDegrees: number) {
    this.pitchDegrees = pitchDegrees;
  }

  protected defaultOptions() {
    return {};
  }

  setup(engine: LunaTerraEngine) {
    super.setup(engine);
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

    const globeSelection = surface === 'globe'
      ? this.selectGlobeTiles(renderer)
      : null;
    const collections = globeSelection
      ? this.collectionsForGlobeSelection(globeSelection)
      : this.collectionsForArea(renderer);

    this.lastSurface = this.mapRenderer.render(renderer, collections, {
      debugGrid: this.debugGrid,
      debugTiles: this.debugTileFill && globeSelection
        ? this.debugTilesForGlobeSelection(globeSelection)
        : undefined,
      debugTileFill: this.debugTileFill,
      mapMode: this.mapMode,
      pitchDegrees: this.pitchDegrees,
      sourceBounds: this.sourceBounds,
    });

    this.reportStats(renderer, collections);
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

  private collectionsForArea(renderer: CanvasRenderer) {
    return this.uniqueCollections(
      this.lazyTreeRoot?.getGeometryForArea(renderer.visibleArea) ?? [],
    );
  }

  private selectGlobeTiles(renderer: CanvasRenderer) {
    const center = renderer.viewportCenter;
    const frame = new TerraGlobeLocalFrame({
      longitudeRadians: worldUToLongitudeRadians(center.x),
      latitudeRadians: worldVToLatitudeRadians(center.y),
    });
    const view = terraGlobeLocalFrameView(renderer, renderer.zoom, this.pitchDegrees);
    const maxLevel = this.globeMaxTileLevel();
    const targetLevel = terraGlobeStableTargetLevel(
      renderer,
      view,
      maxLevel,
      TERRA_GLOBE_TARGET_PIXELS,
    );

    return frame.selectTiles({
      camera: view.camera,
      viewportWidth: renderer.width,
      viewportHeight: renderer.height,
      targetPixels: TERRA_GLOBE_TARGET_PIXELS,
      samplesPerEdge: 5,
      maxLevel,
      targetLevel,
      modelMatrix: view.modelMatrix,
    });
  }

  private globeMaxTileLevel() {
    return Math.max(
      0,
      Math.min(TERRA_GLOBE_MAX_TILE_LEVEL, this.maxTileLevel ?? TERRA_GLOBE_MAX_TILE_LEVEL),
    );
  }

  private collectionsForGlobeSelection(selection: TerraGlobeTileSelection) {
    return this.uniqueCollections(
      this.lazyTreeRoot?.getGeometryForTiles(
        selection.tiles.map((tile) => ({
          level: tile.level,
          index: mortonTileIndexFromXYLevel(tile.x, tile.y, tile.level),
        })),
      ) ?? [],
    );
  }

  private debugTilesForGlobeSelection(selection: TerraGlobeTileSelection): TerraDebugTile[] {
    return selection.tiles.map((tile) => ({
      level: tile.level,
      index: mortonTileIndexFromXYLevel(tile.x, tile.y, tile.level),
      minX: tile.minU,
      minY: tile.minV,
      maxX: tile.maxU,
      maxY: tile.maxV,
    }));
  }

  private uniqueCollections(collections: Array<GeometryCollection | undefined>) {
    return collections
      .filter((el, ind, original) => el !== undefined && original.indexOf(el) === ind)
      .filter((geometry): geometry is GeometryCollection => geometry !== undefined);
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
