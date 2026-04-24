import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { Handle, LTStyledElement } from '@lunaterra/core';
import type { CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';

export interface VectorArrowOptions {
  /** Starting position of the vector in world space. Defaults to origin. */
  origin?: V2 | { x: number; y: number };
  /** The vector tip direction/magnitude relative to origin. */
  vector: V2 | { x: number; y: number };
  /** Whether the user can drag the arrowhead tip. Default false. */
  draggable?: boolean;
  /** Draw dashed projection lines and axis-intercept labels. Default true. */
  showProjections?: boolean;
  /** Optional label shown near the arrowhead tip. */
  label?: string;
  /** Called on each drag frame with the updated world-space vector. */
  onChange?: (v: V2) => void;
}

/** Accent colours for projections (steel blue for X, amber for Y). */
const X_COLOR = 'rgba(70, 130, 220, 0.7)';
const Y_COLOR = 'rgba(220, 130, 40, 0.7)';
const ARROW_COLOR = 'rgba(28, 28, 32, 0.8)';

/**
 * Renders a 2-D vector as an arrow from `origin` to `origin + vector`.
 *
 * When `showProjections` is true (the default), dashed projection lines from
 * the tip to the X and Y axes are drawn, together with x/y value labels.
 *
 * When `draggable` is true the arrow tip becomes a draggable `Handle` and the
 * `onChange` callback is invoked on every drag frame so the host can sync
 * React display state — without triggering a full scene rebuild.
 */
export class VectorArrow extends LTStyledElement<VectorArrowOptions> {
  /** Mutable vector; updated in real-time during canvas drag. */
  public vec: V2;

  private _origin: V2;
  private _handle?: Handle;

  protected defaultOptions(): VectorArrowOptions {
    return { vector: new V2(0.3, 0.3), draggable: false, showProjections: true };
  }

  constructor(options: Partial<VectorArrowOptions> & Pick<VectorArrowOptions, 'vector'>) {
    super(options, { opacity: 1, color: null });
    const v = options.vector;
    this.vec = v instanceof V2 ? v.clone() : new V2(v.x, v.y);
    const o = options.origin;
    this._origin = o ? (o instanceof V2 ? o.clone() : new V2(o.x, o.y)) : new V2(0, 0);
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);

    if (this.options.draggable) {
      engine.activateInteraction();
      const handle = new Handle(this._origin.add(this.vec), {
        onDrag: (p: V2) => {
          this.vec = p.sub(this._origin);
          this.options.onChange?.(this.vec.clone());
          engine.requestUpdate();
        },
      });
      handle.styles.color = new Color(100, 160, 240);
      this._handle = handle;
      this.appendChild(handle);
      handle.setup(engine);
    }
  }

  override destroy(): void {
    this._handle?.destroy();
    super.destroy?.();
  }

  override render(renderer: CanvasRenderer): void {
    const { vec, _origin: origin } = this;
    const tip = origin.add(vec);
    const len = vec.length();

    const showProjections = this.options.showProjections !== false;
    const labelSize = 11;

    // ── Arrow body (dark, 0.8 opacity) ───────────────────────────────────────
    const ab = renderer.batch(ARROW_COLOR, 1.5);
    ab.line(origin, tip);
    ab.stroke();

    // ── Arrowhead chevron ────────────────────────────────────────────────────
    const arrowSize = renderer.measureScreenInWorld(9);
    if (len > arrowSize * 1.2) {
      const angle = vec.angle;
      const spread = 0.42;

      const a1 = new V2(
        tip.x - Math.cos(angle - spread) * arrowSize * 1.6,
        tip.y - Math.sin(angle - spread) * arrowSize * 1.6,
      );
      const a2 = new V2(
        tip.x - Math.cos(angle + spread) * arrowSize * 1.6,
        tip.y - Math.sin(angle + spread) * arrowSize * 1.6,
      );

      const ch1 = renderer.batch(ARROW_COLOR, 1.5);
      ch1.line(tip, a1);
      ch1.stroke();

      const ch2 = renderer.batch(ARROW_COLOR, 1.5);
      ch2.line(tip, a2);
      ch2.stroke();
    }

    // ── Optional label at tip ────────────────────────────────────────────────
    if (this.options.label) {
      const offset = renderer.measureScreenInWorld(14);
      renderer.batch(ARROW_COLOR, 1).renderText(
        this.options.label,
        new V2(tip.x + offset, tip.y + offset),
        labelSize,
      );
    }

    if (!showProjections) return;

    // ── Projection lines & labels ─────────────────────────────────────────────
    const tickOffset = renderer.measureScreenInWorld(16);
    const dotR = renderer.measureScreenInWorld(3.5);

    // X projection: vertical dashed line from (tip.x, origin.y) → tip
    if (Math.abs(vec.x) > 0.002) {
      const xAxisPt = new V2(tip.x, origin.y);

      const bx = renderer.batch(X_COLOR, 1);
      bx.renew(X_COLOR, 1, { dashPattern: [4, 3] });
      bx.line(xAxisPt, tip);
      bx.stroke();

      // dot on axis
      const dotBx = renderer.batch(X_COLOR, 1);
      dotBx.fillStyle = X_COLOR;
      dotBx.arc(xAxisPt, dotR);
      dotBx.fill();

      // x value label below axis intercept — and register for axis tick avoidance
      renderer.batch(X_COLOR, 1).renderText(
        vec.x.toFixed(2),
        new V2(tip.x, origin.y - tickOffset),
        labelSize,
      );
      renderer.labelRegistry.register(xAxisPt, 'axis-label-avoid');
    }

    // Y projection: horizontal dashed line from (origin.x, tip.y) → tip
    if (Math.abs(vec.y) > 0.002) {
      const yAxisPt = new V2(origin.x, tip.y);

      const by = renderer.batch(Y_COLOR, 1);
      by.renew(Y_COLOR, 1, { dashPattern: [4, 3] });
      by.line(yAxisPt, tip);
      by.stroke();

      // dot on axis
      const dotBy = renderer.batch(Y_COLOR, 1);
      dotBy.fillStyle = Y_COLOR;
      dotBy.arc(yAxisPt, dotR);
      dotBy.fill();

      // y value label left of axis intercept — and register for axis tick avoidance
      const labelW = renderer.measureScreenInWorld(30);
      renderer.batch(Y_COLOR, 1).renderText(
        vec.y.toFixed(2),
        new V2(origin.x - labelW, tip.y),
        labelSize,
      );
      renderer.labelRegistry.register(yAxisPt, 'axis-label-avoid');
    }
  }
}
