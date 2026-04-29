import { V2 } from '@lunaterra/math';
import type { LunaTerraEngine } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { LTElement, resolveThemeColor, themeColor } from '@lunaterra/core';
import type { DrawContext } from '@lunaterra/core';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScaleRulerTick {
  /** Numeric value for this stop. */
  value: number;
  /** Short display label, e.g. "Solar" or "0". */
  label: string;
}

export interface ScaleRulerOptions {
  /** Ordered list of named stops. Must have at least 2. */
  ticks: ScaleRulerTick[];
  /** Current value (continuous, clamped to [ticks[0].value, ticks[last].value]). */
  value: number;
  /** Called on every change while dragging, and after snap-on-release. */
  onChange?: (value: number) => void;
  /** Vertical position of the ruler. Default: 'bottom-center'. */
  position?: 'bottom-center' | 'top-center';
  /** Distance from top / bottom canvas edge in CSS px (default 24). */
  edgeOffset?: number;
  /** Horizontal padding from canvas edges in CSS px (default 40). */
  sidePadding?: number;
  /**
   * When true (default), releasing the drag snaps to the nearest named tick.
   * When false, the value stays wherever the drag ended — useful for continuous
   * numeric ranges where the user may want to land on any value (e.g. 32).
   */
  sticky?: boolean;
  /**
   * 'drag-caret' (default): User drags the caret along the fixed track.
   * 'scroll-scale': Caret is fixed at the track centre; dragging scrolls the
   * scale beneath it (good for touch / swipe UX).
   */
  interactionMode?: 'drag-caret' | 'scroll-scale';
}

// ── Layout constants (CSS px, multiplied by hdpi inside render) ────────────

const TRACK_H       = 1.5;  // track line height
const TOOTH_BASE_H  = 2;    // minimum tooth height (CSS px)
const TOOTH_PEAK_H  = 9;    // extra height at caret peak
const TOOTH_GAP     = 5;    // spacing between teeth centres (CSS px)
const TOOTH_W       = 1.5;  // tooth width (CSS px)
const TOOTH_SIGMA   = 28;   // Gaussian σ in CSS px
const TICK_DOT_R    = 2.5;  // radius of tick stop dot (CSS px)
const LABEL_PAD     = 8;    // label below track
const LABEL_SIZE    = 9;    // font size (CSS px) for tick labels
const CARET_H       = 22;   // caret bar total height
const CARET_PILL_W  = 40;   // badge width (CSS px)
const CARET_PILL_H  = 17;   // badge height (CSS px)
const CARET_PILL_R  = 3;    // badge corner radius (CSS px)
const CARET_ARROW_H = 5;    // downward arrow tip height (CSS px)
const CARET_ARROW_W = 8;    // downward arrow base width (CSS px)
const SNAP_DURATION = 180;  // ms for snap-on-release animation

// ── Component ──────────────────────────────────────────────────────────────

/**
 * A horizontal ruler with named tick stops and an animated draggable caret.
 *
 * The dots ("teeth") along the track grow in height near the caret.
 * Dragging is continuous; releasing snaps to the nearest tick.
 *
 * ```ts
 * const ruler = new ScaleRuler({
 *   ticks: [
 *     { value: 0, label: 'Luna-Terra' },
 *     { value: 1, label: 'Inner' },
 *     { value: 2, label: 'Solar' },
 *     { value: 3, label: 'Stars' },
 *     { value: 4, label: 'Galaxy' },
 *   ],
 *   value: 2,
 *   onChange: (v) => scene.setZoom(v),
 * });
 * engine.add(ruler);
 * ```
 */
export class ScaleRuler extends LTElement<ScaleRulerOptions> {
  // Continuous live value (may be mid-snap animation)
  private _value: number;
  // Snap animation state
  private _snapFrom: number | null = null;
  private _snapTo: number | null = null;
  private _snapElapsed = 0;
  private _isDragging = false;
  // Hover fade state: _isNear tracks whether mouse is in the hit zone
  private _hoverStrength = 0;
  private _isNear = false;
  private _onMouseLeave?: () => void;
  // Mouse screen X used for tooth proximity (physical px)
  private _caretScreenX: number | null = null;
  // Cleanup for mouse subscription
  private _cancelDrag?: () => void;
  // Track geometry (physical px), updated every render for hit-testing
  private _trackX0 = 0;
  private _trackX1 = 0;
  private _trackY  = 0;
  // scroll-scale: drag origin state
  private _scrollDragStartX: number | null = null;
  private _scrollDragStartValue: number | null = null;

  constructor(options: ScaleRulerOptions) {
    super(options);
    this._value = options.value;
  }

  protected defaultOptions(): ScaleRulerOptions {
    return {
      ticks: [],
      value: 0,
      interactionMode: 'drag-caret',
    };
  }

  /** Programmatically update the value (triggers redraw). */
  public setValue(v: number): void {
    const { ticks } = this.options;
    if (!ticks.length) return;
    this._value = Math.min(Math.max(v, ticks[0].value), ticks[ticks.length - 1].value);
    this._snapFrom = null;
    this._snapTo = null;
    this.engine?.requestUpdate();
  }

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);

    // Fade out when pointer leaves the canvas entirely.
    const onLeave = () => {
      this._isNear = false;
      engine.requestUpdate();
    };
    engine.renderer.canvas.addEventListener('mouseleave', onLeave);
    this._onMouseLeave = () => engine.renderer.canvas.removeEventListener('mouseleave', onLeave);

    const mh = engine.renderer.mouseHandlers;
    const mode = this.options.interactionMode ?? 'drag-caret';

    /** Shared: proximity check used by both modes for hover fade. */
    const checkNear = (worldPt: V2): void => {
      const renderer = engine.renderer;
      const hdpi = window.devicePixelRatio || 1;
      const screenPt = renderer.worldToScreen(worldPt);
      const near =
        Math.abs(screenPt.x - (this._trackX0 + this._trackX1) / 2) <
          (this._trackX1 - this._trackX0) / 2 + 20 * hdpi &&
        Math.abs(screenPt.y - this._trackY) < 40 * hdpi;
      if (near !== this._isNear) {
        this._isNear = near;
        engine.requestUpdate();
      }
      engine.requestUpdate();
    };

    /** Shared: snap-or-release handler used by both modes on drag end. */
    const handleDragEnd = (): void => {
      this._isDragging = false;
      this._scrollDragStartX = null;
      this._scrollDragStartValue = null;
      const sticky = this.options.sticky ?? true;
      if (sticky) {
        const nearest = this._nearestTick(this._value);
        if (Math.abs(nearest - this._value) > 1e-4) {
          this._snapFrom = this._value;
          this._snapTo = nearest;
          this._snapElapsed = 0;
        } else {
          this._value = nearest;
          this.options.onChange?.(this._value);
        }
      } else {
        this.options.onChange?.(this._value);
      }
      engine.requestUpdate();
    };

    if (mode === 'drag-caret') {
      this._cancelDrag = mh.activateItemDragMode({
        hitTest: (screenPt) => this._hitTestRuler(screenPt),
        onHover: checkNear,

        onDragStart: (worldPt) => {
          this._isDragging = true;
          this._snapFrom = null;
          this._snapTo = null;
          this._applyDragWorld(worldPt, engine);
          engine.requestUpdate();
        },

        onMove: (worldPt) => {
          if (!this._isDragging) return;
          this._applyDragWorld(worldPt, engine);
          engine.requestUpdate();
        },

        onDragEnd: handleDragEnd,
      });
    } else {
      // 'scroll-scale': caret fixed at track centre; dragging scrolls the scale.
      this._cancelDrag = mh.activateItemDragMode({
        hitTest: (screenPt) => this._hitTestRuler(screenPt),
        onHover: checkNear,

        onDragStart: (worldPt) => {
          this._isDragging = true;
          this._snapFrom = null;
          this._snapTo = null;
          const screenPt = engine.renderer.worldToScreen(worldPt);
          this._scrollDragStartX = screenPt.x;
          this._scrollDragStartValue = this._value;
          engine.requestUpdate();
        },

        onMove: (worldPt) => {
          if (!this._isDragging) return;
          if (this._scrollDragStartX === null || this._scrollDragStartValue === null) return;
          const { ticks } = this.options;
          const minVal = ticks[0].value;
          const maxVal = ticks[ticks.length - 1].value;
          const screenPt = engine.renderer.worldToScreen(worldPt);
          const dx = screenPt.x - this._scrollDragStartX;
          const trackW = Math.max(1, this._trackX1 - this._trackX0);
          const valueDelta = (dx / trackW) * (maxVal - minVal);
          this._value = Math.min(maxVal, Math.max(minVal, this._scrollDragStartValue - valueDelta));
          this.options.onChange?.(this._value);
          engine.requestUpdate();
        },

        onDragEnd: handleDragEnd,
      });
    }
  }

  override update(dt: number): void {
    // Animate hover strength: smooth fade-in (fast) / fade-out (slower)
    const targetStrength = (this._isDragging || this._isNear) ? 1 : 0;
    const rate = targetStrength > this._hoverStrength ? 6 : 3; // in/out speed (per second)
    const delta = rate * dt / 1000;
    if (Math.abs(this._hoverStrength - targetStrength) > 0.004) {
      this._hoverStrength = targetStrength > this._hoverStrength
        ? Math.min(targetStrength, this._hoverStrength + delta)
        : Math.max(targetStrength, this._hoverStrength - delta);
      this.engine?.requestUpdate();
    } else {
      this._hoverStrength = targetStrength;
    }

    if (this._snapFrom !== null && this._snapTo !== null) {
      this._snapElapsed += dt;
      const t = Math.min(this._snapElapsed / SNAP_DURATION, 1);
      const e = _easeOut(t);
      this._value = _lerp(this._snapFrom, this._snapTo, e);
      if (t < 1) {
        this.options.onChange?.(this._value); // continuous feedback during snap
        this.engine?.requestUpdate();
      } else {
        this._value = this._snapTo;
        this.options.onChange?.(this._value);
        this._snapFrom = null;
        this._snapTo = null;
      }
    }
  }

  override destroy(): void {
    this._cancelDrag?.();
    this._cancelDrag = undefined;
    this._onMouseLeave?.();
    this._onMouseLeave = undefined;
  }

  /** Returns true if `screenPt` (physical px) is within the ruler's draggable zone. */
  private _hitTestRuler(screenPt: V2): boolean {
    if (this._trackX0 === 0 && this._trackX1 === 0) return false; // not yet rendered
    const hdpi = window.devicePixelRatio || 1;
    const pad = 24 * hdpi;
    return (
      screenPt.x >= this._trackX0 - pad &&
      screenPt.x <= this._trackX1 + pad &&
      Math.abs(screenPt.y - this._trackY) < (CARET_H / 2 + LABEL_PAD + LABEL_SIZE + 4) * hdpi
    );
  }

  override render(renderer: CanvasRenderer) {
    const opts = this.options;
    const { ticks } = opts;
    if (ticks.length < 2) return;

    const hdpi = window.devicePixelRatio || 1;
    const canvasW = renderer.width;
    const canvasH = renderer.height;
    const pos = opts.position ?? 'bottom-center';
    const edgeCSS = opts.edgeOffset ?? 24;
    const sideCSS = opts.sidePadding ?? 40;

    // ── Layout in physical px ─────────────────────────────────────────────
    const edgePx = edgeCSS * hdpi;
    const sidePx = sideCSS * hdpi;
    const trackX0 = sidePx;
    const trackX1 = canvasW - sidePx;
    const trackW  = trackX1 - trackX0;

    // Tooth + caret are drawn above the track; labels below.
    // Total visual height: CARET_H(above) + TRACK_H + LABEL_PAD + LABEL_SIZE (below)
    const abovePx = (CARET_H + 4) * hdpi;
    const belowPx = (LABEL_PAD + LABEL_SIZE + 4) * hdpi;
    const totalH  = abovePx + TRACK_H * hdpi + belowPx;

    let trackY: number;
    if (pos === 'top-center') {
      trackY = edgePx + abovePx;
    } else {
      trackY = canvasH - edgePx - belowPx;
    }

    // Persist for drag hit-testing
    this._trackX0 = trackX0;
    this._trackX1 = trackX1;
    this._trackY  = trackY;

    const minVal = ticks[0].value;
    const maxVal = ticks[ticks.length - 1].value;

    const interactionMode = opts.interactionMode ?? 'drag-caret';

    /**
     * Map value → physical px X along track.
     * In 'drag-caret': absolute position proportional to value range.
     * In 'scroll-scale': relative to the fixed centre caret (value at centre).
     */
    const trackCentreX = (trackX0 + trackX1) / 2;
    const valToX = interactionMode === 'scroll-scale'
      ? (v: number) => trackCentreX + ((v - this._value) / (maxVal - minVal)) * trackW
      : (v: number) => trackX0 + ((v - minVal) / (maxVal - minVal)) * trackW;

    const caretPx = interactionMode === 'scroll-scale' ? trackCentreX : valToX(this._value);
    this._caretScreenX = caretPx;

    const toothColor = _themeColor(renderer, 'ui.scaleRuler.tooth', _isDarkMode()
      ? 'rgba(200,192,180,0.55)'
      : 'rgba(60,42,26,0.45)');
    const labelColor = _themeColor(renderer, 'ui.scaleRuler.label', _isDarkMode()
      ? 'rgba(200,192,180,0.60)'
      : 'rgba(60,42,26,0.55)');
    const tickColor = _themeColor(renderer, 'ui.scaleRuler.tick', _isDarkMode()
      ? 'rgba(200,192,180,0.45)'
      : 'rgba(60,42,26,0.38)');
    const badgeBg = _themeColor(renderer, 'ui.scaleRuler.badgeBg', _isDarkMode()
      ? 'rgba(230,222,208,0.95)'
      : 'rgba(38,28,18,0.88)');
    const badgeText = _themeColor(renderer, 'ui.scaleRuler.badgeText', _isDarkMode()
      ? 'rgba(38,28,18,1)'
      : 'rgba(235,225,210,1)');

    // ── Teeth ─────────────────────────────────────────────────────────────
    const hs = this._hoverStrength;  // 0..1
    const toothGapPx = TOOTH_GAP * hdpi;
    const toothWPx   = TOOTH_W  * hdpi;
    const toothSigmaPx = TOOTH_SIGMA * hdpi;
    const toothBaseH   = TOOTH_BASE_H * hdpi;
    const toothPeakH   = TOOTH_PEAK_H * hdpi * hs;
    const tickDotR = TICK_DOT_R * hdpi;

    // Pre-compute tick X positions for collision check
    const tickXs = ticks.map(t => valToX(t.value));
    const toothClearance = tickDotR * 2.5;

    const toothAlpha = 0.18 + 0.82 * hs;  // always slightly visible, full at hover
    const tb = renderer.drawScreenSpace(toothColor, 1);
    tb.fillStyle = toothColor;
    tb.save();
    tb.setAlpha(toothAlpha);
    for (let x = trackX0; x <= trackX1 + 0.5; x += toothGapPx) {
      // Skip tooth if it overlaps a tick dot
      if (tickXs.some(tx => Math.abs(x - tx) < toothClearance)) continue;
      const dist  = Math.abs(x - caretPx);
      const gauss = Math.exp(-(dist * dist) / (2 * toothSigmaPx * toothSigmaPx));
      const h     = toothBaseH + toothPeakH * gauss;
      // Draw as a filled rect centred on the track line
      _filledRect(tb, x - toothWPx / 2, trackY - h / 2, toothWPx, h);
    }
    tb.fill();
    tb.restore();

    // ── Tick dots + labels ────────────────────────────────────────────────
    const labelY   = trackY + LABEL_PAD * hdpi + LABEL_SIZE * hdpi;

    const tickDots = renderer.drawScreenSpace(tickColor, 1);
    tickDots.fillStyle = tickColor;
    for (const tick of ticks) {
      const tx = valToX(tick.value);
      if (tx < trackX0 - tickDotR || tx > trackX1 + tickDotR) continue;
      tickDots.moveTo(new V2(tx + tickDotR, trackY));
      tickDots.arc(new V2(tx, trackY), tickDotR);
    }
    tickDots.fill();

    for (const tick of ticks) {
      const tx = valToX(tick.value);
      // Clip labels that would overflow the track area.
      if (tx < trackX0 || tx > trackX1) continue;
      renderer.drawScreenSpace(labelColor).renderText(
        tick.label.toUpperCase(),
        new V2(tx, labelY),
        LABEL_SIZE,
        'center',
      );
    }

    // ── Caret ─────────────────────────────────────────────────────────────
    const pillW     = CARET_PILL_W * hdpi;
    const pillH     = CARET_PILL_H * hdpi;
    const pillR     = CARET_PILL_R * hdpi;
    const arrowH    = CARET_ARROW_H * hdpi;
    const arrowW    = CARET_ARROW_W * hdpi;
    const pillX     = caretPx - pillW / 2;
    // Badge sits above track with a small gap, arrow tip points down
    const arrowTip  = trackY - 6 * hdpi;
    const pillBot   = arrowTip - arrowH;
    const pillTop   = pillBot - pillH;

    // Badge background (rounded rect + downward arrow triangle)
    const badge = renderer.drawScreenSpace(badgeBg, 1);
    badge.fillStyle = badgeBg;
    _roundRect(badge, pillX, pillTop, pillW, pillH, pillR);
    // Arrow triangle
    badge.moveTo(new V2(caretPx - arrowW / 2, pillBot));
    badge.lineTo(new V2(caretPx + arrowW / 2, pillBot));
    badge.lineTo(new V2(caretPx, arrowTip));
    badge.lineTo(new V2(caretPx - arrowW / 2, pillBot));
    badge.fill();

    // Value text centred in badge
    const valueStr = this._value.toFixed(2);
    const textY = pillTop + pillH * 0.65;
    renderer.drawScreenSpace(badgeText).renderText(
      valueStr,
      new V2(caretPx, textY),
      10,
      'center',
    );

    void totalH; // suppress unused warning — available for future layout use
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Map a drag world-point to a track value, emit onChange. */
  private _applyDragWorld(worldPt: V2, engine: LunaTerraEngine): void {
    const renderer = engine.renderer;
    const screenPt = renderer.worldToScreen(worldPt);
    const physX = screenPt.x;

    const { ticks } = this.options;
    const minVal = ticks[0].value;
    const maxVal = ticks[ticks.length - 1].value;

    const t = (physX - this._trackX0) / Math.max(1, this._trackX1 - this._trackX0);
    const newVal = _lerp(minVal, maxVal, Math.min(1, Math.max(0, t)));
    this._value = newVal;
    this.options.onChange?.(newVal);
  }

  /** Return value of the closest tick to `v`. */
  private _nearestTick(v: number): number {
    const { ticks } = this.options;
    let best = ticks[0].value;
    let bestDist = Math.abs(v - best);
    for (const tick of ticks) {
      const d = Math.abs(v - tick.value);
      if (d < bestDist) { bestDist = d; best = tick.value; }
    }
    return best;
  }
}

// ── Internal drawing helpers ───────────────────────────────────────────────

function _lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function _easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function _isDarkMode(): boolean {
  return typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
}

function _themeColor(renderer: CanvasRenderer, path: string, fallback: string): string {
  return resolveThemeColor(themeColor(path), renderer.theme)?.toString() ?? fallback;
}

/** Rounded rectangle path (adds to current open path — no beginPath). */
function _roundRect(b: DrawContext, x: number, y: number, w: number, h: number, r: number) {
  b.moveTo(new V2(x + r,     y));
  b.lineTo(new V2(x + w - r, y));
  b.arcTo(new V2(x + w, y),     new V2(x + w, y + r),     r);
  b.lineTo(new V2(x + w, y + h - r));
  b.arcTo(new V2(x + w, y + h), new V2(x + w - r, y + h), r);
  b.lineTo(new V2(x + r,     y + h));
  b.arcTo(new V2(x,     y + h), new V2(x,     y + h - r), r);
  b.lineTo(new V2(x,     y + r));
  b.arcTo(new V2(x,     y),     new V2(x + r, y),         r);
  b.lineTo(new V2(x + r,     y));
}

/** Draw a filled rect path (add to current open path — no beginPath). */
function _filledRect(b: DrawContext, x: number, y: number, w: number, h: number) {
  b.moveTo(new V2(x,     y));
  b.lineTo(new V2(x + w, y));
  b.lineTo(new V2(x + w, y + h));
  b.lineTo(new V2(x,     y + h));
  b.lineTo(new V2(x,     y));
}
