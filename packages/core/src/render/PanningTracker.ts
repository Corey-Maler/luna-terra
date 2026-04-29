import { M3, Rect2D, V2 } from '@lunaterra/math';
import type { ViewPort } from './ViewPort';

// ── Animation state ────────────────────────────────────────────────────────

interface AnimState {
  startZoom: number;
  endZoom: number;
  startCenter: V2;
  endCenter: V2;
  elapsed: number;
  duration: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── PanningTracker ─────────────────────────────────────────────────────────

export class PanningTracker {
  public center = new V2(0.2, 0.2);
  public zoom = 1;

  public MAX_ZOOM = 1000;
  public MIN_ZOOM = 0.8;

  /** When set, panning is clamped to keep this rect visible. */
  private _panBounds: Rect2D | null = null;
  public get panBounds(): Rect2D | null { return this._panBounds; }
  public set panBounds(bounds: Rect2D | null) {
    this._panBounds = bounds;
    this._clampToBounds();
    this.updateShiftMatrix();
  }

  private _anim: AnimState | null = null;

  /** Deferred zoom request — stored when zoomToRect is called before the first real resize. */
  private _pendingZoomRect: { rect: Rect2D; padding: number; duration: number } | null = null;

  /**
   * True once onCanvasResize has fired at least once with real container dimensions.
   * Until then, zoomToRect defers so we don't compute targets from the HTML canvas
   * default size (300×150) instead of the actual container size.
   */
  private _layoutReady = false;

  constructor(
    private viewPortTracker: ViewPort,
    private requestUpdate: () => void,
  ) {
    this.updateWorldSpaceMatrix();
    this.updateShiftMatrix();
  }

  public worldSpaceMatrix = new M3();

  private isViewMatrixStale = true;
  private lastViewMatrix = new M3();

  public webGLMatrix = new M3();

  private shiftMatrix = new M3();

  public screenToWorld(p: V2) {
    return this.viewMatrix.inverse().multiplyV2(p);
  }

  /** Current viewport center expressed in world space. */
  public get worldCenter(): V2 {
    return this.screenToWorld(
      new V2(this.viewPortTracker.width / 2, this.viewPortTracker.height / 2),
    );
  }

  public moveCenter(x: number, y: number) {
    this.center.x = x;
    this.center.y = y;
    this._clampToBounds();

    this.updateShiftMatrix();
  }

  public moveCenterBy(x: number, y: number) {
    this.center.x += x;
    this.center.y += y;
    this._clampToBounds();

    this.updateShiftMatrix();
  }

  /** Center the viewport on a specific world-space point without changing zoom. */
  public moveWorldCenterTo(worldPoint: V2) {
    const target = this._clampCenterToBounds(
      this._centerForWorldPoint(worldPoint, this.zoom),
      this.zoom,
    );
    this.center.x = target.x;
    this.center.y = target.y;
    this.updateShiftMatrix();
  }

  /** Offset the current viewport center by a world-space delta without changing zoom. */
  public moveWorldCenterBy(delta: V2) {
    const current = this.worldCenter;
    this.moveWorldCenterTo(new V2(current.x + delta.x, current.y + delta.y));
  }

  public get viewMatrix(): M3 {
    if (this.isViewMatrixStale) {
      this.lastViewMatrix = this.shiftMatrix.multiply(this.worldSpaceMatrix);
      this.isViewMatrixStale = false;
    }
    return this.lastViewMatrix;
  }

  public recalculate() {
    this._clampToBounds();
    this.updateShiftMatrix();
  }

  // ── Animation API ──────────────────────────────────────────────────────

  /**
   * Animate so that `rect` fills the viewport (with optional padding factor 0–1).
   */
  public zoomToRect(rect: Rect2D, padding = 0.85, duration = 400): void {
    // Always store as pending first.
    // If the canvas has already been through a real layout resize, commit immediately.
    // Otherwise defer — the HTML canvas defaults to 300×150 which would give wrong targets.
    this._pendingZoomRect = { rect, padding, duration };
    if (this._layoutReady) {
      const p = this._pendingZoomRect;
      this._pendingZoomRect = null;
      this._commitZoomRect(p.rect, p.padding, p.duration);
    }
  }

  private _commitZoomRect(rect: Rect2D, padding: number, duration: number): void {
    const vp = this.viewPortTracker;
    const ratio = vp.viewPortRatio;

    // World-space extents as transformed by worldSpaceMatrix
    const tl = this.worldSpaceMatrix.multiplyV2(new V2(rect.v1.x, rect.v1.y));
    const br = this.worldSpaceMatrix.multiplyV2(new V2(rect.v2.x, rect.v2.y));
    const screenW = Math.abs(br.x - tl.x);
    const screenH = Math.abs(br.y - tl.y);
    if (screenW < 1e-9 || screenH < 1e-9) return;

    const targetZoomX = (padding * vp.width) / screenW;
    const targetZoomY = (padding * vp.height * ratio) / (screenH * ratio);
    const targetZoom = Math.min(
      Math.max(Math.min(targetZoomX, targetZoomY), this.MIN_ZOOM),
      this.MAX_ZOOM,
    );

    const center = rect.center;
    const targetCenter = this._clampCenterToBounds(
      this._centerForWorldPoint(center, targetZoom),
      targetZoom,
    );

    this._anim = {
      startZoom: this.zoom,
      endZoom: targetZoom,
      startCenter: this.center.clone(),
      endCenter: targetCenter,
      elapsed: 0,
      duration,
    };
  }

  /**
   * Animate so that `worldPoint` appears at the screen centre at `targetZoom`.
   */
  public zoomToPoint(worldPoint: V2, targetZoom: number, duration = 400): void {
    const clamped = Math.min(
      Math.max(targetZoom, this.MIN_ZOOM),
      this.MAX_ZOOM,
    );
    const targetCenter = this._clampCenterToBounds(
      this._centerForWorldPoint(worldPoint, clamped),
      clamped,
    );

    this._anim = {
      startZoom: this.zoom,
      endZoom: clamped,
      startCenter: this.center.clone(),
      endCenter: targetCenter,
      elapsed: 0,
      duration,
    };
  }

  /** Cancel any running zoom animation (e.g. when the user starts dragging). */
  public clearAnimation(): void {
    this._anim = null;
  }

  /**
   * Step the zoom animation.
   * Called each frame from the engine before rendering.
   * Returns true when the engine should keep ticking.
   */
  public tick(dt: number): boolean {
    if (!this._anim) return false;

    this._anim.elapsed += dt;
    const t = Math.min(this._anim.elapsed / this._anim.duration, 1);
    const e = easeInOut(t);

    this.zoom =
      this._anim.startZoom + (this._anim.endZoom - this._anim.startZoom) * e;
    this.center = new V2(
      this._anim.startCenter.x +
        (this._anim.endCenter.x - this._anim.startCenter.x) * e,
      this._anim.startCenter.y +
        (this._anim.endCenter.y - this._anim.startCenter.y) * e,
    );

    this.updateShiftMatrix();

    if (t >= 1) {
      this._anim = null;
    }

    return true;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Adjust a prospective `center` so that the viewport at `zoom` doesn't
   * overshoot panBounds. If no bounds are set, returns center unchanged.
   */
  private _clampCenterToBounds(center: V2, zoom: number): V2 {
    if (!this.panBounds) return center;
    const shift = new M3()
      .transition(center.x, center.y)
      .scale(zoom, zoom);
    const vm = shift.multiply(this.worldSpaceMatrix);
    const inv = vm.inverse();
    const vp = this.viewPortTracker;
    const tl = inv.multiplyV2(new V2(0, 0));
    const br = inv.multiplyV2(new V2(vp.width, vp.height));
    const vr = new Rect2D(tl, br);
    const overshoot = this._computeOvershoot(vr);
    if (overshoot.x === 0 && overshoot.y === 0) return center;
    const mid = vr.center;
    return this._centerForWorldPoint(
      new V2(mid.x + overshoot.x, mid.y + overshoot.y),
      zoom,
    );
  }

  /**
   * Hard-clamp the current center so the viewport stays within panBounds.
   */
  private _clampToBounds(): void {
    if (!this.panBounds) return;
    const clamped = this._clampCenterToBounds(this.center, this.zoom);
    this.center.x = clamped.x;
    this.center.y = clamped.y;
  }

  /**
   * Returns the `center` V2 that makes `worldPoint` appear at the
   * exact screen centre at the given `zoom`.
   */
  private _centerForWorldPoint(worldPoint: V2, zoom: number): V2 {
    const vp = this.viewPortTracker;
    const p = this.worldSpaceMatrix.multiplyV2(worldPoint);
    return new V2(vp.width / 2 - zoom * p.x, vp.height / 2 - zoom * p.y);
  }

  /**
   * Returns the current visible area as a world-space Rect2D.
   */
  private _getVisibleWorldRect(): Rect2D {
    const inv = this.viewMatrix.inverse();
    const vp = this.viewPortTracker;
    const tl = inv.multiplyV2(new V2(0, 0));
    const br = inv.multiplyV2(new V2(vp.width, vp.height));
    return new Rect2D(tl, br);
  }

  /**
   * Compute the world-space displacement needed to bring the visible rect
   * back within panBounds (iOS-style edge clamping).
   *
   * When the viewport is smaller than bounds → clamp edges.
   * When the viewport is larger → centre the bounds inside it.
   */
  private _computeOvershoot(vr: Rect2D): V2 {
    if (!this.panBounds) return new V2(0, 0);
    const b = this.panBounds;

    let dx = 0;
    let dy = 0;

    if (vr.width <= b.width) {
      if (vr.v1.x < b.v1.x) dx = b.v1.x - vr.v1.x;
      else if (vr.v2.x > b.v2.x) dx = b.v2.x - vr.v2.x;
    } else {
      dx = (b.v1.x + b.v2.x - vr.v1.x - vr.v2.x) / 2;
    }

    if (vr.height <= b.height) {
      if (vr.v1.y < b.v1.y) dy = b.v1.y - vr.v1.y;
      else if (vr.v2.y > b.v2.y) dy = b.v2.y - vr.v2.y;
    } else {
      dy = (b.v1.y + b.v2.y - vr.v1.y - vr.v2.y) / 2;
    }

    return new V2(dx, dy);
  }

  // ── Matrix updates ─────────────────────────────────────────────────────

  protected updateShiftMatrix() {
    this.shiftMatrix = new M3()
      .transition(this.center.x, this.center.y)
      .scale(this.zoom, this.zoom);

    this.isViewMatrixStale = true;

    const screenRatio = this.viewPortTracker.viewPortRatio;

    const c = this.center.byElementDiv(this.viewPortTracker.viewPort);

    const webGLMatrix = new M3()
      .scale(1, -1)
      .transition(-1, -1)
      .scale(2, 2)
      .transition(c.x, c.y)
      .scale(this.zoom, this.zoom)
      .scale(1 / screenRatio, 1)
      .scale(1, -1)
      .transition(0, -1);

    this.webGLMatrix = webGLMatrix;

    this.requestUpdate();
  }

  /**
   * Recompute the world-space matrix from the current viewport dimensions.
   * @param fromResize  Pass `true` when called from the ResizeObserver (real layout resize).
   *                    This marks the tracker layout-ready and commits any deferred zoomToRect.
   */
  public updateWorldSpaceMatrix(fromResize = false) {
    const width = this.viewPortTracker.width;
    const height = this.viewPortTracker.height;
    if (width === 0 || height === 0) return;
    const wRatio = this.viewPortTracker.viewPortRatio;
    this.worldSpaceMatrix = new M3()
      .scale((1 / wRatio) * width, -1 * height)
      .transition(0, -1);

    if (fromResize) {
      this._layoutReady = true;
      if (this._pendingZoomRect) {
        const { rect, padding, duration } = this._pendingZoomRect;
        this._pendingZoomRect = null;
        this._commitZoomRect(rect, padding, duration);
        this.requestUpdate();
      }
    }
  }
}
