import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTElement } from '../render/Elements/LTElement';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { Constraint, resolveV2, type V2Source } from './Constraint';

// ─── Visual element ────────────────────────────────────────────────────────

/**
 * Internal visual element rendered as a child of the owning Handle.
 *
 * Draws a dashed line through `start`→`end`, extending beyond both endpoints.
 * Opacity of each dash segment decays with distance from `handlePos`, so the
 * line only "materialises" near where the user is dragging.
 */
class LinearConstraintVisual extends LTElement<{}> {
  public constraintOpacity = 0;
  public handlePos: V2 = new V2(0, 0);

  constructor(
    public readonly getStart: () => V2,
    public readonly getEnd: () => V2,
    public readonly clamp: boolean,
    public readonly color: Color,
  ) {
    super();
  }

  protected override defaultOptions() {
    return {};
  }

  override render(renderer: CanvasRenderer): void {
    const op = this.constraintOpacity;
    if (op <= 0.001) return;

    const start = this.getStart();
    const end = this.getEnd();
    const dir = end.sub(start);
    const len = dir.length();
    if (len < 1e-9) return;

    const unit = dir.normalize();

    // How far to extend beyond the endpoints (screen-proportional)
    const extend = renderer.measureScreenInWorld(120 * (window.devicePixelRatio || 1));

    const lineStart = this.clamp ? start : start.sub(unit.scale(extend));
    const lineEnd = this.clamp ? end : end.add(unit.scale(extend));

    // Proximity fade: compute fade multiplier per segment
    // We draw the line as a series of dash segments; each segment fades based
    // on its distance from the current handle position.
    const DASH_LEN = renderer.measureScreenInWorld(10 * (window.devicePixelRatio || 1));
    const FADE_RADIUS = renderer.measureScreenInWorld(80 * (window.devicePixelRatio || 1));

    const totalLen = lineEnd.sub(lineStart).length();
    const steps = Math.max(2, Math.ceil(totalLen / DASH_LEN));

    for (let i = 0; i < steps; i += 2) {
      const t0 = i / steps;
      const t1 = Math.min((i + 1) / steps, 1);
      const p0 = lineStart.add(lineEnd.sub(lineStart).scale(t0));
      const p1 = lineStart.add(lineEnd.sub(lineStart).scale(t1));
      const mid = V2.average(p0, p1);

      const dist = mid.distanceTo(this.handlePos);
      const fade = proximityFade(dist, FADE_RADIUS);
      if (fade < 0.01) continue;

      const segColor = this.color.opaque(op * fade * 0.8);
      const batch = renderer.batch(segColor, 1.5);
      batch.line(p0, p1);
      batch.stroke();
    }

    // Draw endpoint markers (small squares / ticks) when clamped
    if (this.clamp) {
      const tickSize = renderer.measureScreenInWorld(5 * (window.devicePixelRatio || 1));
      const perp = new V2(-unit.y, unit.x).scale(tickSize);

      const endpointColor = this.color.opaque(op * 0.6);
      const b = renderer.batch(endpointColor, 1.5);
      b.line(start.sub(perp), start.add(perp));
      b.stroke();
      b.renew(endpointColor, 1.5);
      b.line(end.sub(perp), end.add(perp));
      b.stroke();
    }
  }
}

// ─── LinearConstraint ─────────────────────────────────────────────────────

export interface LinearConstraintOptions {
  /**
   * When `true`, the snap is clamped to the segment between `start` and `end`
   * (useful for range sliders, e.g. 0–15).
   * When `false` (default), the projection extends to the infinite line through
   * `start`→`end` (useful for axis-aligned or technical snapping).
   */
  clamp?: boolean;
}

/**
 * Constrains a Handle to move along the line through `start`→`end`.
 *
 * Both endpoints can be dynamic: pass `() => V2` to track another element live.
 *
 * Visual: a dashed guide line that fades in near the drag point, with tick marks
 * at the endpoints when `clamp: true`.
 */
export class LinearConstraint extends Constraint {
  private _visual: LinearConstraintVisual;
  private readonly _getStart: () => V2;
  private readonly _getEnd: () => V2;
  private readonly _clamp: boolean;

  constructor(
    start: V2Source,
    end: V2Source,
    options: LinearConstraintOptions = {},
  ) {
    super();
    this._getStart = typeof start === 'function' ? start : () => start;
    this._getEnd = typeof end === 'function' ? end : () => end;
    this._clamp = options.clamp ?? false;
    this._visual = new LinearConstraintVisual(
      this._getStart,
      this._getEnd,
      this._clamp,
      new Color(0.3, 0.8, 0.5),
    );
  }

  override resolve(p: V2): V2 {
    const start = this._getStart();
    const end = this._getEnd();

    const ap = p.sub(start);
    const ab = end.sub(start);
    const abLen2 = ab.dot(ab);
    if (abLen2 < 1e-12) return start;

    const t = ap.dot(ab) / abLen2;

    if (this._clamp) {
      // Clamp to [0, 1] — i.e. the segment
      return start.add(ab.scale(Math.max(0, Math.min(1, t))));
    } else {
      // Infinite line — no clamping
      return start.add(ab.scale(t));
    }
  }

  override createVisual(): LTElement {
    return this._visual;
  }

  override setOpacity(opacity: number): void {
    this._visual.constraintOpacity = opacity;
  }

  override onMove(pos: V2): void {
    this._visual.handlePos = pos;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Proximity-based fade: returns 1 within `fadeRadius/4`, falls off linearly
 * to 0 at `fadeRadius`.
 */
function proximityFade(dist: number, fadeRadius: number): number {
  const innerRadius = fadeRadius * 0.25;
  if (dist <= innerRadius) return 1;
  if (dist >= fadeRadius) return 0;
  return 1 - (dist - innerRadius) / (fadeRadius - innerRadius);
}
