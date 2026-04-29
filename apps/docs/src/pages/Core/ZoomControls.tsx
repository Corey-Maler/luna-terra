import { useEffect, useRef } from 'react';
import { V2, Rect2D } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import {
  LunaTerraEngine,
  LTElement,
  ScaleIndicator,
  ZoomControls,
  type CanvasRenderer,
} from '@lunaterra/core';
import { Line } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── World layout ──────────────────────────────────────────────────────────
// Four named zones tiling the [0,1]² world.

const ZONES = [
  {
    label: 'Alpha',
    bounds: new Rect2D(new V2(0.05, 0.05), new V2(0.47, 0.47)),
    color: new Color(60, 120, 220),
    bg: new Color(210, 225, 255),
  },
  {
    label: 'Beta',
    bounds: new Rect2D(new V2(0.53, 0.05), new V2(0.95, 0.47)),
    color: new Color(200, 60, 70),
    bg: new Color(255, 210, 210),
  },
  {
    label: 'Gamma',
    bounds: new Rect2D(new V2(0.05, 0.53), new V2(0.47, 0.95)),
    color: new Color(40, 160, 90),
    bg: new Color(200, 245, 215),
  },
  {
    label: 'Delta',
    bounds: new Rect2D(new V2(0.53, 0.53), new V2(0.95, 0.95)),
    color: new Color(180, 100, 20),
    bg: new Color(255, 235, 195),
  },
] as const;

const CONTENT_BOUNDS = new Rect2D(new V2(0.0, 0.0), new V2(1.0, 1.0));

// ── Zone element ──────────────────────────────────────────────────────────

interface ZoneOpts {
  label: string;
  bounds: Rect2D;
  color: Color;
  bg: Color;
}

/**
 * Draws one named zone rectangle.
 * Registers a canvas click listener in setup(); zooms to own bounds on click.
 */
class ZoneElement extends LTElement<ZoneOpts> {
  protected defaultOptions(): ZoneOpts {
    return {
      label: '',
      bounds: Rect2D.identity(),
      color: new Color(0, 0, 0),
      bg: new Color(255, 255, 255),
    };
  }

  private _cleanup?: () => void;

  setup(engine: LunaTerraEngine) {
    super.setup(engine);
    const canvas = engine.renderer.canvas;
    const handler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const hdpi = window.devicePixelRatio || 1;
      const sx = (e.clientX - rect.left) * hdpi;
      const sy = (e.clientY - rect.top) * hdpi;
      const world = engine.renderer.screenToWorld(new V2(sx, sy));
      if (this.options.bounds.contains(world)) {
        engine.zoomToRect(this.options.bounds, 0.85);
        engine.requestUpdate();
      }
    };
    canvas.addEventListener('click', handler);
    this._cleanup = () => canvas.removeEventListener('click', handler);
  }

  render(renderer: CanvasRenderer) {
    const { bounds, color, bg, label } = this.options;
    const { v1, v2 } = bounds;

    // Background fill
    const fill = renderer.draw(bg.toString(), 1);
    fill.rect(v1, v2);
    fill.fill(bg);

    // Border
    const border = renderer.draw(color.toString(), 1.5);
    border.rect(v1, v2);
    border.stroke();

    // Zone label (top-left inside the box)
    renderer.draw(color.toString()).renderText(
      label,
      new V2(v1.x + 0.015, v1.y + 0.045),
    );
  }

  destroy() {
    this._cleanup?.();
  }
}

// ── Zone content ──────────────────────────────────────────────────────────

function appendZoneContent(parent: LTElement<{}>, zone: typeof ZONES[number]) {
  const b = zone.bounds;
  const cx = (b.v1.x + b.v2.x) / 2;
  const cy = (b.v1.y + b.v2.y) / 2;
  const r = Math.min(b.width, b.height) * 0.3;

  if (zone.label === 'Alpha') {
    // Grid of dots
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const x = b.v1.x + 0.05 + col * (b.width - 0.1) / 2;
        const y = b.v1.y + 0.07 + row * (b.height - 0.1) / 2;
        parent.appendChild(new DotElement({ x, y, r: 0.018, color: zone.color }));
      }
    }
  } else if (zone.label === 'Beta') {
    // Star of lines
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const ox = cx + Math.cos(angle) * r;
      const oy = cy + Math.sin(angle) * r;
      const line = new Line(
        { points: [new V2(cx, cy), new V2(ox, oy)] },
        { lineWidth: 2 },
      );
      line.styles.color = zone.color;
      parent.appendChild(line);
    }
  } else if (zone.label === 'Gamma') {
    // Zigzag line
    const pts: V2[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = b.v1.x + 0.04 + t * (b.width - 0.08);
      const y = cy + (i % 2 === 0 ? -r * 0.7 : r * 0.7);
      pts.push(new V2(x, y));
    }
    const line = new Line({ points: pts, cornerRadius: 0.015 }, { lineWidth: 2 });
    line.styles.color = zone.color;
    parent.appendChild(line);
  } else {
    // Concentric rectangles
    for (let k = 0; k < 3; k++) {
      const pad = 0.03 + k * 0.03;
      const el = new RectOutlineElement({
        v1: new V2(b.v1.x + pad, b.v1.y + pad),
        v2: new V2(b.v2.x - pad, b.v2.y - pad),
        color: zone.color,
      });
      parent.appendChild(el);
    }
  }
}

// ── Tiny geometry elements ────────────────────────────────────────────────

interface DotOpts { x: number; y: number; r: number; color: Color }
class DotElement extends LTElement<DotOpts> {
  protected defaultOptions(): DotOpts {
    return { x: 0, y: 0, r: 0.02, color: new Color(0, 0, 0) };
  }
  render(renderer: CanvasRenderer) {
    const { x, y, r, color } = this.options;
    const b = renderer.draw(color.toString(), 1);
    b.arc(new V2(x, y), r, 0, Math.PI * 2, false);
    b.fill(color);
  }
}

interface RectOpts { v1: V2; v2: V2; color: Color }
class RectOutlineElement extends LTElement<RectOpts> {
  protected defaultOptions(): RectOpts {
    return { v1: new V2(0, 0), v2: new V2(1, 1), color: new Color(0, 0, 0) };
  }
  render(renderer: CanvasRenderer) {
    const { v1, v2, color } = this.options;
    const b = renderer.draw(color.toString(), 1.5);
    b.rect(v1, v2);
    b.stroke();
  }
}

// ── Section 1: programmatic zoomToPoint ──────────────────────────────────

type Cfg1 = { targetX: number; targetY: number; targetZoom: number };
const CFG1: Cfg1 = { targetX: 0.5, targetY: 0.5, targetZoom: 4 };

const CODE1 = `
// zoomToPoint(worldPoint, targetZoom) — animated
engine.zoomToPoint(
  new V2(/*@live:targetX:0:1*/0.5, /*@live:targetY:0:1*/0.5),
  /*@live:targetZoom:0.8:20*/4
);
`;

// ── Section 2: programmatic zoomToRect ────────────────────────────────────

type Cfg2 = { padding: number };
const CFG2: Cfg2 = { padding: 0.85 };

const CODE2 = `
// zoomToRect(rect, padding?) — animated
const zone = new Rect2D(
  new V2(0.05, 0.05),
  new V2(0.47, 0.47),
);
engine.zoomToRect(zone, /*@live:padding:0.1:1.0*/0.85);
`;

// ── Section 3: interactive zoomToRect zones ───────────────────────────────
// This scene lives outside LiveCodeScene so it can use a useEffect with a
// stable engine (no rebuild on config change).

function InteractiveZonesScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    container.appendChild(engine.getHtmlElements());
    engine.scrollBounds = CONTENT_BOUNDS;

    const root = new GroupElement();

    ZONES.forEach((zone) => {
      const zoneEl = new ZoneElement(zone);
      appendZoneContent(zoneEl, zone);
      root.appendChild(zoneEl);
    });

    root.appendChild(new HintLabel());
    root.appendChild(new ScaleIndicator({}));
    root.appendChild(new ZoomControls({ contentBounds: CONTENT_BOUNDS }));

    engine.add(root);
    engine.requestUpdate();

    return () => {
      engine.destroy();
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 460, display: 'flex', flexDirection: 'column' }}
    />
  );
}

class HintLabel extends LTElement<{}> {
  protected defaultOptions() { return {}; }
  render(renderer: CanvasRenderer) {
    renderer
      .drawScreenSpace('rgba(0,0,0,0.35)')
      .renderText('click a zone to zoom in  ·  ⊡ to fit all', new V2(10, renderer.height - 36), 11);
  }
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ZoomControlsPage() {
  return (
    <DocPage title="Zoom controls & navigation" section="@lunaterra/core">

      {/* ── zoomToPoint ───────────────────────────────────────────────── */}

      <DocPage.Section id="zoom-to-point" title="zoomToPoint">
        <p>
          Animate the viewport to centre a world-space point at a given zoom level.
          Drag the values below to see the animation in real time.
        </p>
        <LiveCodeScene<Cfg1>
          defaultConfig={CFG1}
          source={CODE1}
          canvasHeight={360}
          zoom={false}
          buildScene={(engine, cfg) => {
            engine.scrollBounds = CONTENT_BOUNDS;
            const root = new GroupElement();

            ZONES.forEach((zone) => {
              const zoneEl = new ZoneElement(zone);
              appendZoneContent(zoneEl, zone);
              root.appendChild(zoneEl);
            });

            root.appendChild(new ScaleIndicator({}));
            root.appendChild(new ZoomControls({ contentBounds: CONTENT_BOUNDS }));
            engine.add(root);

            engine.zoomToPoint(new V2(cfg.targetX, cfg.targetY), cfg.targetZoom);
            engine.requestUpdate();
            return root;
          }}
        />

        <DocPage.Arg>zoomToPoint(worldPoint: V2, targetZoom: number): void</DocPage.Arg>
        <p>
          Smoothly animates the camera so that <code>worldPoint</code> ends up at the
          centre of the viewport, at the requested linear zoom level
          (e.g.&nbsp;<code>2</code>&nbsp;=&nbsp;2×).
          If <code>scrollBounds</code> is set, the final position is clamped to stay
          within bounds.
        </p>
      </DocPage.Section>

      {/* ── zoomToRect ────────────────────────────────────────────────── */}

      <DocPage.Section id="zoom-to-rect" title="zoomToRect">
        <p>
          Animate the viewport so that a world-space rectangle fits in view.
          The <code>padding</code> parameter controls how much of the viewport the
          rect should fill (0–1). Drag the slider to see the effect.
        </p>
        <LiveCodeScene<Cfg2>
          defaultConfig={CFG2}
          source={CODE2}
          canvasHeight={360}
          zoom={false}
          buildScene={(engine, cfg) => {
            engine.scrollBounds = CONTENT_BOUNDS;
            const root = new GroupElement();

            ZONES.forEach((zone) => {
              const zoneEl = new ZoneElement(zone);
              appendZoneContent(zoneEl, zone);
              root.appendChild(zoneEl);
            });

            root.appendChild(new ScaleIndicator({}));
            root.appendChild(new ZoomControls({ contentBounds: CONTENT_BOUNDS }));
            engine.add(root);

            engine.zoomToRect(ZONES[0].bounds, cfg.padding);
            engine.requestUpdate();
            return root;
          }}
        />

        <DocPage.Arg>zoomToRect(rect: Rect2D, padding?: number): void</DocPage.Arg>
        <p>
          Animates the camera to fit <code>rect</code> inside the viewport.{' '}
          <code>padding</code> is a fill-fraction (default&nbsp;<code>0.85</code>):
          lower values leave more margin, <code>1.0</code> fills edge to edge.
        </p>
      </DocPage.Section>

      {/* ── Interactive zones demo ────────────────────────────────────── */}

      <DocPage.Section id="interactive-demo" title="Interactive demo — click to zoom">
        <p>
          Click any zone to animate the viewport to fit it. Press the
          {' '}<strong>⊡</strong> button (bottom-right) to fit everything back in view.
          Panning is clamped to the content bounds.
        </p>
        <InteractiveZonesScene />
        <DocPage.Pre>{`// Inside a click handler:
const world = engine.renderer.screenToWorld(screenPoint);
if (zoneBounds.contains(world)) {
  engine.zoomToRect(zoneBounds, 0.85);
  engine.requestUpdate();
}`}</DocPage.Pre>
      </DocPage.Section>

      {/* ── scrollBounds ──────────────────────────────────────────────── */}

      <DocPage.Section id="scroll-bounds" title="scrollBounds">
        <p>
          Restrict panning so the user cannot scroll past the content area.
          When set, both manual panning and animated navigation are clamped to
          stay within the given rectangle.
        </p>

        <DocPage.Pre>{`// Constrain to the [0,1]² world area
engine.scrollBounds = new Rect2D(
  new V2(0, 0),
  new V2(1, 1),
);

// Remove the constraint
engine.scrollBounds = null;`}</DocPage.Pre>

        <DocPage.Arg>set scrollBounds(bounds: Rect2D | null)</DocPage.Arg>
        <p>
          Assign a world-space <code>Rect2D</code> to clamp the viewport.
          The camera is hard-clamped — it will stop exactly at the boundary edge.
          Set to <code>null</code> to allow unrestricted panning.
        </p>
        <p>
          When the viewport is larger than the bounds (i.e. the user is zoomed out
          far enough to see beyond the content), the content is centred within the
          viewport instead.
        </p>
      </DocPage.Section>

      {/* ── interactive ──────────────────────────────────────────────── */}

      <DocPage.Section id="interactive" title="interactive — disable input">
        <p>
          Set <code>engine.interactive = false</code> to make the viewport
          read-only. The user cannot pan or zoom via mouse or touch — the page
          scrolls normally — but programmatic calls like{' '}
          <code>zoomToPoint</code> and <code>zoomToRect</code> still work.
        </p>

        <DocPage.Pre>{`// Lock the viewport
engine.interactive = false;

// Programmatic navigation still works while locked
engine.zoomToPoint(new V2(0.5, 0.5), 2);

// Re-enable at any time
engine.interactive = true;`}</DocPage.Pre>

        <p>Common uses:</p>
        <ul>
          <li>Diagrams embedded in a page that must not be panned out of frame</li>
          <li>Scenes with draggable elements — disabling canvas pan stops it
            competing with element-drag gestures</li>
          <li>Kiosk or presentation mode where the viewport is driven
            programmatically</li>
        </ul>

        <DocPage.Arg>set interactive(value: boolean)</DocPage.Arg>
        <p>
          Enable or disable all mouse and touch pan/zoom input.
          Defaults to <code>true</code>. When <code>false</code>,
          <code>wheel</code> and <code>touch</code> events pass through
          to the page unhandled.
        </p>
      </DocPage.Section>

      {/* ── API reference ─────────────────────────────────────────────── */}

      <DocPage.Section id="api" title="API reference">

        <DocPage.Arg>zoomToPoint(worldPoint: V2, targetZoom: number): void</DocPage.Arg>
        <p>
          Animate to centre <code>worldPoint</code> at <code>targetZoom</code>.
          Zoom is linear: <code>1</code>&nbsp;=&nbsp;1×, <code>4</code>&nbsp;=&nbsp;4×.
        </p>

        <DocPage.Arg>zoomToRect(rect: Rect2D, padding?: number): void</DocPage.Arg>
        <p>
          Animate to fit <code>rect</code> in view.
          <code>padding</code> (default&nbsp;<code>0.85</code>) is a 0–1 fill-fraction.
        </p>

        <DocPage.Arg>set scrollBounds(bounds: Rect2D | null)</DocPage.Arg>
        <p>
          Clamp panning to a world-space rect, or <code>null</code> to disable.
        </p>

        <DocPage.Arg>renderer.screenToWorld(p: V2): V2</DocPage.Arg>
        <p>
          Convert a screen-space pixel coordinate to world space.
          Useful for mapping click/touch positions to world objects.
        </p>

        <DocPage.Arg>renderer.worldToScreen(p: V2): V2</DocPage.Arg>
        <p>
          Convert a world-space coordinate to screen pixels.
        </p>

        <DocPage.Arg>renderer.zoom: number</DocPage.Arg>
        <p>
          Current linear zoom level (read-only). <code>1</code>&nbsp;=&nbsp;no zoom.
        </p>

        <DocPage.Arg>renderer.visibleArea: Rect2D</DocPage.Arg>
        <p>
          The world-space rectangle currently visible in the viewport (read-only).
        </p>

        <DocPage.Arg>requestUpdate(): void</DocPage.Arg>
        <p>
          Schedule a render. Called automatically by <code>zoomToPoint</code> and <code>zoomToRect</code>;
          call manually after changing scene content or moving the camera programmatically.
        </p>

        <DocPage.Arg>set interactive(value: boolean)</DocPage.Arg>
        <p>
          Enable or disable mouse and touch pan/zoom input. Defaults to <code>true</code>.
          Page scroll is unaffected when <code>false</code>.
        </p>

      </DocPage.Section>

    </DocPage>
  );
}
