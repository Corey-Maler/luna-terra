import { Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import type { LunaTerraEngine } from '../engine/engine';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { LTElement } from '../render/Elements/LTElement';
import { resolveThemeColor, themeColor } from '../render/theme';

// ── Options ────────────────────────────────────────────────────────────────

export interface ZoomControlsOptions {
  /**
   * When provided a "fit content" (⊡) button is shown.
   * Clicking it calls `engine.zoomToRect(contentBounds)`.
   */
  contentBounds?: Rect2D;
  /** Distance from the bottom of the canvas in CSS pixels (default 20). */
  bottom?: number;
  /** Distance from the right edge of the canvas in CSS pixels (default 16). */
  right?: number;
}

// ── Layout constants (CSS px, scaled by HDPI inside render) ───────────────

const BTN = 30;   // button width & height (CSS px)
const GAP = 4;    // gap between buttons
const PAD = 10;   // inner text padding
const PANEL_H = BTN;

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Zoom controls overlay — bottom-right corner.
 *
 * Displays: [ − ]  z 3.2  [ + ]  [ ⊡ ]
 *
 * Usage:
 * ```ts
 * engine.add(new ZoomControls({ contentBounds: new Rect2D(new V2(0,0), new V2(1,1)) }));
 * ```
 */
export class ZoomControls extends LTElement<ZoomControlsOptions> {
  protected defaultOptions(): ZoomControlsOptions {
    return {};
  }

  private _zoomEngine: LunaTerraEngine | null = null;
  private _cleanupClick?: () => void;

  // Hit regions — updated every render (physical px)
  private _hitMinus = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private _hitPlus  = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private _hitFit   = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private _hasFit = false;

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);
    this._zoomEngine = engine;

    const canvas = engine.renderer.canvas;

    const handler = (e: MouseEvent) => {
      if (!this._zoomEngine) return;
      const rect = canvas.getBoundingClientRect();
      const hdpi = window.devicePixelRatio || 1;
      const cx = (e.clientX - rect.left) * hdpi;
      const cy = (e.clientY - rect.top) * hdpi;

      const hit = (r: { x1: number; y1: number; x2: number; y2: number }) =>
        cx >= r.x1 && cx <= r.x2 && cy >= r.y1 && cy <= r.y2;

      const renderer = this._zoomEngine.renderer;

      if (hit(this._hitMinus)) {
        const worldCenter = renderer.screenToWorld(
          new V2(renderer.width / 2, renderer.height / 2),
        );
        this._zoomEngine.zoomToPoint(worldCenter, renderer.zoom / 1.5);
        this._zoomEngine.requestUpdate();
      } else if (hit(this._hitPlus)) {
        const worldCenter = renderer.screenToWorld(
          new V2(renderer.width / 2, renderer.height / 2),
        );
        this._zoomEngine.zoomToPoint(worldCenter, renderer.zoom * 1.5);
        this._zoomEngine.requestUpdate();
      } else if (this._hasFit && hit(this._hitFit)) {
        const bounds = this.options.contentBounds;
        if (bounds) {
          this._zoomEngine.zoomToRect(bounds);
          this._zoomEngine.requestUpdate();
        }
      }
    };

    canvas.addEventListener('click', handler);
    this._cleanupClick = () => canvas.removeEventListener('click', handler);
  }

  override render(renderer: CanvasRenderer) {
    const opts = this.options;
    const hdpi = window.devicePixelRatio || 1;
    const bottomCSS = opts.bottom ?? 20;
    const rightCSS = opts.right ?? 16;
    this._hasFit = !!opts.contentBounds;

    // ── Layout (physical px) ──────────────────────────────────────────────
    const canvasW = renderer.width;  // physical
    const canvasH = renderer.height; // physical

    const btnPx  = BTN * hdpi;
    const gapPx  = GAP * hdpi;
    const padPx  = PAD * hdpi;
    const panelH = PANEL_H * hdpi;
    const bottomPx = bottomCSS * hdpi;
    const rightPx  = rightCSS * hdpi;

    // Zoom label text
    const levelStr = `z ${renderer.zoomLevel.toFixed(1)}`;
    // Estimate label width: ~7 CSS-px per char
    const labelW = Math.max((levelStr.length * 7 + PAD * 2) * hdpi, 70 * hdpi);

    const totalW = btnPx + gapPx + labelW + gapPx + btnPx
      + (this._hasFit ? gapPx + btnPx : 0);

    const panelX = canvasW - rightPx - totalW;
    const panelY = canvasH - bottomPx - panelH;
    const panelBg = _themeColor(renderer, 'ui.zoomControls.panelBg', new Color(243, 243, 243, 0.92)).toString();
    const panelBorder = _themeColor(renderer, 'ui.zoomControls.panelBorder', new Color(0, 0, 0, 0.1)).toString();
    const buttonText = _themeColor(renderer, 'ui.zoomControls.buttonText', new Color(51, 51, 51, 1)).toString();
    const labelText = _themeColor(renderer, 'ui.zoomControls.labelText', new Color(85, 85, 85, 1)).toString();

    // ── Background ────────────────────────────────────────────────────────
    const bg = renderer.drawScreenSpace(panelBg, 1);
    const r = 6 * hdpi; // corner radius for rounding
    _roundRect(bg, panelX - padPx / 2, panelY, totalW + padPx, panelH, r);
    bg.fill();

    const border = renderer.drawScreenSpace(panelBorder, 1);
    _roundRect(border, panelX - padPx / 2, panelY, totalW + padPx, panelH, r);
    border.stroke();

    // ── Build button positions ────────────────────────────────────────────
    let x = panelX;

    // Minus button
    this._hitMinus = { x1: x, y1: panelY, x2: x + btnPx, y2: panelY + panelH };
    _buttonLabel(renderer, '−', x, panelY, btnPx, panelH, hdpi, buttonText);
    x += btnPx + gapPx;

    // Zoom label
    _labelText(renderer, levelStr, x, panelY, labelW, panelH, hdpi, labelText);
    x += labelW + gapPx;

    // Plus button
    this._hitPlus = { x1: x, y1: panelY, x2: x + btnPx, y2: panelY + panelH };
    _buttonLabel(renderer, '+', x, panelY, btnPx, panelH, hdpi, buttonText);
    x += btnPx;

    // Fit button (optional)
    if (this._hasFit) {
      x += gapPx;
      this._hitFit = { x1: x, y1: panelY, x2: x + btnPx, y2: panelY + panelH };
      _buttonLabel(renderer, '⊡', x, panelY, btnPx, panelH, hdpi, buttonText);
    }
  }

  override destroy() {
    this._cleanupClick?.();
    this._zoomEngine = null;
  }
}

// ── Internal drawing helpers ───────────────────────────────────────────────

import type { DrawContext } from '../render/Batch';

function _roundRect(
  b: DrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  b.moveTo(new V2(x + r, y));
  b.lineTo(new V2(x + w - r, y));
  b.arcTo(new V2(x + w, y), new V2(x + w, y + r), r);
  b.lineTo(new V2(x + w, y + h - r));
  b.arcTo(new V2(x + w, y + h), new V2(x + w - r, y + h), r);
  b.lineTo(new V2(x + r, y + h));
  b.arcTo(new V2(x, y + h), new V2(x, y + h - r), r);
  b.lineTo(new V2(x, y + r));
  b.arcTo(new V2(x, y), new V2(x + r, y), r);
}

function _buttonLabel(
  renderer: CanvasRenderer,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  hdpi: number,
  color: string,
) {
  // Rough centre offset: ~6 CSS-px per char for a 13px font
  const charW = 7 * hdpi;
  const textX = x + (w - charW * label.length) / 2;
  const textY = y + h * 0.62;
  renderer
    .drawScreenSpace(color)
    .renderText(label, new V2(textX, textY), 13);
}

function _labelText(
  renderer: CanvasRenderer,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  hdpi: number,
  color: string,
) {
  const charW = 6.5 * hdpi;
  const textX = x + (w - charW * text.length) / 2;
  const textY = y + h * 0.62;
  renderer
    .drawScreenSpace(color)
    .renderText(text, new V2(textX, textY), 11);
}

function _themeColor(renderer: CanvasRenderer, path: string, fallback: Color): Color {
  return resolveThemeColor(themeColor(path), renderer.theme) ?? fallback;
}
