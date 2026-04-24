import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTElement } from '../render/Elements/LTElement';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { Constraint, resolveV2, type V2Source } from './Constraint';

// ─── Shared helpers ───────────────────────────────────────────────────────

/** Smooth fade: 1 at dist=0, 0 at dist≥radius, cosine interpolated. */
function proximityFade(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  const t = dist / radius;
  return 0.5 + 0.5 * Math.cos(t * Math.PI);
}

// ─── Visual element ────────────────────────────────────────────────────────

/**
 * Internal visual element rendered as a sibling of the owning Handle.
 *
 * Normal angles (≥ SMALL_ANGLE_THRESHOLD):
 *   - Dashed complement arc (unswept portion, fades in proportionally)
 *   - Solid thick main arc
 *   - Tangential arrowheads at both arc endpoints, pointing in sweep direction
 *   - Degree label at arc midpoint
 *
 * Small angles (< SMALL_ANGLE_THRESHOLD ≈ 22°):
 *   - Solid thick main arc (short)
 *   - Extended radial arms at both endpoints (inside→outside the arc)
 *   - Inward arrowheads at arc boundary (tip on arc, pointing toward center)
 *   - Degree label outside the arc, along bisector
 */
class RadiusArcVisual extends LTElement<{}> {
  public constraintOpacity = 0;
  public handlePos: V2 = new V2(0, 0);
  public referencePos: V2 = new V2(0, 0);
  /** When set, label shows "Xdeg (+Ydeg)" where Y = current − base. */
  public baseAngleDeg: number | null = null;

  private static readonly SMALL_ANGLE = 22 * (Math.PI / 180);

  constructor(
    public readonly getCenter: () => V2,
    public readonly radius: number,
    public readonly color: Color,
  ) {
    super();
  }

  protected override defaultOptions() { return {}; }

  override render(renderer: CanvasRenderer): void {
    const op = this.constraintOpacity;
    if (op <= 0.001) return;

    const center = this.getCenter();
    const refAngle    = this.referencePos.sub(center).angle;
    const handleAngle = this.handlePos.sub(center).angle;

    // Signed delta normalised to (-π, π]: positive = CCW, negative = CW
    let delta = handleAngle - refAngle;
    while (delta >  Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;

    const sweepDir = delta >= 0 ? 1 : -1;
    const absDelta  = Math.abs(delta);
    const midAngle  = refAngle + delta / 2;
    const hdpi      = window.devicePixelRatio || 1;
    const arrowSize = renderer.measureScreenInWorld(7 * hdpi);
    const arcColor  = this.color.opaque(op * 0.85);
    const isSmall   = absDelta < RadiusArcVisual.SMALL_ANGLE;

    // ── Dashed complement arc ─────────────────────────────────────────────
    // Only in normal mode. Drawn segment-by-segment so each dash fades with
    // proximity to the handle (same technique as LinearConstraint). Also fades
    // in proportionally to how much you have rotated (0 → 30° ramp).
    if (!isSmall && absDelta > 0.01) {
      const globalFade  = Math.min(1, absDelta / (Math.PI / 6)); // ramp over first 30°
      const compSweep   = 2 * Math.PI - absDelta;                // angle span of complement
      const DASH_ANGLE  = renderer.measureScreenInWorld(10 * hdpi) / this.radius; // dash in radians
      const FADE_RADIUS = renderer.measureScreenInWorld(80 * hdpi);
      // Start of complement is at handleAngle, going in the *opposite* sweep direction
      const compStartAngle = handleAngle;
      const compDir        = -sweepDir; // opposite to the main arc
      const steps = Math.max(2, Math.ceil(compSweep / DASH_ANGLE));
      for (let i = 0; i < steps; i += 2) {
        const t0 = i / steps;
        const t1 = Math.min((i + 1) / steps, 1);
        const a0 = compStartAngle + compDir * compSweep * t0;
        const a1 = compStartAngle + compDir * compSweep * t1;
        const mid = new V2(center.x + Math.cos(a0 + (a1 - a0) * 0.5) * this.radius,
                           center.y + Math.sin(a0 + (a1 - a0) * 0.5) * this.radius);
        const dist = mid.distanceTo(this.handlePos);
        const prox = proximityFade(dist, FADE_RADIUS);
        if (prox < 0.01) continue;
        const segColor = this.color.opaque(op * prox * 0.22 * globalFade);
        // Negate angles for ctx.arc Y-flip convention
        const sb = renderer.batch(segColor, 1);
        sb.arc(center, this.radius, -a0, -a1, compDir > 0);
        sb.stroke();
      }
    }

    // ── Main arc ──────────────────────────────────────────────────────────
    // For small angles the arc is extended 30° past both endpoints so there's
    // room for the label and arrows to sit along the prolonged arc.
    {
      const ARC_EXT = isSmall ? Math.PI / 6 : 0; // 30° extension each side
      const arcStart = refAngle    - sweepDir * ARC_EXT;
      const arcEnd   = handleAngle + sweepDir * ARC_EXT;
      const ab = renderer.batch(arcColor, 3);
      ab.arc(center, this.radius, -arcStart, -arcEnd, delta >= 0);
      ab.stroke();
    }

    // ── Arrowheads + label ────────────────────────────────────────────────
    if (isSmall) {
      this._renderSmallAngle(renderer, center, refAngle, handleAngle, delta, sweepDir, midAngle, arrowSize, arcColor, op);
    } else {
      this._renderNormalAngle(renderer, center, refAngle, handleAngle, sweepDir, midAngle, arrowSize, arcColor, op, delta);
    }

    // ── Reference tick ────────────────────────────────────────────────────
    {
      const tLen  = renderer.measureScreenInWorld(5 * hdpi);
      const cos   = Math.cos(refAngle);
      const sin   = Math.sin(refAngle);
      const outer = new V2(center.x + cos * (this.radius + tLen), center.y + sin * (this.radius + tLen));
      const inner = new V2(center.x + cos * (this.radius - tLen), center.y + sin * (this.radius - tLen));
      const tb = renderer.batch(this.color.opaque(op * 0.5), 1);
      tb.line(inner, outer);
      tb.stroke();
    }
  }

  // ── Normal angle (>= 22°) ────────────────────────────────────────────────

  private _renderNormalAngle(
    renderer: CanvasRenderer,
    center: V2,
    refAngle: number,
    handleAngle: number,
    sweepDir: number,
    midAngle: number,
    arrowSize: number,
    arcColor: Color,
    op: number,
    delta: number,
  ): void {
    // Arrows face each other inward (>--<): ref arrow points in sweep
    // direction, handle arrow points against it.
    this._drawTangentialArrow(renderer, center, refAngle,     sweepDir, arrowSize, arcColor);
    this._drawTangentialArrow(renderer, center, handleAngle, -sweepDir, arrowSize, arcColor);

    if (op > 0.3) {
      const labelAlpha = Math.max(0, (op - 0.3) / 0.7);
      const labelR     = this.radius * 1.15;
      const labelPos   = new V2(
        center.x + Math.cos(midAngle) * labelR,
        center.y + Math.sin(midAngle) * labelR,
      );
      const currentDeg = delta * (180 / Math.PI);
      const base = this.baseAngleDeg;
      const label = base != null
        ? `${currentDeg.toFixed(1)}° (+${(currentDeg - base).toFixed(1)}°)`
        : `${currentDeg.toFixed(1)}°`;
      const lb = renderer.batch(this.color.opaque(labelAlpha * op), 1);
      lb.renderText(label, labelPos, 11, 'center', 'middle');
    }
  }

  // ── Small angle (< 22°) — prolonged arc with offset label ──────────────
  // Same visual language as normal mode, just shifted: the thick arc is already
  // extended 30° past both endpoints (in render()), tangential arrows sit at
  // the real arc endpoints pointing *outward* (reversed sweep), and the label
  // is at radius×1.15 along the offset midAngle.
  // Extension lines prolong the radial arms so the angle stays readable.

  private _renderSmallAngle(
    renderer: CanvasRenderer,
    center: V2,
    refAngle: number,
    handleAngle: number,
    delta: number,
    sweepDir: number,
    midAngle: number,
    arrowSize: number,
    arcColor: Color,
    op: number,
  ): void {
    const hdpi   = window.devicePixelRatio || 1;
    const extLen = renderer.measureScreenInWorld(28 * hdpi);
    const innerR = this.radius * 0.82;
    const outerR = this.radius + extLen;

    // Extension lines along both radii (through and past the arc)
    for (const angle of [refAngle, handleAngle]) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const pInner = new V2(center.x + cos * innerR, center.y + sin * innerR);
      const pOuter = new V2(center.x + cos * outerR, center.y + sin * outerR);
      const ab = renderer.batch(arcColor, 1);
      ab.line(pInner, pOuter);
      ab.stroke();
    }

    // Arrows face away from each other (<-->): ref arrow points against
    // sweep, handle arrow points with sweep.
    this._drawTangentialArrow(renderer, center, refAngle,    -sweepDir, arrowSize, arcColor);
    this._drawTangentialArrow(renderer, center, handleAngle,  sweepDir, arrowSize, arcColor);

    if (op > 0.3) {
      const labelAlpha = Math.max(0, (op - 0.3) / 0.7);
      // Label jumps to a fixed 10° outside the refAngle endpoint and stays
      // there until the angle grows large enough to fit inside naturally.
      const LABEL_JUMP = 10 * (Math.PI / 180); // 10°
      const labelAngle = refAngle - sweepDir * LABEL_JUMP;
      const labelR     = this.radius * 1.15;
      const labelPos   = new V2(
        center.x + Math.cos(labelAngle) * labelR,
        center.y + Math.sin(labelAngle) * labelR,
      );
      const currentDeg = delta * (180 / Math.PI);
      const base = this.baseAngleDeg;
      const label = base != null
        ? `${currentDeg.toFixed(1)}° (+${(currentDeg - base).toFixed(1)}°)`
        : `${currentDeg.toFixed(1)}°`;
      const lb = renderer.batch(this.color.opaque(labelAlpha * op), 1);
      lb.renderText(label, labelPos, 11, 'center', 'middle');
    }
  }

  // ── Arrowhead helpers ────────────────────────────────────────────────────

  /**
   * Tangential arrowhead: tip on the arc at `arcAngle`, pointing in the
   * sweep direction. Used in normal-angle mode.
   */
  private _drawTangentialArrow(
    renderer: CanvasRenderer,
    center: V2,
    arcAngle: number,
    sweepDir: number,
    size: number,
    color: Color,
  ): void {
    const tip = new V2(
      center.x + Math.cos(arcAngle) * this.radius,
      center.y + Math.sin(arcAngle) * this.radius,
    );
    // CCW tangent: (-sin, cos). Multiply by sweepDir for CW.
    const tx = -Math.sin(arcAngle) * sweepDir;
    const ty =  Math.cos(arcAngle) * sweepDir;
    const px = -ty;
    const py =  tx;

    const base1 = new V2(tip.x - tx * size + px * size * 0.5, tip.y - ty * size + py * size * 0.5);
    const base2 = new V2(tip.x - tx * size - px * size * 0.5, tip.y - ty * size - py * size * 0.5);

    const b = renderer.batch(color, 1);
    b.moveTo(tip);
    b.lineTo(base1);
    b.lineTo(base2);
    b.lineTo(tip);
    b.fill(color);
  }
}

// ─── RadiusConstraint ─────────────────────────────────────────────────────

export type AngleReference =
  | 'same-point'   // reference = current handle position (shows swept angle)
  | 'horizontal'   // reference = point directly right of center
  | 'vertical'     // reference = point directly below center
  | V2Source;      // explicit fixed or dynamic reference point

export interface RadiusConstraintOptions {
  /**
   * The reference point used to compute the displayed arc angle.
   * Defaults to `'horizontal'` (a stable reference that always shows absolute angle).
   */
  angleTowards?: AngleReference;
  /**
   * When set, the degree label also shows the delta from this baseline in
   * parentheses, e.g. `"30.0° (+10.0°)"` when `baseAngle` is 20 and current is 30.
   * Value is in degrees.
   */
  baseAngle?: number;
}

/**
 * Constrains a Handle to move on a circle of fixed `radius` around `center`.
 *
 * `center` and `radius` can be dynamic: pass `() => V2` or `() => number`
 * for live values that track another element.
 *
 * Visual: a dashed complement arc + thick main arc showing the swept angle,
 * with arrowheads and a signed degree label.
 */
export class RadiusConstraint extends Constraint {
  private _visual: RadiusArcVisual;
  private readonly _getCenter: () => V2;
  private readonly _getRadius: () => number;
  private readonly _angleTowards: AngleReference;

  constructor(
    center: V2Source,
    radius: number | (() => number),
    options: RadiusConstraintOptions = {},
  ) {
    super();
    this._getCenter = typeof center === 'function' ? center : () => center;
    this._getRadius = typeof radius === 'function' ? radius : () => radius;
    this._angleTowards = options.angleTowards ?? 'horizontal';
    this._visual = new RadiusArcVisual(
      this._getCenter,
      this._getRadius(),
      new Color(0.3, 0.7, 1.0),
    );
    if (options.baseAngle != null) {
      this._visual.baseAngleDeg = options.baseAngle;
    }
  }

  override resolve(p: V2): V2 {
    const center = this._getCenter();
    const radius = this._getRadius();
    const delta  = p.sub(center);
    if (delta.length() < 1e-9) {
      return new V2(center.x + radius, center.y);
    }
    return center.add(delta.setLenght(radius));
  }

  override createVisual(): LTElement {
    return this._visual;
  }

  override setOpacity(opacity: number): void {
    this._visual.constraintOpacity = opacity;
  }

  override init(pos: V2): void {
    this._visual.handlePos = pos;
    this._updateReference();
  }

  override onDragStart(): void {
    this._updateReference();
  }

  override onMove(pos: V2): void {
    this._visual.handlePos = pos;
    this._updateReference();
  }

  private _updateReference(): void {
    const center = this._getCenter();
    const radius = this._getRadius();
    const ref    = this._angleTowards;

    if (ref === 'same-point') {
      this._visual.referencePos = this._visual.handlePos;
    } else if (ref === 'horizontal') {
      this._visual.referencePos = new V2(center.x + radius, center.y);
    } else if (ref === 'vertical') {
      this._visual.referencePos = new V2(center.x, center.y + radius);
    } else {
      this._visual.referencePos = resolveV2(ref);
    }
  }
}
