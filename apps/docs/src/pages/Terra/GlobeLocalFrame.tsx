import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera3D,
  LTElement,
  LunaTerraEngine,
  type CanvasRenderer,
} from '@lunaterra/core';
import {
  TerraGlobeLocalFrame,
  terraGlobeLocalFrameView,
  terraGlobeStableTargetLevel,
  worldUToLongitudeRadians,
  worldVToLatitudeRadians,
  type TerraGlobeTile,
  type TerraGlobeTileSelection,
} from '@lunaterra/terra';
import { M4, V2, V3 } from '@lunaterra/math';
import { DocPage } from '../../components/DocPage/DocPage';

interface GlobeFrameConfig {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  maxLevel: number;
}

interface LineBuffer {
  points: number[];
  offsets: number[];
  sizes: number[];
  pointOffset: number;
}

const DEFAULT_CONFIG: GlobeFrameConfig = {
  longitude: 0,
  latitude: 0,
  zoom: 1,
  pitch: 0,
  bearing: 0,
  maxLevel: 7,
};
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 500;

const createLineBuffer = (): LineBuffer => ({
  points: [],
  offsets: [],
  sizes: [],
  pointOffset: 0,
});

const pushLineSegment = (buffer: LineBuffer, a: V3, b: V3) => {
  buffer.offsets.push(buffer.pointOffset);
  buffer.points.push(a.x, a.y, a.z);
  buffer.points.push(b.x, b.y, b.z);
  buffer.sizes.push(2);
  buffer.pointOffset += 2;
};

class GlobeLocalFrameScene extends LTElement {
  private config: GlobeFrameConfig;
  private readonly onViewChange?: (view: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>) => void;
  private lastReportedView: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'> | null = null;
  private latestSelection: TerraGlobeTileSelection | null = null;

  constructor(
    config: GlobeFrameConfig,
    onViewChange?: (view: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>) => void,
  ) {
    super();
    this.config = config;
    this.onViewChange = onViewChange;
  }

  public setConfig(config: GlobeFrameConfig) {
    this.config = config;
    this.engine?.requestUpdate();
  }

  protected defaultOptions() {
    return {};
  }

  override render(renderer: CanvasRenderer) {
    const viewState = this.rendererViewState(renderer);
    const frame = TerraGlobeLocalFrame.fromDegrees(
      viewState.longitude,
      viewState.latitude,
    );
    const view = terraGlobeLocalFrameView(
      renderer,
      viewState.zoom,
      this.config.pitch,
      this.config.bearing,
    );
    const targetLevel = terraGlobeStableTargetLevel(renderer, view, this.config.maxLevel, 256);
    const selection = frame.selectTiles({
      camera: view.camera,
      viewportWidth: renderer.width,
      viewportHeight: renderer.height,
      targetPixels: 256,
      samplesPerEdge: 5,
      maxLevel: this.config.maxLevel,
      targetLevel,
      modelMatrix: view.modelMatrix,
    });
    this.latestSelection = selection;

    this.drawTileFills(renderer, frame, view.camera, view.modelMatrix, selection.tiles);
    this.drawTileBorders(renderer, frame, view.camera, view.modelMatrix, selection.tiles);
    this.drawGraticule(renderer, frame, view.camera, view.modelMatrix);
    this.drawAxes(renderer, view.camera, view.modelMatrix);
    this.drawStatus(renderer, selection, view.renderScale, viewState);
    this.reportViewState(viewState);
  }

  private rendererViewState(renderer: CanvasRenderer) {
    const center = renderer.viewportCenter;
    const longitude = wrapDegrees(worldUToLongitudeRadians(center.x) * 180 / Math.PI);
    const latitude = worldVToLatitudeRadians(center.y) * 180 / Math.PI;
    return {
      longitude,
      latitude: clamp(latitude, -80, 80),
      zoom: renderer.zoom,
    };
  }

  private reportViewState(viewState: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>) {
    if (
      this.lastReportedView &&
      Math.abs(this.lastReportedView.longitude - viewState.longitude) < 0.001 &&
      Math.abs(this.lastReportedView.latitude - viewState.latitude) < 0.001 &&
      Math.abs(this.lastReportedView.zoom - viewState.zoom) < 0.001
    ) {
      return;
    }
    this.lastReportedView = viewState;
    this.onViewChange?.(viewState);
  }

  private drawTileFills(
    renderer: CanvasRenderer,
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    modelMatrix: M4,
    tiles: TerraGlobeTile[],
  ) {
    for (const tile of tiles) {
      const points = this.tileTriangles(frame, camera, tile);
      if (points.length === 0) {
        continue;
      }
      renderer.webgl3d.drawTriangles(
        points,
        stableTileColor(tile),
        camera,
        modelMatrix,
      );
    }
  }

  private tileTriangles(frame: TerraGlobeLocalFrame, camera: Camera3D, tile: TerraGlobeTile) {
    const subdivisions = Math.max(2, Math.min(8, 2 ** Math.max(0, 5 - tile.level)));
    const points: number[] = [];
    for (let y = 0; y < subdivisions; y += 1) {
      const v0 = tile.minV + (tile.maxV - tile.minV) * (y / subdivisions);
      const v1 = tile.minV + (tile.maxV - tile.minV) * ((y + 1) / subdivisions);
      for (let x = 0; x < subdivisions; x += 1) {
        const u0 = tile.minU + (tile.maxU - tile.minU) * (x / subdivisions);
        const u1 = tile.minU + (tile.maxU - tile.minU) * ((x + 1) / subdivisions);
        const centerU = (u0 + u1) / 2;
        const centerV = (v0 + v1) / 2;
        if (!frame.isFrontFacingForCamera(
          worldUToLongitudeRadians(centerU),
          worldVToLatitudeRadians(centerV),
          camera,
        )) {
          continue;
        }
        const p0 = projectWorld(frame, u0, v0);
        const p1 = projectWorld(frame, u1, v0);
        const p2 = projectWorld(frame, u1, v1);
        const p3 = projectWorld(frame, u0, v1);
        points.push(
          p0.x, p0.y, p0.z,
          p1.x, p1.y, p1.z,
          p2.x, p2.y, p2.z,
          p0.x, p0.y, p0.z,
          p2.x, p2.y, p2.z,
          p3.x, p3.y, p3.z,
        );
      }
    }
    return new Float32Array(points);
  }

  private drawTileBorders(
    renderer: CanvasRenderer,
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    modelMatrix: M4,
    tiles: TerraGlobeTile[],
  ) {
    const buffer = createLineBuffer();
    for (const tile of tiles) {
      this.pushTileEdge(buffer, frame, camera, tile.minU, tile.minV, tile.maxU, tile.minV);
      this.pushTileEdge(buffer, frame, camera, tile.maxU, tile.minV, tile.maxU, tile.maxV);
      this.pushTileEdge(buffer, frame, camera, tile.maxU, tile.maxV, tile.minU, tile.maxV);
      this.pushTileEdge(buffer, frame, camera, tile.minU, tile.maxV, tile.minU, tile.minV);
    }
    this.drawLineBuffer(renderer, buffer, camera, modelMatrix, 'rgba(36, 46, 56, 0.52)', 1);
  }

  private pushTileEdge(
    buffer: LineBuffer,
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ) {
    const segments = 8;
    for (let i = 0; i < segments; i += 1) {
      const a = i / segments;
      const b = (i + 1) / segments;
      const au = u0 + (u1 - u0) * a;
      const av = v0 + (v1 - v0) * a;
      const bu = u0 + (u1 - u0) * b;
      const bv = v0 + (v1 - v0) * b;
      if (!this.isFrontFacingSegment(frame, camera, au, av, bu, bv)) {
        continue;
      }
      pushLineSegment(buffer, projectWorld(frame, au, av), projectWorld(frame, bu, bv));
    }
  }

  private drawGraticule(
    renderer: CanvasRenderer,
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    modelMatrix: M4,
  ) {
    const buffer = createLineBuffer();
    for (let lon = -180; lon <= 180; lon += 30) {
      for (let lat = -80; lat < 80; lat += 2) {
        this.pushGeoSegment(buffer, frame, camera, lon, lat, lon, lat + 2);
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 2) {
        this.pushGeoSegment(buffer, frame, camera, lon, lat, lon + 2, lat);
      }
    }
    this.drawLineBuffer(renderer, buffer, camera, modelMatrix, 'rgba(20, 90, 130, 0.35)', 1);
  }

  private pushGeoSegment(
    buffer: LineBuffer,
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    lon0: number,
    lat0: number,
    lon1: number,
    lat1: number,
  ) {
    const u0 = (lon0 + 180) / 360;
    const u1 = (lon1 + 180) / 360;
    const v0 = latToWorldV(lat0);
    const v1 = latToWorldV(lat1);
    if (!this.isFrontFacingSegment(frame, camera, u0, v0, u1, v1)) {
      return;
    }
    pushLineSegment(buffer, projectWorld(frame, u0, v0), projectWorld(frame, u1, v1));
  }

  private isFrontFacingSegment(
    frame: TerraGlobeLocalFrame,
    camera: Camera3D,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
  ) {
    return (
      frame.isFrontFacingForCamera(
        worldUToLongitudeRadians(u0),
        worldVToLatitudeRadians(v0),
        camera,
      ) ||
      frame.isFrontFacingForCamera(
        worldUToLongitudeRadians(u1),
        worldVToLatitudeRadians(v1),
        camera,
      )
    );
  }

  private drawAxes(renderer: CanvasRenderer, camera: Camera3D, modelMatrix: M4) {
    const buffer = createLineBuffer();
    pushLineSegment(buffer, new V3(0, 0, 0), new V3(0.22, 0, 0));
    pushLineSegment(buffer, new V3(0, 0, 0), new V3(0, 0.22, 0));
    pushLineSegment(buffer, new V3(0, 0, 0), new V3(0, 0, 0.22));
    this.drawLineBuffer(renderer, buffer, camera, modelMatrix, 'rgba(20, 30, 45, 0.95)', 3);
  }

  private drawLineBuffer(
    renderer: CanvasRenderer,
    buffer: LineBuffer,
    camera: Camera3D,
    modelMatrix: M4,
    color: string,
    lineWidth: number,
  ) {
    if (buffer.pointOffset === 0) {
      return;
    }
    renderer.webgl3d.drawLineStrips(
      new Float32Array(buffer.points),
      buffer.offsets,
      buffer.sizes,
      color,
      camera,
      modelMatrix,
      lineWidth,
    );
  }

  private drawStatus(
    renderer: CanvasRenderer,
    selection: TerraGlobeTileSelection,
    renderScale: number,
    viewState: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>,
  ) {
    renderer.drawScreenSpace('#26313d').renderText(
      [
        `target ${viewState.longitude.toFixed(1)}, ${viewState.latitude.toFixed(1)}`,
        `zoom ${viewState.zoom.toFixed(2)}`,
        `scale ${renderScale.toFixed(2)}`,
        `level ${selection.targetLevel}`,
        `tiles ${selection.tiles.length}`,
        `visited ${selection.visited}`,
        `hidden ${selection.hidden}`,
        `frustum ${selection.frustumRejected}`,
      ].join('  '),
      new V2(16, 28),
      13,
    );
  }

  public stats() {
    return this.latestSelection;
  }
}

function GlobeLocalFramePreview({
  config,
  onReady,
  onViewChange,
}: {
  config: GlobeFrameConfig;
  onReady: (engine: LunaTerraEngine | null) => void;
  onViewChange: (view: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeLocalFrameScene | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engine.interactive = true;
    engine.background = '#f6f4ef';
    engine.renderer.minZoom = ZOOM_MIN;
    engine.renderer.maxZoom = ZOOM_MAX;
    engine.moveViewportTo(new V2(
      longitudeDegreesToWorldU(DEFAULT_CONFIG.longitude),
      latToWorldV(DEFAULT_CONFIG.latitude),
    ));
    engine.zoomToPoint(engine.viewportCenter, DEFAULT_CONFIG.zoom);
    const scene = new GlobeLocalFrameScene(DEFAULT_CONFIG, onViewChange);
    sceneRef.current = scene;
    container.appendChild(engine.getHtmlElements());
    engine.add(scene);
    onReady(engine);
    engine.requestUpdate();

    return () => {
      sceneRef.current = null;
      onReady(null);
      engine.destroy();
      container.innerHTML = '';
    };
  }, [onReady, onViewChange]);

  useEffect(() => {
    sceneRef.current?.setConfig(config);
  }, [config]);

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        cursor: 'grab',
        display: 'flex',
        height: 560,
        overflow: 'hidden',
      }}
    />
  );
}

export default function TerraGlobeLocalFramePage() {
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const patchConfig = (patch: Partial<GlobeFrameConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };
  const handleReady = useCallback((engine: LunaTerraEngine | null) => {
    engineRef.current = engine;
  }, []);
  const handleViewChange = useCallback((view: Pick<GlobeFrameConfig, 'longitude' | 'latitude' | 'zoom'>) => {
    setConfig((current) => {
      if (
        Math.abs(current.longitude - view.longitude) < 0.001 &&
        Math.abs(current.latitude - view.latitude) < 0.001 &&
        Math.abs(current.zoom - view.zoom) < 0.001
      ) {
        return current;
      }
      return { ...current, ...view };
    });
  }, []);
  const moveViewport = (longitude: number, latitude: number) => {
    engineRef.current?.moveViewportTo(new V2(
      longitudeDegreesToWorldU(longitude),
      latToWorldV(latitude),
    ));
  };
  const setViewportZoom = (zoom: number) => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    engine.zoomToPoint(engine.viewportCenter, clamp(zoom, ZOOM_MIN, ZOOM_MAX));
  };

  return (
    <DocPage title="Globe Local Frame" section="@lunaterra/terra">
      <DocPage.Section id="overview" title="Overview">
        <p>
          This diagnostic renders synthetic map tiles through the globe-local
          frame planned for Terra. It does not load OSM geometry. Tile selection,
          culling, and tile size are driven by projected screen size through the
          same camera used for rendering.
        </p>
      </DocPage.Section>

      <DocPage.Section id="preview" title="Preview">
        <GlobeLocalFramePreview
          config={config}
          onReady={handleReady}
          onViewChange={handleViewChange}
        />
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginTop: 12,
          }}
        >
          <RangeControl
            label="Longitude"
            min={-180}
            max={180}
            step={1}
            value={config.longitude}
            onChange={(longitude) => {
              patchConfig({ longitude });
              moveViewport(longitude, config.latitude);
            }}
          />
          <RangeControl
            label="Latitude"
            min={-80}
            max={80}
            step={1}
            value={config.latitude}
            onChange={(latitude) => {
              patchConfig({ latitude });
              moveViewport(config.longitude, latitude);
            }}
          />
          <RangeControl
            label="Zoom"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={1}
            value={config.zoom}
            onChange={(zoom) => {
              patchConfig({ zoom });
              setViewportZoom(zoom);
            }}
          />
          <RangeControl
            label="Pitch"
            min={0}
            max={75}
            step={1}
            value={config.pitch}
            onChange={(pitch) => patchConfig({ pitch })}
          />
          <RangeControl
            label="Bearing"
            min={-180}
            max={180}
            step={1}
            value={config.bearing}
            onChange={(bearing) => patchConfig({ bearing })}
          />
          <RangeControl
            label="Max level"
            min={0}
            max={15}
            step={1}
            value={config.maxLevel}
            onChange={(maxLevel) => patchConfig({ maxLevel })}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
      <span>{label} {value.toFixed(step < 1 ? 1 : 0)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function projectWorld(frame: TerraGlobeLocalFrame, u: number, v: number) {
  return frame.project(worldUToLongitudeRadians(u), worldVToLatitudeRadians(v));
}

function longitudeDegreesToWorldU(longitudeDegrees: number) {
  return ((longitudeDegrees + 180) / 360 % 1 + 1) % 1;
}

function stableTileColor(tile: TerraGlobeTile) {
  let hash = (
    tile.level * 0x9e3779b1 ^
    tile.x * 0x85ebca6b ^
    tile.y * 0xc2b2ae35
  ) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  const r = 70 + (hash & 0x7f);
  const g = 70 + ((hash >>> 8) & 0x7f);
  const b = 70 + ((hash >>> 16) & 0x7f);
  return `rgba(${r}, ${g}, ${b}, 0.72)`;
}

function latToWorldV(latitudeDegrees: number) {
  const lat = latitudeDegrees * Math.PI / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + lat / 2));
  return (1 + mercator / Math.PI) / 2;
}

function wrapDegrees(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
