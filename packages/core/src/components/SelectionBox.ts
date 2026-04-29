import { V2, Rect2D } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTElement } from '../render/Elements/LTElement';
import type { CanvasRenderer } from '../render/CanvasRenderer';

export type SelectionHitZone =
  | 'body'
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  | 'rotate'
  | null;

const SELECTION_COLOR = new Color(56, 130, 240);
const HANDLE_HALF = 4;    // CSS-px half-size of resize squares
const ROTATE_OFFSET = 20; // CSS-px above top-center for rotation handle
const HIT_RADIUS = 8;     // CSS-px hit radius for handles

/**
 * Rendered when an element is selected.
 * Shows a dashed bounding rectangle, 8 resize handle squares,
 * and a rotation handle circle above top-center.
 */
export class SelectionBox extends LTElement<{}> {
  public target: LTElement | null = null;

  /** Cached world-space corners (bottom-left CW). */
  private _corners: V2[] = [];
  /** World-space resize handle positions: nw, n, ne, e, se, s, sw, w. */
  private _resizePositions: V2[] = [];
  /** World-space rotation handle position. */
  private _rotatePosition: V2 = new V2(0, 0);
  /** World-space center of the bounding box. */
  private _center: V2 = new V2(0, 0);

  protected override defaultOptions() { return {}; }

  public attach(element: LTElement): void {
    this.target = element;
  }

  public detach(): void {
    this.target = null;
  }

  override compute(renderer: CanvasRenderer): void {
    if (!this.target || !this.target.getBounds) return;

    const bounds = this.target.getBounds();
    const worldTx = this.target.getWorldTransform();

    // Transform local-space corners to world space
    const bl = bounds.v1;
    const tr = bounds.v2;
    const tl = new V2(bl.x, tr.y);
    const br = new V2(tr.x, bl.y);

    this._corners = [
      worldTx.multiplyV2(tl), // 0: top-left (nw)
      worldTx.multiplyV2(tr), // 1: top-right (ne)
      worldTx.multiplyV2(br), // 2: bottom-right (se)
      worldTx.multiplyV2(bl), // 3: bottom-left (sw)
    ];

    const mid = (a: V2, b: V2) => new V2((a.x + b.x) / 2, (a.y + b.y) / 2);

    //  nw=0, n=1, ne=2, e=3, se=4, s=5, sw=6, w=7
    this._resizePositions = [
      this._corners[0],                      // nw
      mid(this._corners[0], this._corners[1]), // n
      this._corners[1],                      // ne
      mid(this._corners[1], this._corners[2]), // e
      this._corners[2],                      // se
      mid(this._corners[2], this._corners[3]), // s
      this._corners[3],                      // sw
      mid(this._corners[3], this._corners[0]), // w
    ];

    this._center = mid(this._corners[0], this._corners[2]);

    // Rotation handle: above the top-center in screen coords
    const topCenter = this._resizePositions[1]; // 'n'
    const rotateOffsetWorld = renderer.measureScreenInWorld(ROTATE_OFFSET * (window.devicePixelRatio || 1));
    // Direction from center to top-center
    const toTop = topCenter.sub(this._center);
    const len = toTop.length();
    if (len > 0) {
      this._rotatePosition = topCenter.add(toTop.scale(rotateOffsetWorld / len));
    } else {
      this._rotatePosition = new V2(topCenter.x, topCenter.y - rotateOffsetWorld);
    }
  }

  /**
   * Hit-test a world-space point against the selection box handles and body.
   * Returns the zone name or null.
   */
  public hitTest(worldPoint: V2, renderer: CanvasRenderer): SelectionHitZone {
    if (!this.target || !this.target.getBounds) return null;

    const hitRadius = renderer.measureScreenInWorld(HIT_RADIUS * (window.devicePixelRatio || 1));

    // Test rotation handle first
    if (worldPoint.distanceTo(this._rotatePosition) < hitRadius) {
      return 'rotate';
    }

    // Test resize handles (priority over body)
    const zoneNames: SelectionHitZone[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (let i = 0; i < this._resizePositions.length; i++) {
      if (worldPoint.distanceTo(this._resizePositions[i]) < hitRadius) {
        return zoneNames[i];
      }
    }

    // Test body (point inside the quad formed by 4 corners)
    if (this._pointInQuad(worldPoint)) {
      return 'body';
    }

    return null;
  }

  /**
   * Apply a resize delta from a handle drag.
   * Updates the target element's position and scale.
   */
  public applyResize(zone: SelectionHitZone, worldDelta: V2): void {
    if (!this.target || zone === 'body' || zone === 'rotate' || zone === null) return;

    // Determine which axes and directions the handle affects
    const affectsLeft = zone === 'nw' || zone === 'w' || zone === 'sw';
    const affectsRight = zone === 'ne' || zone === 'e' || zone === 'se';
    const affectsTop = zone === 'nw' || zone === 'n' || zone === 'ne';
    const affectsBottom = zone === 'sw' || zone === 's' || zone === 'se';

    // Work in screen-aligned (pre-rotation) deltas for simplicity
    const dx = worldDelta.x;
    const dy = worldDelta.y;
    const bounds = this.target.getBounds!();
    const bw = bounds.width * this.target.scale.x;
    const bh = bounds.height * this.target.scale.y;

    let sx = this.target.scale.x;
    let sy = this.target.scale.y;
    let px = this.target.position.x;
    let py = this.target.position.y;

    if (affectsRight) {
      sx = bw > 0 ? (bw + dx) / (bounds.width) : sx;
    }
    if (affectsLeft) {
      sx = bw > 0 ? (bw - dx) / (bounds.width) : sx;
      px += dx;
    }
    if (affectsBottom) {
      sy = bh > 0 ? (bh + dy) / (bounds.height) : sy;
    }
    if (affectsTop) {
      sy = bh > 0 ? (bh - dy) / (bounds.height) : sy;
      py += dy;
    }

    // Prevent negative / near-zero scale
    if (sx > 0.01) this.target.scale = new V2(sx, sy > 0.01 ? sy : this.target.scale.y);
    if (sy > 0.01) this.target.scale = new V2(sx > 0.01 ? sx : this.target.scale.x, sy);
    this.target.position = new V2(
      affectsLeft ? px : this.target.position.x,
      affectsTop ? py : this.target.position.y,
    );
  }

  /**
   * Apply rotation from the rotation handle.
   * Sets the target element's rotation based on the angle from center to the mouse.
   */
  public applyRotation(worldPoint: V2): void {
    if (!this.target) return;
    const dx = worldPoint.x - this._center.x;
    const dy = worldPoint.y - this._center.y;
    // atan2 gives angle from positive X axis; we want angle from "up" (negative Y)
    this.target.rotation = Math.atan2(dx, -dy);
  }

  override render(renderer: CanvasRenderer): void {
    if (!this.target || !this.target.getBounds || this._corners.length < 4) return;

    const colorStr = SELECTION_COLOR.opaque(0.9).toString();
    const hdpi = window.devicePixelRatio || 1;
    const handleHalf = renderer.measureScreenInWorld(HANDLE_HALF * hdpi);

    // ── Dashed bounding rectangle ───────────────────────────────────────
    const batch = renderer.draw(colorStr, 1);
    batch.begin(colorStr, 1, { dashPattern: [6, 4] });
    batch.moveTo(this._corners[0]);
    batch.lineTo(this._corners[1]);
    batch.lineTo(this._corners[2]);
    batch.lineTo(this._corners[3]);
    batch.lineTo(this._corners[0]);
    batch.stroke();

    // ── Resize handle squares ───────────────────────────────────────────
    batch.begin(colorStr, 1);
    for (const pos of this._resizePositions) {
      batch.moveTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
    }
    batch.stroke();

    // Fill resize handles
    batch.begin(new Color(255, 255, 255).opaque(0.9).toString(), 1);
    for (const pos of this._resizePositions) {
      batch.moveTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
      batch.fill();
    }
    // Stroke outlines on top
    batch.begin(colorStr, 1);
    for (const pos of this._resizePositions) {
      batch.moveTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y - handleHalf));
      batch.lineTo(new V2(pos.x + handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y + handleHalf));
      batch.lineTo(new V2(pos.x - handleHalf, pos.y - handleHalf));
      batch.stroke();
    }

    // ── Rotation handle ─────────────────────────────────────────────────
    // Connecting line from top-center to rotation handle
    const topCenter = this._resizePositions[1];
    batch.begin(colorStr, 1, { dashPattern: [4, 3] });
    batch.moveTo(topCenter);
    batch.lineTo(this._rotatePosition);
    batch.stroke();

    // Rotation handle circle
    const rotateRadius = renderer.measureScreenInWorld(5 * hdpi);
    batch.begin(new Color(255, 255, 255).opaque(0.9).toString(), 1);
    batch.arc(this._rotatePosition, rotateRadius);
    batch.fill();
    batch.begin(colorStr, 1);
    batch.arc(this._rotatePosition, rotateRadius);
    batch.stroke();
  }

  /** Simple point-in-convex-quad test using cross products. */
  private _pointInQuad(p: V2): boolean {
    const c = this._corners;
    if (c.length < 4) return false;
    // Test each edge: all cross products should have the same sign
    let sign: number | null = null;
    for (let i = 0; i < 4; i++) {
      const a = c[i];
      const b = c[(i + 1) % 4];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (sign === null) {
        sign = cross;
      } else if (sign * cross < 0) {
        return false;
      }
    }
    return true;
  }
}
