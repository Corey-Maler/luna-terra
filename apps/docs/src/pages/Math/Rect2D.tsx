import { Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import {
  Handle,
  LunaTerraEngine,
  LTElement,
  LTStyledElement,
  resolveThemeColor,
  themeColor,
} from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { Axis } from '@lunaterra/charts';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';
import { VectorDemoScene } from '../../components/VectorDemoScene';

const T = DocPage.Type;

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<Record<string, never>> {
  protected defaultOptions() { return {}; }
}

const DOMAIN = 0.45;

function themedColor(renderer: CanvasRenderer, path: string, fallback: Color): Color {
  return resolveThemeColor(themeColor(path), renderer.theme) ?? fallback;
}

// ── Rect element ───────────────────────────────────────────────────────────

interface RectElementOptions {
  v1: V2;
  v2: V2;
  fillOpacity?: number;
}

class RectElement extends LTStyledElement<RectElementOptions> {
  protected defaultOptions(): RectElementOptions {
    return { v1: new V2(0.1, 0.1), v2: new V2(0.4, 0.4), fillOpacity: 0.12 };
  }

  override render(renderer: CanvasRenderer): void {
    const { v1, v2, fillOpacity = 0.12 } = this.options;
    const { color } = this.computedStyles;
    const resolvedColor = color ?? themedColor(renderer, 'math.rect.primary', new Color(70, 130, 220));
    const colorStr = resolvedColor.toString();

    const tl = new V2(v1.x, v2.y);
    const tr = v2.clone();
    const br = new V2(v2.x, v1.y);
    const bl = v1.clone();

    // Fill
    const fill = renderer.draw(colorStr, 1);
    fill.fillStyle = colorStr;
    fill.path([tl, tr, br, bl, tl]);
    fill.fill(resolvedColor.opaque(fillOpacity));

    // Stroke
    const stroke = renderer.draw(colorStr, 1.5);
    stroke.path([tl, tr, br, bl, tl]);
    stroke.stroke();

    // Center dot
    const center = new V2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
    const dotR = renderer.measureScreenInWorld(4);
    const dot = renderer.draw(colorStr, 1);
    dot.fillStyle = colorStr;
    dot.arc(center, dotR);
    dot.fill();

    // Center label
    renderer.draw(colorStr, 1).renderText('center', new V2(center.x + renderer.measureScreenInWorld(10), center.y), 10);
  }
}
// ── Draggable rect (two corner handles) ──────────────────────────────────

interface DraggableRectCallbacks {
  onChangeV1: (v: V2) => void;
  onChangeV2: (v: V2) => void;
}

class DraggableRectElement extends LTElement<DraggableRectCallbacks> {
  public corner1: V2;
  public corner2: V2;
  private _h1?: Handle;
  private _h2?: Handle;

  protected defaultOptions(): DraggableRectCallbacks {
    return { onChangeV1: () => {}, onChangeV2: () => {} };
  }

  constructor(v1: V2, v2: V2, callbacks: DraggableRectCallbacks) {
    super(callbacks);
    this.corner1 = v1.clone();
    this.corner2 = v2.clone();
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    engine.activateInteraction();

    const h1 = new Handle(this.corner1.clone(), {
      onDrag: (p) => { this.corner1 = p; this.options.onChangeV1(p.clone()); },
    });
    h1.styles.color = themeColor('math.rect.primary');
    this._h1 = h1;
    this.appendChild(h1);
    h1.setup(engine);

    const h2 = new Handle(this.corner2.clone(), {
      onDrag: (p) => { this.corner2 = p; this.options.onChangeV2(p.clone()); },
    });
    h2.styles.color = themeColor('math.rect.primary');
    this._h2 = h2;
    this.appendChild(h2);
    h2.setup(engine);
  }

  override destroy(): void {
    this._h1?.destroy();
    this._h2?.destroy();
    super.destroy?.();
  }

  override render(renderer: CanvasRenderer): void {
    const rect = new Rect2D(this.corner1, this.corner2);
    const { v1, v2 } = rect;
    const rectColor = themedColor(renderer, 'math.rect.primary', new Color(70, 130, 220));
    const labelColor = rectColor.opaque(0.65);
    const colorStr = rectColor.opaque(0.85).toString();
    const tl = new V2(v1.x, v2.y);
    const tr = v2.clone();
    const br = new V2(v2.x, v1.y);
    const bl = v1.clone();

    const fill = renderer.draw(colorStr, 1);
    fill.fillStyle = colorStr;
    fill.path([tl, tr, br, bl, tl]);
    fill.fill(rectColor.opaque(0.12));

    renderer.draw(colorStr, 1.5).path([tl, tr, br, bl, tl]);
    renderer.draw(colorStr, 1.5).stroke();

    const center = rect.center;
    const dotR = renderer.measureScreenInWorld(4);
    const dot = renderer.draw(colorStr, 1);
    dot.fillStyle = colorStr;
    dot.arc(center, dotR);
    dot.fill();
    renderer.draw(colorStr, 1).renderText('center', new V2(center.x + renderer.measureScreenInWorld(10), center.y), 10);

    const lOff = renderer.measureScreenInWorld(8);
    renderer.draw(labelColor.toString(), 1).renderText(
      `(${this.corner1.x.toFixed(2)}, ${this.corner1.y.toFixed(2)})`,
      new V2(this.corner1.x + lOff, this.corner1.y - renderer.measureScreenInWorld(14)),
      9,
    );
    renderer.draw(labelColor.toString(), 1).renderText(
      `(${this.corner2.x.toFixed(2)}, ${this.corner2.y.toFixed(2)})`,
      new V2(this.corner2.x - renderer.measureScreenInWorld(50), this.corner2.y + lOff),
      9,
    );
  }
}

// ── Draggable point (containment test) ─────────────────────────────────────

class DraggablePointElement extends LTElement<{ onChangeP: (v: V2) => void }> {
  public point: V2;
  private _handle?: Handle;
  private _rect: Rect2D;

  protected defaultOptions() { return { onChangeP: () => {} }; }

  constructor(p: V2, rect: Rect2D, callbacks: { onChangeP: (v: V2) => void }) {
    super(callbacks);
    this.point = p.clone();
    this._rect = rect;
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    engine.activateInteraction();
    const h = new Handle(this.point.clone(), {
      onDrag: (p) => { this.point = p; this.options.onChangeP(p.clone()); },
    });
    h.styles.color = themeColor('math.state.success');
    this._handle = h;
    this.appendChild(h);
    h.setup(engine);
  }

  override destroy(): void {
    this._handle?.destroy();
    super.destroy?.();
  }

  override render(renderer: CanvasRenderer): void {
    const { point } = this;
    const inside = this._rect.contains(point);
    const color = inside
      ? themedColor(renderer, 'math.state.successStrong', new Color(60, 200, 100)).opaque(0.9).toString()
      : themedColor(renderer, 'math.state.danger', new Color(220, 80, 60)).opaque(0.9).toString();
    const r = renderer.measureScreenInWorld(6);
    const dot = renderer.draw(color, 1);
    dot.fillStyle = color;
    dot.arc(point, r);
    dot.fill();
    renderer.draw(color, 1).renderText(
      inside ? 'inside' : 'outside',
      new V2(point.x + renderer.measureScreenInWorld(10), point.y),
      11,
    );
  }
}
// ── Scene 1: Construction ─────────────────────────────────────────────────

type Scene1Config = { x1: number; y1: number; x2: number; y2: number };
const scene1Defaults: Scene1Config = { x1: -0.25, y1: -0.2, x2: 0.3, y2: 0.28 };

const SCENE1_CODE = `
// Corners are auto-normalised — v1 is always bottom-left.
const rect = new Rect2D(
  new V2(/*@live:x1:-0.4:0.1*/-0.25, /*@live:y1:-0.4:0.1*/-0.20),
  new V2(/*@live:x2:0.1:0.4*/0.30,   /*@live:y2:0.1:0.4*/0.28),
);

console.log(rect.width);   // → ${(0.3 - -0.25).toFixed(2)}
console.log(rect.height);  // → ${(0.28 - -0.2).toFixed(2)}
console.log(rect.center);  // → V2(cx, cy)
`.trim();

function buildScene1(
  engine: LunaTerraEngine,
  config: Scene1Config,
  onCanvasDrag: (patch: Partial<Scene1Config>) => void,
): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = themeColor('math.axis');
  root.appendChild(axis);

  const draggable = new DraggableRectElement(
    new V2(config.x1, config.y1),
    new V2(config.x2, config.y2),
    {
      onChangeV1: (v) => onCanvasDrag({ x1: parseFloat(v.x.toFixed(2)), y1: parseFloat(v.y.toFixed(2)) }),
      onChangeV2: (v) => onCanvasDrag({ x2: parseFloat(v.x.toFixed(2)), y2: parseFloat(v.y.toFixed(2)) }),
    },
  );
  root.appendChild(draggable);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Containment ──────────────────────────────────────────────────

type Scene2Config = { px: number; py: number };
const scene2Defaults: Scene2Config = { px: 0.08, py: 0.06 };

const SCENE2_CODE = `
const rect = new Rect2D(new V2(-0.25, -0.2), new V2(0.3, 0.28));

// Test whether a point falls inside the rect.
const p = new V2(/*@live:px:-0.4:0.4*/0.08, /*@live:py:-0.4:0.4*/0.06);
const inside = rect.contains(p); // true / false
`.trim();

const FIXED_RECT = { v1: new V2(-0.25, -0.2), v2: new V2(0.3, 0.28) };

function buildScene2(
  engine: LunaTerraEngine,
  config: Scene2Config,
  onCanvasDrag: (patch: Partial<Scene2Config>) => void,
): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = themeColor('math.axis');
  root.appendChild(axis);

  const rect = new RectElement({ v1: FIXED_RECT.v1, v2: FIXED_RECT.v2, fillOpacity: 0.08 });
  rect.styles.color = themeColor('math.rect.primary');
  root.appendChild(rect);

  const r2d = new Rect2D(FIXED_RECT.v1, FIXED_RECT.v2);
  const point = new DraggablePointElement(
    new V2(config.px, config.py),
    r2d,
    { onChangeP: (v) => onCanvasDrag({ px: parseFloat(v.x.toFixed(2)), py: parseFloat(v.y.toFixed(2)) }) },
  );
  root.appendChild(point);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Quadrants ────────────────────────────────────────────────────

type Scene3Config = { quad: number };
const scene3Defaults: Scene3Config = { quad: 2 };

const SCENE3_CODE = `
const rect = new Rect2D(new V2(-0.3, -0.3), new V2(0.3, 0.3));

// Returns one of the four sub-rectangles:
//  0 = bottom-left, 1 = bottom-right, 2 = top-right, 3 = top-left
const q = rect.quadrant(/*@live:quad:0:3*/2);
`.trim();

interface QuadrantHighlightOptions { parent: V2; pv2: V2; quadrant: number }
class QuadrantHighlight extends LTStyledElement<QuadrantHighlightOptions> {
  protected defaultOptions(): QuadrantHighlightOptions {
    return { parent: new V2(-0.3, -0.3), pv2: new V2(0.3, 0.3), quadrant: 2 };
  }
  override render(renderer: CanvasRenderer): void {
    const { parent: v1, pv2: v2, quadrant } = this.options;
    const half = new V2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
    const quads: [V2, V2][] = [
      [v1, half],
      [new V2(half.x, v1.y), new V2(v2.x, half.y)],
      [half, v2],
      [new V2(v1.x, half.y), new V2(half.x, v2.y)],
    ];
    const [qv1, qv2] = quads[quadrant] ?? quads[0];
    const quadColor = themedColor(renderer, 'math.rect.quadrant', new Color(160, 80, 220));
    const qColor = quadColor.opaque(0.85).toString();
    const tl = new V2(qv1.x, qv2.y);
    const tr = qv2.clone();
    const br = new V2(qv2.x, qv1.y);
    const bl = qv1.clone();
    const fill = renderer.draw(qColor, 1);
    fill.fillStyle = qColor;
    fill.path([tl, tr, br, bl, tl]);
    fill.fill(quadColor.opaque(0.18));
    renderer.draw(qColor, 1.5).path([tl, tr, br, bl, tl]);
    renderer.draw(qColor, 1.5).stroke();
    const names = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
    const cx = (qv1.x + qv2.x) / 2;
    const cy = (qv1.y + qv2.y) / 2;
    renderer.draw(qColor, 1).renderText(names[quadrant], new V2(cx - renderer.measureScreenInWorld(22), cy), 10);
  }
}

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = themeColor('math.axis');
  root.appendChild(axis);

  const v1 = new V2(-0.3, -0.3);
  const v2 = new V2(0.3, 0.3);

  const parentRect = new RectElement({ v1, v2, fillOpacity: 0.05 });
  parentRect.styles.color = themeColor('math.rect.secondary');
  root.appendChild(parentRect);

  root.appendChild(new QuadrantHighlight({ parent: v1, pv2: v2, quadrant: Math.round(config.quad) }));

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Rect2DPage() {
  return (
    <DocPage title="Rect2D" section="@lunaterra/math">
      <p>
        <T symbol="Rect2D" /> is an axis-aligned bounding rectangle defined by two
        corner points. The constructor auto-normalises them so <code>v1</code> is
        always the bottom-left and <code>v2</code> the top-right, regardless of
        which order they are passed in.
      </p>

      <DocPage.Section id="construction" title="Construction">
        <p>
          Drag the corner handles directly on the canvas, or scrub the values
          in the code panel. The centre point is always the average of the two
          corners.
        </p>
        <VectorDemoScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={420}
        />
      </DocPage.Section>

      <DocPage.Section id="containment" title="Point Containment">
        <p>
          <code>rect.contains(p)</code> returns <code>true</code> when the point
          lies within the rectangle (inclusive of the boundary). Drag the point
          on the canvas or scrub its coordinates to test boundary conditions.
        </p>
        <VectorDemoScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={420}
        />
      </DocPage.Section>

      <DocPage.Section id="quadrants" title="Quadrant Subdivision">
        <p>
          <code>rect.quadrant(n)</code> returns one of four equal sub-rectangles.
          Indices follow a counter-clockwise convention starting from bottom-left.
          Scrub the index from 0–3 to highlight each quadrant.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={420}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">

        <DocPage.Method
          signature={<>new <T symbol="Rect2D" variant="code" />(v1: <T symbol="V2" variant="code" />, v2: <T symbol="V2" variant="code" />)</>}
          description="Creates an axis-aligned rect. Corners are normalised so v1 is always bottom-left."
          params={[
            { name: 'v1', type: <T symbol="V2" />, description: 'One corner (normalised to bottom-left).' },
            { name: 'v2', type: <T symbol="V2" />, description: 'Opposite corner (normalised to top-right).' },
          ]}
          returns={{ type: <T symbol="Rect2D" /> }}
        />

        <DocPage.Method
          isStatic
          signature={<> <T symbol="Rect2D" variant="code" />.identity(): <T symbol="Rect2D" variant="code" /></>}
          description="Returns a unit rectangle from (0, 0) to (1, 1)."
          returns={{ type: <T symbol="Rect2D" /> }}
        />

        <DocPage.Method
          signature="get width: number"
          description="Horizontal extent: v2.x − v1.x."
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature="get height: number"
          description="Vertical extent: v2.y − v1.y."
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature={<>get center: <T symbol="V2" variant="code" /></>}
          description="Returns the midpoint (v1 + v2) / 2."
          returns={{ type: <T symbol="V2" /> }}
        />

        <DocPage.Method
          signature={<>get bottomLeft: <T symbol="V2" variant="code" /></>}
          description="Alias for v1 — the normalised bottom-left corner."
          returns={{ type: <T symbol="V2" /> }}
        />

        <DocPage.Method
          signature={<>get topRight: <T symbol="V2" variant="code" /></>}
          description="Alias for v2 — the normalised top-right corner."
          returns={{ type: <T symbol="V2" /> }}
        />

        <DocPage.Method
          signature={<>contains(v: <T symbol="V2" variant="code" />): boolean</>}
          description="Returns true when v lies within this rectangle (boundary-inclusive)."
          params={[{ name: 'v', type: <T symbol="V2" />, description: 'Point to test.' }]}
          returns={{ type: 'boolean' }}
        />

        <DocPage.Method
          signature={<>intersects(r: <T symbol="Rect2D" variant="code" />): boolean</>}
          description="Returns true when this rectangle and r overlap (boundary-exclusive)."
          params={[{ name: 'r', type: <T symbol="Rect2D" />, description: 'The other rectangle.' }]}
          returns={{ type: 'boolean' }}
        />

        <DocPage.Method
          signature={<>quadrant(n: number): <T symbol="Rect2D" variant="code" /></>}
          description="Returns one of the four equal sub-rectangles: 0 = bottom-left, 1 = bottom-right, 2 = top-right, 3 = top-left."
          params={[{ name: 'n', type: '0 | 1 | 2 | 3', description: 'Quadrant index.' }]}
          returns={{ type: <T symbol="Rect2D" />, description: 'Sub-rectangle.' }}
        />

        <DocPage.Method
          signature="printDebug(): string"
          description={<>Returns a string like <code>Rect2D(V2(0,0) V2(1,1))</code>.</>}
          returns={{ type: 'string' }}
        />

      </DocPage.Section>
    </DocPage>
  );
}
