import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTStyledElement } from '../render/Elements/LTStyledElement';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import type { LunaTerraEngine } from '../engine/engine';
import type { Constraint } from '../constraints/Constraint';

export interface HandleOptions {
  onDrag?: (position: V2) => void;
  /** Optional list of constraints applied (in order) when the handle is dragged. */
  constraints?: Constraint[];
}

/**
 * A draggable point element with proximity-based opacity.
 *
 * Renders as a small dot that fades in as the mouse approaches
 * (linear decay: full opacity within `within` radius, fades to 0 at 5× radius).
 * When being dragged (active), opacity is forced to 1.
 *
 * Supports an optional `constraints` list. Each constraint:
 *  - snaps the drag position via `resolve(p)` (chained in order)
 *  - provides a visual helper element that fades in/out with the drag state
 */
export class Handle extends LTStyledElement<HandleOptions> {
  /** Opacity derived from mouse proximity (0–1). */
  public proximityOpacity = 0;

  /** Current animated opacity for constraint visuals (0–1). */
  private _constraintOpacity = 0;

  /** True while this handle is being dragged. */
  private _active = false;

  public get active(): boolean {
    return this._active;
  }

  public set active(value: boolean) {
    if (this._active === value) return;
    this._active = value;
    if (value) {
      for (const c of this._constraints()) c.onDragStart?.();
    } else {
      for (const c of this._constraints()) c.onDragEnd?.();
    }
  }

  protected defaultOptions(): HandleOptions {
    return {};
  }

  constructor(position: V2, options?: Partial<HandleOptions>) {
    super(options, { opacity: 1, color: null });
    this.position = position;
  }

  /** Convenience accessor for the constraints array. */
  private _constraints(): Constraint[] {
    return this.options.constraints ?? [];
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    engine.interactionManager?.registerHandle(this);

    // Constraint visuals must render at parent-local (world) coordinates, NOT
    // inside this Handle's local transform — otherwise the Handle's position
    // offset is applied twice. Append them to the Handle's parent so they
    // bypass the Handle's transform entirely.
    const parent = this._parent;
    for (const c of this._constraints()) {
      const visual = c.createVisual();
      if (parent) {
        parent.appendHelper(visual);
      } else {
        // No parent (Handle at engine root) — fall back to self helper.
        this.appendHelper(visual);
      }
      visual.setup(engine);
      // Initialise visual with the handle's current position so it renders
      // correctly before the first drag interaction.
      c.init?.(this.position);
    }
  }

  override destroy(): void {
    this.engine?.interactionManager?.unregisterHandle(this);
  }

  /**
   * Distance-based proximity test with linear decay.
   * Called by InteractionManager on every mouse move.
   *
   * Returns true when the point is within `within` world units.
   * Also sets `proximityOpacity` for the fade effect:
   *  – 1.0 when distance ≤ within
   *  – linear decay from 1→0 between within..5×within
   *  – 0 beyond 5×within
   */
  testHover = (p: V2, within: number): boolean => {
    const distance = this.position.distanceTo(p);
    const hovered = distance < within;
    this.proximityOpacity = linearDecay(distance, within, 1, 5);
    return hovered;
  };

  /**
   * Move this handle to a new position, applying all constraints in order.
   * Calls the `onDrag` callback and requests a redraw.
   */
  public dragTo(p: V2): void {
    let pos = p;
    for (const c of this._constraints()) {
      pos = c.resolve(pos);
    }
    this.position = pos;
    for (const c of this._constraints()) {
      c.onMove?.(pos);
    }
    this.options.onDrag?.(pos);
    this.engine?.requestUpdate();
  }

  override update(dt: number): void {
    // Target opacity: 1 when active, 0.5 when hovered, 0 when idle
    const target = this._active ? 1 : this.proximityOpacity > 0.01 ? 0.5 : 0;
    const prev = this._constraintOpacity;

    if (Math.abs(target - prev) > 0.001) {
      // Lerp at ~6 units/sec (fast enough to feel snappy, not instant)
      const speed = 6;
      this._constraintOpacity = prev + (target - prev) * Math.min(1, dt * speed);
      for (const c of this._constraints()) {
        c.setOpacity(this._constraintOpacity);
      }
      // Keep the loop running until fully settled
      this.engine?.requestUpdate();
    }
  }

  render(renderer: CanvasRenderer): void {
    const opacity = this.active ? 1 : this.proximityOpacity;
    if (opacity <= 0.001) return;

    const { color } = this.computedStyles;
    const hdpi = window.devicePixelRatio || 1;
    const haloRadius = renderer.measureScreenInWorld((this.active ? 10 : 7) * hdpi);
    const dotRadius = renderer.measureScreenInWorld(4 * hdpi);

    // Draw at local origin — localTransform already positions us in world space.
    const origin = new V2(0, 0);

    // Outer halo
    const batch = renderer.batch(color.opaque(opacity * 0.4), 1);
    batch.arc(origin, haloRadius);
    batch.fill();

    // Inner solid dot
    batch.renew(color.opaque(opacity));
    batch.arc(origin, dotRadius);
    batch.fill();
  }
}

/**
 * Linear decay function matching the legacy MpAttractor pattern.
 * Returns `peak` when x ≤ start, 0 when x ≥ start × endFactor,
 * and linearly interpolates between.
 */
function linearDecay(x: number, start: number, peak: number, endFactor: number): number {
  const end = start * endFactor;
  if (x <= start) return peak;
  if (x >= end) return 0;
  return peak * (1 - (x - start) / (end - start));
}
