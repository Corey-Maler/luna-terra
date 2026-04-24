import { Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { Handle, LunaTerraEngine, LTElement, LTStyledElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { Line, TextElement } from '@lunaterra/elements';
import { Axis } from '@lunaterra/charts';
import { DocPage } from '../../components/DocPage/DocPage';
import { VectorDemoScene } from '../../components/VectorDemoScene';
import { LiveCodeScene } from '../../components/LiveCodeScene';
import { VectorArrow } from '../../elements/VectorArrow';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Shared: Addition scene composite element ──────────────────────────────

interface AdditionCallbacks {
  onChangeA: (v: V2) => void;
  onChangeB: (v: V2) => void;
}

/**
 * Tip-to-tail addition diagram composed entirely from child Line + TextElement nodes.
 * Handles for A and B are draggable; children update their own options on each drag frame.
 */
class AdditionSceneElement extends LTElement<AdditionCallbacks> {
  public pointA: V2;
  public pointB: V2;
  private _handleA?: Handle;
  private _handleB?: Handle;
  private _lineA?: Line;
  private _lineBRef?: Line;
  private _lineBTip?: Line;
  private _lineParallel?: Line;
  private _lineSum?: Line;
  private _labelA?: TextElement;
  private _labelB?: TextElement;
  private _labelSum?: TextElement;

  protected defaultOptions(): AdditionCallbacks {
    return { onChangeA: () => {}, onChangeB: () => {} };
  }

  constructor(a: V2, b: V2, callbacks: AdditionCallbacks) {
    super(callbacks);
    this.pointA = a.clone();
    this.pointB = b.clone();
  }

  private _syncChildren(): void {
    const a = this.pointA;
    const b = this.pointB;
    const sum = a.add(b);
    const origin = new V2(0, 0);
    const OFF = 0.016;

    if (this._lineBRef)   this._lineBRef.options.points   = [origin, b];
    if (this._lineA)      this._lineA.options.points       = [origin, a];
    if (this._lineBTip)   this._lineBTip.options.points   = [a, sum];
    if (this._lineParallel) this._lineParallel.options.points = [b, sum];
    if (this._lineSum)    this._lineSum.options.points     = [origin, sum];

    if (this._labelA)   this._labelA.position   = new V2(a.x * 0.5 + OFF, a.y * 0.5 + OFF);
    if (this._labelB)   this._labelB.position   = new V2(a.x + b.x * 0.5 + OFF, a.y + b.y * 0.5 + OFF);
    if (this._labelSum) this._labelSum.position = new V2(sum.x * 0.5 - OFF * 4, sum.y * 0.5 + OFF * 3);
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    engine.activateInteraction();

    const a = this.pointA;
    const b = this.pointB;
    const sum = a.add(b);
    const origin = new V2(0, 0);
    const OFF = 0.016;
    const ARROW = { shape: 'arrow' as const, size: 0.018 };

    const addLine = (line: Line) => { this.appendChild(line); line.setup(engine); };
    const addText = (t: TextElement) => { this.appendChild(t); t.setup(engine); };

    // B from origin (faint dashed reference)
    this._lineBRef = new Line({ points: [origin, b], endMarker: ARROW });
    this._lineBRef.styles.color = new Color(220, 130, 40);
    this._lineBRef.styles.opacity = 0.25;
    addLine(this._lineBRef);

    // A arrow
    this._lineA = new Line({ points: [origin, a], endMarker: ARROW });
    this._lineA.styles.color = new Color(70, 130, 220);
    addLine(this._lineA);

    // B tip-to-tail (from A → sum)
    this._lineBTip = new Line({ points: [a, sum], endMarker: ARROW });
    this._lineBTip.styles.color = new Color(220, 130, 40);
    addLine(this._lineBTip);

    // Parallelogram closing line: B → sum (dashed)
    this._lineParallel = new Line({ points: [b, sum] });
    this._lineParallel.styles.color = new Color(220, 130, 40);
    this._lineParallel.styles.opacity = 0.45;
    this._lineParallel.styles.dashPattern = [4, 3];
    addLine(this._lineParallel);

    // Sum arrow (purple, thicker)
    this._lineSum = new Line({ points: [origin, sum], endMarker: ARROW });
    this._lineSum.styles.color = new Color(160, 80, 220);
    this._lineSum.styles.lineWidth = 2;
    addLine(this._lineSum);

    // Labels
    this._labelA = new TextElement({ text: 'a', fontSize: 12 });
    this._labelA.styles.color = new Color(70, 130, 220);
    this._labelA.position = new V2(a.x * 0.5 + OFF, a.y * 0.5 + OFF);
    addText(this._labelA);

    this._labelB = new TextElement({ text: 'b', fontSize: 12 });
    this._labelB.styles.color = new Color(220, 130, 40);
    this._labelB.position = new V2(a.x + b.x * 0.5 + OFF, a.y + b.y * 0.5 + OFF);
    addText(this._labelB);

    this._labelSum = new TextElement({ text: 'a+b', fontSize: 12 });
    this._labelSum.styles.color = new Color(160, 80, 220);
    this._labelSum.position = new V2(sum.x * 0.5 - OFF * 4, sum.y * 0.5 + OFF * 3);
    addText(this._labelSum);

    // Drag handles
    const hA = new Handle(a.clone(), {
      onDrag: (p) => { this.pointA = p; this._syncChildren(); this.options.onChangeA(p.clone()); },
    });
    hA.styles.color = new Color(70, 130, 220);
    this._handleA = hA;
    this.appendChild(hA); hA.setup(engine);

    const hB = new Handle(b.clone(), {
      onDrag: (p) => { this.pointB = p; this._syncChildren(); this.options.onChangeB(p.clone()); },
    });
    hB.styles.color = new Color(220, 130, 40);
    this._handleB = hB;
    this.appendChild(hB); hB.setup(engine);
  }

  override destroy(): void {
    this._handleA?.destroy();
    this._handleB?.destroy();
    super.destroy?.();
  }
}

// ── Scene 1: Single draggable vector ──────────────────────────────────────

type Scene1Config = { vx: number; vy: number };
const scene1Defaults: Scene1Config = { vx: 0.3, vy: 0.25 };
const DOMAIN = 0.45;

const SCENE1_CODE = `
const v = new V2(/*@live:vx:-0.4:0.4*/0.30, /*@live:vy:-0.4:0.4*/0.25);

const arrow = new VectorArrow({ vector: v, draggable: true });
`.trim();

function buildScene1(
  engine: LunaTerraEngine,
  config: Scene1Config,
  onCanvasDrag: (p: Partial<Scene1Config>) => void,
): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = new Color(130, 145, 165);
  root.appendChild(axis);

  const arrow = new VectorArrow({
    vector: new V2(config.vx, config.vy),
    draggable: true,
    showProjections: true,
    onChange: (v) => onCanvasDrag({ vx: parseFloat(v.x.toFixed(2)), vy: parseFloat(v.y.toFixed(2)) }),
  });
  root.appendChild(arrow);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Vector addition (tip-to-tail) ─────────────────────────────────

type Scene2Config = { ax: number; ay: number; bx: number; by: number };
const scene2Defaults: Scene2Config = { ax: 0.22, ay: 0.1, bx: 0.05, by: 0.28 };

const SCENE2_CODE = `
const a = new V2(/*@live:ax:-0.3:0.3*/0.22, /*@live:ay:-0.3:0.3*/0.10);
const b = new V2(/*@live:bx:-0.3:0.3*/0.05, /*@live:by:-0.3:0.3*/0.28);

// Component-wise sum — returns a new V2
const sum = a.add(b);    // V2(ax+bx, ay+by)
`.trim();

function buildScene2(
  engine: LunaTerraEngine,
  config: Scene2Config,
  onCanvasDrag: (patch: Partial<Scene2Config>) => void,
): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = new Color(130, 145, 165);
  root.appendChild(axis);

  const scene = new AdditionSceneElement(
    new V2(config.ax, config.ay),
    new V2(config.bx, config.by),
    {
      onChangeA: (v) => onCanvasDrag({ ax: parseFloat(v.x.toFixed(2)), ay: parseFloat(v.y.toFixed(2)) }),
      onChangeB: (v) => onCanvasDrag({ bx: parseFloat(v.x.toFixed(2)), by: parseFloat(v.y.toFixed(2)) }),
    },
  );
  root.appendChild(scene);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Normalize ────────────────────────────────────────────────────

type Scene3Config = { vx: number; vy: number };
const scene3Defaults: Scene3Config = { vx: 0.28, vy: 0.15 };

const SCENE3_CODE = `
const v = new V2(/*@live:vx:-0.4:0.4*/0.28, /*@live:vy:-0.4:0.4*/0.15);

// Returns a unit vector (length = 1) in the same direction.
const n = v.normalize();
console.log(n.length()); // → 1
`.trim();

class UnitCircle extends LTStyledElement<{}> {
  protected defaultOptions() { return {}; }
  override render(renderer: CanvasRenderer) {
    const steps = 64;
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return new V2(Math.cos(a) * 0.2, Math.sin(a) * 0.2);
    });
    const b = renderer.batch('rgba(130,145,165,0.35)', 1);
    b.renew('rgba(130,145,165,0.35)', 1, { dashPattern: [4, 3] });
    b.path(pts);
    b.stroke();
  }
}

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = new Color(130, 145, 165);
  root.appendChild(axis);

  root.appendChild(new UnitCircle({}));

  const v = new V2(config.vx, config.vy);
  const n = v.normalize().scale(0.2);

  const ARROW = { shape: 'arrow' as const, size: 0.016 };

  const arrowV = new Line({ points: [new V2(0, 0), v], endMarker: ARROW });
  arrowV.styles.color = new Color(130, 145, 165);
  arrowV.styles.opacity = 0.5;
  root.appendChild(arrowV);

  const arrowN = new Line({ points: [new V2(0, 0), n], endMarker: ARROW });
  arrowN.styles.color = new Color(80, 180, 120);
  root.appendChild(arrowN);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 4: Dot product ──────────────────────────────────────────────────

type Scene4Config = { angle: number };
const scene4Defaults: Scene4Config = { angle: 55 };

const SCENE4_CODE = `
const angle = /*@live:angle:0:180*/55; // degrees
const a = new V2(Math.cos(0), Math.sin(0)).scale(0.3);
const b = new V2(Math.cos(radians(angle)), Math.sin(radians(angle))).scale(0.3);

// Equals |a|·|b|·cos(θ) — positive when parallel, 0 when perpendicular.
const dot = a.dot(b);
`.trim();

class AngleArc extends LTStyledElement<{ angleDeg: number }> {
  protected defaultOptions() { return { angleDeg: 55 }; }
  override render(renderer: CanvasRenderer) {
    const { angleDeg } = this.options;
    const angleRad = angleDeg * (Math.PI / 180);
    const steps = Math.max(4, Math.floor(angleDeg));
    const arcR = renderer.measureScreenInWorld(24);
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const t = (i / steps) * angleRad;
      return new V2(Math.cos(t) * arcR, Math.sin(t) * arcR);
    });
    if (pts.length >= 2) {
      const b = renderer.batch('rgba(200,200,80,0.5)', 1);
      b.path(pts);
      b.stroke();
      const mid = pts[Math.floor(pts.length / 2)];
      renderer.batch('rgba(200,200,80,0.8)', 1).renderText(`${angleDeg}°`, new V2(mid.x + renderer.measureScreenInWorld(8), mid.y), 10);
    }
  }
}

function buildScene4(engine: LunaTerraEngine, config: Scene4Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -DOMAIN, xMax: DOMAIN, yMin: -DOMAIN, yMax: DOMAIN, tickCount: 5 });
  axis.styles.color = new Color(130, 145, 165);
  root.appendChild(axis);

  const len = 0.3;
  const angleRad = config.angle * (Math.PI / 180);
  const a = new V2(len, 0);
  const b = new V2(Math.cos(angleRad) * len, Math.sin(angleRad) * len);
  const dot = a.dot(b);

  root.appendChild(new AngleArc({ angleDeg: config.angle }));

  const ARROW = { shape: 'arrow' as const, size: 0.016 };

  const arrowA = new Line({ points: [new V2(0, 0), a], endMarker: ARROW });
  arrowA.styles.color = new Color(70, 130, 220);
  root.appendChild(arrowA);

  const arrowB = new Line({ points: [new V2(0, 0), b], endMarker: ARROW });
  arrowB.styles.color = new Color(220, 130, 40);
  root.appendChild(arrowB);

  const dotLabel = new TextElement({ text: `dot = ${dot.toFixed(3)}`, fontSize: 11 });
  dotLabel.styles.color = new Color(28, 28, 32);
  dotLabel.styles.opacity = 0.8;
  dotLabel.position = new V2(-DOMAIN + 0.02, DOMAIN - 0.035);
  root.appendChild(dotLabel);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-DOMAIN, -DOMAIN), new V2(DOMAIN, DOMAIN)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function V2Page() {
  return (
    <DocPage title="V2" section="@lunaterra/math">
      <p>
        <code>V2</code> is an immutable-style 2-D vector. Every operation returns a
        new <code>V2</code> — the original is never modified. World space in
        Luna-Terra uses a Y-up convention so positive Y points upward on-screen.
      </p>

      <DocPage.Section id="basics" title="Basics">
        <p>
          Construct a vector with <code>new V2(x, y)</code>. Drag the arrowhead directly
          on the canvas, or scrub the values in the code panel — both stay in sync.
          The dashed lines show the <strong style={{ color: 'rgba(70,130,220,0.9)' }}>X</strong> and{' '}
          <strong style={{ color: 'rgba(220,130,40,0.9)' }}>Y</strong> projections onto the axes,
          with their values labelled at the intercepts.
        </p>
        <VectorDemoScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={420}
        />
      </DocPage.Section>

      <DocPage.Section id="addition" title="Addition">
        <p>
          <code>a.add(b)</code> sums two vectors component-wise. The{' '}
          <strong>tip-to-tail</strong> construction places <em>b</em> at the tip
          of <em>a</em>. The dashed line closes the <strong>parallelogram</strong> —
          drag either arrowhead on the canvas or scrub the values in the code panel.
        </p>
        <VectorDemoScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={420}
        />
      </DocPage.Section>

      <DocPage.Section id="normalize" title="Normalize">
        <p>
          <code>v.normalize()</code> returns a unit vector (length&nbsp;=&nbsp;1) pointing
          in the same direction. The dashed circle has radius&nbsp;0.2 — the green arrow
          tip always lands on it regardless of the original vector's magnitude.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={400}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="dot-product" title="Dot Product">
        <p>
          <code>a.dot(b)</code> returns the scalar dot product{' '}
          <em>x₁·x₂ + y₁·y₂</em> — equivalently <em>|a|·|b|·cos(θ)</em>. It is
          positive when the vectors point the same way, zero when perpendicular,
          and negative when opposing. Scrub the angle to verify.
        </p>
        <LiveCodeScene
          buildScene={buildScene4}
          defaultConfig={scene4Defaults}
          source={SCENE4_CODE}
          canvasHeight={400}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">

        <DocPage.Method
          signature="new V2(x: number, y: number)"
          description="Creates a new 2-D vector with the given components."
          params={[
            { name: 'x', type: 'number', description: 'Horizontal component.' },
            { name: 'y', type: 'number', description: 'Vertical component (positive = up in world space).' },
          ]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="add(v: V2): V2"
          description="Returns a new vector equal to this + v (component-wise sum)."
          params={[{ name: 'v', type: 'V2', description: 'The vector to add.' }]}
          returns={{ type: 'V2', description: 'New vector (x₁+x₂, y₁+y₂).' }}
        />

        <DocPage.Method
          signature="sub(v: V2): V2"
          description="Returns a new vector equal to this − v."
          params={[{ name: 'v', type: 'V2', description: 'The vector to subtract.' }]}
          returns={{ type: 'V2', description: 'New vector (x₁−x₂, y₁−y₂).' }}
        />

        <DocPage.Method
          signature="scale(s: number): V2"
          description="Multiplies both components by scalar s. Prefer over the deprecated mul()."
          params={[{ name: 's', type: 'number', description: 'Scalar multiplier.' }]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="dot(v: V2): number"
          description="Computes x₁·x₂ + y₁·y₂. Equals |this|·|v|·cos(θ) where θ is the angle between the vectors."
          params={[{ name: 'v', type: 'V2', description: 'The other vector.' }]}
          returns={{ type: 'number', description: 'Scalar dot product.' }}
        />

        <DocPage.Method
          signature="length(): number"
          description="Returns the Euclidean magnitude √(x² + y²)."
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature="normalize(): V2"
          description="Returns a unit vector (length = 1) in the same direction. Returns V2(0, 0) for a zero vector."
          returns={{ type: 'V2', description: 'Unit vector.' }}
        />

        <DocPage.Method
          signature="distanceTo(v: V2): number"
          description="Returns the Euclidean distance between this point and v."
          params={[{ name: 'v', type: 'V2', description: 'The other point.' }]}
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature="withinDistance(v: V2, distance: number): boolean"
          description="Returns true when distanceTo(v) ≤ distance."
          params={[
            { name: 'v', type: 'V2', description: 'The point to test.' },
            { name: 'distance', type: 'number', description: 'Threshold.' },
          ]}
          returns={{ type: 'boolean' }}
        />

        <DocPage.Method
          signature="get angle: number"
          description="Angle of the vector in radians from the positive X axis (counter-clockwise), via Math.atan2(y, x)."
          returns={{ type: 'number', description: 'Range (−π, π].' }}
        />

        <DocPage.Method
          signature="angleTo(to: V2): number"
          description="Angle of the displacement from this to to — equivalent to to.sub(this).angle."
          params={[{ name: 'to', type: 'V2', description: 'Target point.' }]}
          returns={{ type: 'number', description: 'Angle in radians.' }}
        />

        <DocPage.Method
          signature="setAngle(angle: number): V2"
          description="Returns a new vector with the same length but pointing at the given angle."
          params={[{ name: 'angle', type: 'number', description: 'Target angle in radians.' }]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="setLenght(length: number): V2"
          description="Returns a new vector pointing in the same direction with the specified length. (Historical typo in method name — one 'g'.)"
          params={[{ name: 'length', type: 'number', description: 'Desired magnitude.' }]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="shortenBy(amount: number): V2"
          description="Returns a vector shortened by amount, preserving direction. Equivalent to setLenght(length() − amount)."
          params={[{ name: 'amount', type: 'number', description: 'Amount to remove.' }]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="get half: V2"
          description="Both components halved — equivalent to scale(0.5)."
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="byElementDiv(v: V2): V2"
          description="Component-wise division: V2(x / v.x, y / v.y)."
          params={[{ name: 'v', type: 'V2', description: 'Divisor vector.' }]}
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="floor(): V2"
          description="Returns a new V2 with both components floored."
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="clone(): V2"
          description="Returns a deep copy."
          returns={{ type: 'V2' }}
        />

        <DocPage.Method
          signature="equals(v: V2): boolean"
          description="Strict component equality (===). Use closeEnough() for floating-point comparisons."
          params={[{ name: 'v', type: 'V2', description: 'Vector to compare.' }]}
          returns={{ type: 'boolean' }}
        />

        <DocPage.Method
          signature="closeEnough(v: V2, epsilon?: number): boolean"
          description="Returns true when both components differ by less than epsilon."
          params={[
            { name: 'v', type: 'V2', description: 'Vector to compare.' },
            { name: 'epsilon', type: 'number', optional: true, default: '1e-20', description: 'Per-component tolerance.' },
          ]}
          returns={{ type: 'boolean' }}
        />

        <DocPage.Method
          signature="printDebug(): string"
          description={<>Returns <code>"V2(x, y)"</code> — handy for console logging.</>}
          returns={{ type: 'string' }}
        />

        <DocPage.Method
          isStatic
          signature="V2.average(v1: V2, v2: V2): V2"
          description="Returns the midpoint between v1 and v2."
          params={[
            { name: 'v1', type: 'V2', description: 'First point.' },
            { name: 'v2', type: 'V2', description: 'Second point.' },
          ]}
          returns={{ type: 'V2', description: 'Midpoint.' }}
        />

        <DocPage.Method
          isStatic
          signature="V2.closestToLine(p: V2, a: V2, b: V2): V2"
          description="Returns the point on segment a→b that is closest to p, clamped to the endpoints."
          params={[
            { name: 'p', type: 'V2', description: 'Query point.' },
            { name: 'a', type: 'V2', description: 'Segment start.' },
            { name: 'b', type: 'V2', description: 'Segment end.' },
          ]}
          returns={{ type: 'V2', description: 'Closest point on the segment.' }}
        />

        <DocPage.Method
          isStatic
          signature="V2.angleBetweenPoints(a: V2, b: V2, c: V2): number"
          description="Returns the angle at vertex b formed by rays b→a and b→c."
          params={[
            { name: 'a', type: 'V2', description: 'First outer point.' },
            { name: 'b', type: 'V2', description: 'Vertex.' },
            { name: 'c', type: 'V2', description: 'Second outer point.' },
          ]}
          returns={{ type: 'number', description: 'Angle at b in radians.' }}
        />

      </DocPage.Section>
    </DocPage>
  );
}
