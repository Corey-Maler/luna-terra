import { LTElement, CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';
import { V2 } from '@lunaterra/math';
import { LAND_MASK_MAX_DEPTH, LAND_MASK_TYPE_ID, getFeatureTypeById } from './helpers';
import { CommutatorClient } from './Commutator';
import { LazyQuadTree } from './LazyQuadTree';
import { GeometryCollection } from './GeometryCollection';
import type { TerraPlaceLabel } from './types/Mapy';
import {
  emptyTerraRenderStats,
  type TerraRenderStats,
  type TerraTileDebugState,
  type TerraTileDebugStats,
  type TerraTypeStats,
} from './TerraStats';
import type { TerraManifestBounds, TerraTileClient, TerraTileDiagnostics } from './TileClient';
import { TerraMapRenderer } from './TerraMapRenderer';
import {
  TERRA_GLOBE_MAX_TILE_LEVEL,
} from './TerraMapRenderer';
import type { TerraDebugTile, TerraMapMode, TerraMapSurface } from './TerraMapRenderer';
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
import { mortonTileIndexFromXYLevel, mortonTileXYAtLevel } from './TileIndex';

const TERRA_GLOBE_TARGET_PIXELS = 256;
const landMaskTypeIds = new Set([LAND_MASK_TYPE_ID]);

interface TileDebugCandidate {
  tile: TerraDebugTile;
  stats: TerraTileDebugStats;
}

interface GlobeGeometryLayer {
  collections: GeometryCollection[];
  debugTiles: TerraDebugTile[];
  key: string;
  ready: boolean;
}

export interface MapElementOptions {
  onStats?: (stats: TerraRenderStats) => void;
  onTileDebug?: (state: TerraTileDebugState) => void;
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
  private readonly onTileDebug?: (state: TerraTileDebugState) => void;
  private readonly mapRenderer = new TerraMapRenderer();
  private hostEngine?: LunaTerraEngine;
  private debugGrid = false;
  private debugTileFill = false;
  private mapMode: TerraMapMode = 'plane';
  private lastSurface: TerraMapSurface = 'plane';
  private sourceBounds: TerraManifestBounds | null = null;
  private maxTileLevel: number | null = null;
  private pitchDegrees = 0;
  private lastStatsAt = 0;
  private mouseScreen: V2 | null = null;
  private hoveredTile: TerraTileDebugStats | null = null;
  private pinnedTile: TerraTileDebugStats | null = null;
  private lastTileDebugKey = '';
  private lastReadyGlobeLayer: GlobeGeometryLayer | null = null;
  private readonly tileDiagnosticsCache = new Map<string, TerraTileDiagnostics | null>();
  private readonly tileDiagnosticsLoading = new Set<string>();
  private labelCanvas?: HTMLCanvasElement;
  private labelContext?: CanvasRenderingContext2D;
  private unsubscribeMouseMove?: () => void;
  private unsubscribeClick?: () => void;

  constructor(tileBaseUrl?: string, options: MapElementOptions = {}) {
    super();
    this.commutator = new CommutatorClient(options.tileClient ?? tileBaseUrl);
    this.onStats = options.onStats;
    this.onTileDebug = options.onTileDebug;
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

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);
    this.hostEngine = engine;
    this.createLabelOverlay(engine);
    this.lazyTreeRoot = LazyQuadTree.generate({ commutator: this.commutator, engine });
    this.unsubscribeMouseMove = engine.renderer.$mousePositionScreen.subscribe((point) => {
      this.mouseScreen = point;
      engine.requestQuickUpdate();
    });
    this.unsubscribeClick = engine.renderer.mouseHandlers.$clicksWorld.subscribe(() => {
      this.pinnedTile = this.hoveredTile;
      this.reportTileDebug();
    });
  }

  override destroy() {
    this.unsubscribeMouseMove?.();
    this.unsubscribeClick?.();
    this.hostEngine = undefined;
    this.labelCanvas?.remove();
    this.labelCanvas = undefined;
    this.labelContext = undefined;
  }

  override render(renderer: CanvasRenderer) {
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
    const globeLayer = globeSelection
      ? this.globeGeometryLayer(globeSelection)
      : null;
    const collections = globeLayer
      ? globeLayer.collections
      : this.collectionsForArea(renderer);
    const labels = globeSelection
      ? this.lazyTreeRoot?.getLabelsForTiles(globeSelection.tiles.map((tile) => ({
        level: tile.level,
        index: mortonTileIndexFromXYLevel(tile.x, tile.y, tile.level),
      }))) ?? []
      : this.lazyTreeRoot?.getLabelsForArea(renderer.visibleArea) ?? [];
    const debugTiles = this.debugTileFill && globeSelection
      ? this.debugTilesForGlobeSelection(globeSelection)
      : undefined;
    const tileCandidates = debugTiles
      ? this.tileCandidatesForDebugTiles(debugTiles)
      : this.tileCandidatesForCollections(collections);

    this.updateHoveredTile(renderer, tileCandidates);

    this.lastSurface = this.mapRenderer.render(renderer, collections, {
      debugGrid: this.debugGrid,
      debugTiles,
      debugTileFill: this.debugTileFill,
      highlightedTile: this.findTileForStats(tileCandidates, this.hoveredTile),
      mapMode: this.mapMode,
      pitchDegrees: this.pitchDegrees,
      sourceBounds: this.sourceBounds,
    });
    this.renderPlaceLabels(renderer, labels);

    this.reportStats(renderer, collections);
  }

  private renderPlaceLabels(renderer: CanvasRenderer, labels: TerraPlaceLabel[]) {
    const context = this.labelContext;
    const canvas = this.labelCanvas;
    if (!context || !canvas) {
      return;
    }
    if (canvas.width !== renderer.canvas.width || canvas.height !== renderer.canvas.height) {
      canvas.width = renderer.canvas.width;
      canvas.height = renderer.canvas.height;
    }
    context.setTransform(renderer.hdpi, 0, 0, renderer.hdpi, 0, 0);
    context.clearRect(0, 0, renderer.width, renderer.height);
    const occupied: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    const priority = { city: 0, town: 1, village: 2, road: 3 };
    for (const label of [...labels].sort((a, b) => priority[a.kind] - priority[b.kind])) {
      if (label.kind === 'road' && renderer.zoom < 11) {
        continue;
      }
      const point = this.mapRenderer.projectWorldToScreen(renderer, label.x, label.y, {
        mapMode: this.mapMode,
        pitchDegrees: this.pitchDegrees,
      });
      if (!point && label.kind !== 'road') {
        continue;
      }
      const size = label.kind === 'city' ? 16 : label.kind === 'town' ? 14 : label.kind === 'village' ? 12 : 11;
      const width = label.text.length * size * 0.58;
      const roadPlacement = label.kind === 'road'
        ? this.roadLabelPlacement(renderer, label.path ?? [], width)
        : undefined;
      if (label.kind === 'road' && !roadPlacement) {
        continue;
      }
      const cssPoint = roadPlacement?.point ?? new V2(point!.x / renderer.hdpi, point!.y / renderer.hdpi);
      const angle = roadPlacement?.angle ?? 0;
      const projectedWidth = Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * size;
      const projectedHeight = Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * size;
      const bounds = {
        left: cssPoint.x - projectedWidth / 2 - 3,
        top: cssPoint.y - projectedHeight / 2 - 3,
        right: cssPoint.x + projectedWidth / 2 + 3,
        bottom: cssPoint.y + projectedHeight / 2 + 3,
      };
      if (occupied.some((other) => bounds.left < other.right && bounds.right > other.left && bounds.top < other.bottom && bounds.bottom > other.top)) {
        continue;
      }
      occupied.push(bounds);
      context.fillStyle = label.kind === 'road' ? '#5b5f64' : '#39434d';
      context.font = `${size}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      if (roadPlacement) {
        context.save();
        context.translate(cssPoint.x, cssPoint.y);
        context.rotate(angle);
        context.fillText(label.text, 0, 0);
        context.restore();
      } else {
        context.fillText(label.text, cssPoint.x, cssPoint.y);
      }
    }
  }

  private roadLabelPlacement(renderer: CanvasRenderer, path: V2[], textWidth: number) {
    let best: { point: V2; angle: number; length: number } | undefined;
    for (let index = 1; index < path.length; index += 1) {
      const from = this.mapRenderer.projectWorldToScreen(renderer, path[index - 1].x, path[index - 1].y, {
        mapMode: this.mapMode,
        pitchDegrees: this.pitchDegrees,
      });
      const to = this.mapRenderer.projectWorldToScreen(renderer, path[index].x, path[index].y, {
        mapMode: this.mapMode,
        pitchDegrees: this.pitchDegrees,
      });
      if (!from || !to) {
        continue;
      }
      const dx = (to.x - from.x) / renderer.hdpi;
      const dy = (to.y - from.y) / renderer.hdpi;
      const length = Math.hypot(dx, dy);
      if (length < textWidth + 12 || length <= (best?.length ?? 0)) {
        continue;
      }
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }
      best = {
        point: new V2((from.x + to.x) / (2 * renderer.hdpi), (from.y + to.y) / (2 * renderer.hdpi)),
        angle,
        length,
      };
    }
    return best;
  }

  private createLabelOverlay(engine: LunaTerraEngine) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'height:100%',
      'left:0',
      'pointer-events:none',
      'position:absolute',
      'top:0',
      'width:100%',
      'z-index:4',
    ].join(';');
    engine.renderer.getHTML().appendChild(canvas);
    this.labelCanvas = canvas;
    this.labelContext = canvas.getContext('2d') ?? undefined;
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

  private globeGeometryLayer(selection: TerraGlobeTileSelection): GlobeGeometryLayer {
    const tileRequests = selection.tiles.map((tile) => ({
      level: tile.level,
      index: mortonTileIndexFromXYLevel(tile.x, tile.y, tile.level),
    }));
    const maskTileRequests = this.landMaskTileRequests(selection);
    const key = [
      tileRequests.map((tile) => `${tile.level}/${tile.index}`).join('|'),
      maskTileRequests.map((tile) => `${tile.level}/${tile.index}`).join('|'),
    ].join('::');
    const debugTiles = this.debugTilesForGlobeSelection(selection);
    const rawCollections = this.lazyTreeRoot?.getGeometryForTiles(tileRequests, { fallback: false }) ?? [];
    const rawMaskCollections = this.lazyTreeRoot?.getGeometryForTiles(maskTileRequests, { fallback: false }) ?? [];
    const maskCollections = this.uniqueCollections(rawMaskCollections)
      .map((collection) => collection.filterByTypeIds(landMaskTypeIds))
      .filter((collection) => collection.geometry.length > 0);
    const statuses = tileRequests.map((tile) =>
      this.lazyTreeRoot?.getTileStatus(tile.index, tile.level) ?? {
        loaded: false,
        loading: false,
        missing: false,
        geometryCount: null,
      }
    );
    const maskStatuses = maskTileRequests.map((tile) =>
      this.lazyTreeRoot?.getTileStatus(tile.index, tile.level) ?? {
        loaded: false,
        loading: false,
        missing: false,
        geometryCount: null,
      }
    );
    const ready = [...statuses, ...maskStatuses].every((status) => status.loaded || status.missing);
    const layer = {
      collections: this.uniqueCollections([...maskCollections, ...rawCollections]),
      debugTiles,
      key,
      ready,
    };

    if (ready) {
      this.lastReadyGlobeLayer = layer;
      return layer;
    }

    if (layer.collections.length > 0) {
      return layer;
    }

    return this.lastReadyGlobeLayer ?? layer;
  }

  private landMaskTileRequests(selection: TerraGlobeTileSelection) {
    const byKey = new Map<string, { level: number; index: number }>();
    for (const tile of selection.tiles) {
      if (tile.level > LAND_MASK_MAX_DEPTH) {
        continue;
      }
      const index = mortonTileIndexFromXYLevel(tile.x, tile.y, tile.level);
      const level = tile.level;
      byKey.set(`${level}/${index}`, { level, index });
    }
    return Array.from(byKey.values());
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

  private tileCandidatesForCollections(collections: GeometryCollection[]): TileDebugCandidate[] {
    return collections.flatMap((collection): TileDebugCandidate[] => {
      if (!collection.source) {
        return [];
      }
      const tile = this.tileForSource(collection.source.level, collection.source.index);
      return [{
        tile,
        stats: this.tileStats(tile, {
          loaded: true,
          loading: false,
          missing: false,
          geometryCount: collection.geometry.length,
        }),
      }];
    });
  }

  private tileCandidatesForDebugTiles(tiles: TerraDebugTile[]): TileDebugCandidate[] {
    return tiles.map((tile) => this.tileCandidateForDebugTile(tile));
  }

  private tileCandidateForDebugTile(tile: TerraDebugTile): TileDebugCandidate {
    const status = this.lazyTreeRoot?.getTileStatus(tile.index, tile.level) ?? {
      loaded: false,
      loading: false,
      missing: false,
      geometryCount: null,
    };
    return {
      tile,
      stats: this.tileStats(tile, status),
    };
  }

  private tileStats(
    tile: TerraDebugTile,
    status: Pick<TerraTileDebugStats, 'loaded' | 'loading' | 'missing' | 'geometryCount'>,
  ): TerraTileDebugStats {
    const centerY = (tile.minY + tile.maxY) * 0.5;
    const centerLatitudeRadians = worldVToLatitudeRadians(centerY);
    const latitudeScale = Math.abs(Math.cos(centerLatitudeRadians));
    return {
      level: tile.level,
      index: tile.index,
      loaded: status.loaded,
      loading: status.loading,
      missing: status.missing,
      geometryCount: status.geometryCount,
      projectedSize: null,
      centerLatitudeDegrees: centerLatitudeRadians * 180 / Math.PI,
      latitudeScale,
      nominalTilePixels: TERRA_GLOBE_TARGET_PIXELS,
      estimatedGlobeTilePixels: TERRA_GLOBE_TARGET_PIXELS * latitudeScale,
      pipelineDiagnostics: this.tileDiagnosticsCache.get(this.tileKey(tile)) ?? null,
      bounds: {
        minX: tile.minX,
        minY: tile.minY,
        maxX: tile.maxX,
        maxY: tile.maxY,
      },
    };
  }

  private tileForSource(level: number, index: number): TerraDebugTile {
    const size = 1 / 2 ** level;
    const xy = mortonTileXYAtLevel(index, level);
    return {
      level,
      index,
      minX: xy.x * size,
      minY: xy.y * size,
      maxX: (xy.x + 1) * size,
      maxY: (xy.y + 1) * size,
    };
  }

  private updateHoveredTile(renderer: CanvasRenderer, candidates: TileDebugCandidate[]) {
    const screen = this.mouseScreen;
    const hitTile = screen
      ? this.mapRenderer.hitTestTile(
        renderer,
        candidates.map((candidate) => candidate.tile),
        screen,
        {
          mapMode: this.mapMode,
          pitchDegrees: this.pitchDegrees,
        },
      )
      : null;
    const nextHover = hitTile
      ? this.enrichedTileStats(
        renderer,
        hitTile,
        candidates.find((candidate) => this.tileKey(candidate.tile) === this.tileKey(hitTile))?.stats ?? null,
      )
      : null;

    if (this.tileDebugStateKey(this.hoveredTile) === this.tileDebugStateKey(nextHover)) {
      return;
    }

    this.hoveredTile = nextHover;
    this.reportTileDebug();
  }

  private findTileForStats(candidates: TileDebugCandidate[], stats: TerraTileDebugStats | null) {
    if (!stats) {
      return null;
    }
    return candidates.find((candidate) =>
      this.tileDebugIdentityKey(candidate.stats) === this.tileDebugIdentityKey(stats)
    )?.tile ?? null;
  }

  private reportTileDebug() {
    if (!this.onTileDebug) {
      return;
    }
    const key = `${this.tileDebugStateKey(this.hoveredTile)}|${this.tileDebugStateKey(this.pinnedTile)}`;
    if (key === this.lastTileDebugKey) {
      return;
    }
    this.lastTileDebugKey = key;
    this.onTileDebug({
      hover: this.hoveredTile,
      pinned: this.pinnedTile,
    });
  }

  private tileKey(tile: TerraDebugTile) {
    return `${tile.level}/${tile.index}`;
  }

  private enrichedTileStats(
    renderer: CanvasRenderer,
    tile: TerraDebugTile,
    stats: TerraTileDebugStats | null,
  ) {
    if (!stats) {
      return null;
    }

    this.requestTileDiagnostics(tile);
    const projectedSize = this.mapRenderer.measureTile(renderer, tile, {
      mapMode: this.mapMode,
      pitchDegrees: this.pitchDegrees,
    });

    return {
      ...stats,
      projectedSize,
      pipelineDiagnostics: this.tileDiagnosticsCache.get(this.tileKey(tile)) ?? null,
    };
  }

  private requestTileDiagnostics(tile: TerraDebugTile) {
    const key = this.tileKey(tile);
    if (this.tileDiagnosticsCache.has(key) || this.tileDiagnosticsLoading.has(key)) {
      return;
    }

    this.tileDiagnosticsLoading.add(key);
    void this.commutator.requestDiagnostics(tile.index, tile.level)
      .then((diagnostics) => {
        this.tileDiagnosticsCache.set(key, diagnostics);
      })
      .catch(() => {
        this.tileDiagnosticsCache.set(key, null);
      })
      .finally(() => {
        this.tileDiagnosticsLoading.delete(key);
        this.hostEngine?.requestUpdate();
      });
  }

  private tileDebugIdentityKey(tile: TerraTileDebugStats | null) {
    return tile ? `${tile.level}/${tile.index}` : '-';
  }

  private tileDebugStateKey(tile: TerraTileDebugStats | null) {
    if (!tile) {
      return '-';
    }
    const projected = tile.projectedSize
      ? `${tile.projectedSize.width.toFixed(1)}/${tile.projectedSize.height.toFixed(1)}`
      : '-';
    const pipeline = tile.pipelineDiagnostics
      ? `${tile.pipelineDiagnostics.geometryCount}/${tile.pipelineDiagnostics.pointCount}`
      : '-';
    return [
      tile.level,
      tile.index,
      tile.loaded,
      tile.loading,
      tile.missing,
      tile.geometryCount ?? '-',
      tile.latitudeScale.toFixed(4),
      projected,
      pipeline,
    ].join('/');
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
