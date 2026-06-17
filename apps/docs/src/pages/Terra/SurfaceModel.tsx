import { useEffect, useRef, useState } from 'react';
import {
  Camera3D,
  LTElement,
  LunaTerraEngine,
  type CanvasRenderer,
} from '@lunaterra/core';
import { TerraSurfaceModel } from '@lunaterra/terra';
import { M4, V2, V3 } from '@lunaterra/math';
import { DocPage } from '../../components/DocPage/DocPage';

interface SurfaceSceneConfig {
  curvature: number;
  offsetU: number;
  offsetV: number;
  zoom: number;
}

const DEFAULT_CONFIG: SurfaceSceneConfig = {
  curvature: 1,
  offsetU: 0,
  offsetV: 0,
  zoom: 1,
};

class TerraSurfaceScene extends LTElement {
  private config: SurfaceSceneConfig;

  constructor(config: SurfaceSceneConfig) {
    super();
    this.config = config;
  }

  public setConfig(config: SurfaceSceneConfig) {
    this.config = config;
    this.engine?.requestUpdate();
  }

  protected defaultOptions() {
    return {};
  }

  override render(renderer: CanvasRenderer) {
    const aspect = renderer.height === 0 ? 1 : renderer.width / renderer.height;
    const distance = Math.max(1.35, 4.2 / this.config.zoom);
    const camera = new Camera3D({
      mode: 'perspective',
      eye: new V3(0, 0.18, distance),
      target: new V3(0, 0, 0),
      up: new V3(0, 1, 0),
      fovYRadians: Math.PI / 4,
      aspect,
      near: 0.01,
      far: 20,
    });
    const surface = new TerraSurfaceModel({
      curvature: this.config.curvature,
      centerU: 0.5,
      centerV: 0.5,
      offsetU: this.config.offsetU,
      offsetV: this.config.offsetV,
      flatScale: 4,
    });

    this.drawSurfaceGrid(renderer, surface, camera);
    this.drawTileDots(renderer, surface, camera);
    this.drawStatus(renderer);
  }

  private drawSurfaceGrid(renderer: CanvasRenderer, surface: TerraSurfaceModel, camera: Camera3D) {
    const lines: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    let pointOffset = 0;

    const pushLine = (points: Array<[number, number]>) => {
      offsets.push(pointOffset);
      for (const [u, v] of points) {
        const sample = surface.sample(u, v);
        if (!sample.frontFacing && this.config.curvature > 0.1) {
          continue;
        }
        lines.push(sample.position.x, sample.position.y, sample.position.z);
        pointOffset += 1;
      }
      sizes.push(pointOffset - offsets[offsets.length - 1]);
    };

    for (let x = 0; x <= 16; x += 1) {
      const u = x / 16;
      pushLine(Array.from({ length: 97 }, (_, index) => [u, index / 96]));
    }

    for (let y = 0; y <= 16; y += 1) {
      const v = y / 16;
      pushLine(Array.from({ length: 97 }, (_, index) => [index / 96, v]));
    }

    renderer.webgl3d.drawLineStrips(
      new Float32Array(lines),
      offsets,
      sizes,
      'rgba(78, 91, 103, 0.58)',
      camera,
      M4.identity(),
      1,
    );

    const axes = this.axisLines(surface);
    renderer.webgl3d.drawLineStrips(
      axes.points,
      axes.offsets,
      axes.sizes,
      'rgba(36, 86, 140, 0.9)',
      camera,
      M4.identity(),
      2,
    );
  }

  private drawTileDots(renderer: CanvasRenderer, surface: TerraSurfaceModel, camera: Camera3D) {
    const points: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    let pointOffset = 0;
    const step = 1 / 8;
    const markSize = 0.0035;

    for (let y = 0; y <= 8; y += 1) {
      for (let x = 0; x <= 8; x += 1) {
        const u = x * step;
        const v = y * step;
        const a = surface.sample(u - markSize, v);
        const b = surface.sample(u + markSize, v);
        if (a.frontFacing || b.frontFacing || this.config.curvature < 0.1) {
          offsets.push(pointOffset);
          points.push(a.position.x, a.position.y, a.position.z);
          points.push(b.position.x, b.position.y, b.position.z);
          sizes.push(2);
          pointOffset += 2;
        }
        const c = surface.sample(u, v - markSize);
        const d = surface.sample(u, v + markSize);
        if (c.frontFacing || d.frontFacing || this.config.curvature < 0.1) {
          offsets.push(pointOffset);
          points.push(c.position.x, c.position.y, c.position.z);
          points.push(d.position.x, d.position.y, d.position.z);
          sizes.push(2);
          pointOffset += 2;
        }
      }
    }

    renderer.webgl3d.drawLineStrips(
      new Float32Array(points),
      offsets,
      sizes,
      'rgba(126, 76, 56, 0.9)',
      camera,
      M4.identity(),
      2,
    );
  }

  private axisLines(surface: TerraSurfaceModel) {
    const points: number[] = [];
    const offsets: number[] = [];
    const sizes: number[] = [];
    let pointOffset = 0;
    const push = (coords: Array<[number, number]>) => {
      offsets.push(pointOffset);
      for (const [u, v] of coords) {
        const sample = surface.sample(u, v);
        points.push(sample.position.x, sample.position.y, sample.position.z);
        pointOffset += 1;
      }
      sizes.push(pointOffset - offsets[offsets.length - 1]);
    };

    push(Array.from({ length: 145 }, (_, index) => [index / 144, 0.5]));
    push(Array.from({ length: 73 }, (_, index) => [0.5, index / 72]));

    return {
      points: new Float32Array(points),
      offsets,
      sizes,
    };
  }

  private drawStatus(renderer: CanvasRenderer) {
    renderer.drawScreenSpace('#364152').renderText(
      `curvature ${this.config.curvature.toFixed(2)}  u ${this.config.offsetU.toFixed(2)}  v ${this.config.offsetV.toFixed(2)}`,
      new V2(16, 28),
      13,
    );
  }
}

function SurfacePreview({ config }: { config: SurfaceSceneConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TerraSurfaceScene | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engine.interactive = false;
    engine.background = '#f6f4ef';
    const scene = new TerraSurfaceScene(DEFAULT_CONFIG);
    sceneRef.current = scene;
    container.appendChild(engine.getHtmlElements());
    engine.add(scene);
    engine.requestUpdate();

    return () => {
      sceneRef.current = null;
      engine.destroy();
      container.innerHTML = '';
    };
  }, []);

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
        display: 'flex',
        height: 520,
        overflow: 'hidden',
      }}
    />
  );
}

export default function TerraSurfaceModelPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const patchConfig = (patch: Partial<SurfaceSceneConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  return (
    <DocPage title="Surface Model" section="@lunaterra/terra">
      <DocPage.Section id="overview" title="Overview">
        <p>
          This diagnostic renders the map parameter domain without loading tile
          data. The same sampled <code>u/v</code> grid is projected through a
          virtual surface so curvature can be inspected independently from zoom,
          network requests, and real geometry.
        </p>
      </DocPage.Section>

      <DocPage.Section id="preview" title="Preview">
        <SurfacePreview config={config} />
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginTop: 12,
          }}
        >
          <RangeControl
            label="Curvature"
            min={0}
            max={1}
            step={0.01}
            value={config.curvature}
            onChange={(curvature) => patchConfig({ curvature })}
          />
          <RangeControl
            label="U offset"
            min={-1}
            max={1}
            step={0.01}
            value={config.offsetU}
            onChange={(offsetU) => patchConfig({ offsetU })}
          />
          <RangeControl
            label="V offset"
            min={-0.5}
            max={0.5}
            step={0.01}
            value={config.offsetV}
            onChange={(offsetV) => patchConfig({ offsetV })}
          />
          <RangeControl
            label="Zoom"
            min={0.7}
            max={4}
            step={0.05}
            value={config.zoom}
            onChange={(zoom) => patchConfig({ zoom })}
          />
        </div>
      </DocPage.Section>

      <DocPage.Section id="next" title="Next">
        <p>
          The next implementation step is to route debug tile fill through the
          same surface evaluator, then use that evaluator for real tile
          requests once the surface behavior is stable.
        </p>
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
      <span>{label} {value.toFixed(step < 0.05 ? 2 : 1)}</span>
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
