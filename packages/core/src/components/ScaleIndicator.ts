import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import type { LunaTerraEngine } from '../engine/engine';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { LTElement } from '../render/Elements/LTElement';
import { resolveThemeColor, themeColor } from '../render/theme';

// ── Options ────────────────────────────────────────────────────────────────

export interface ScaleIndicatorOptions {
  /**
   * Convert a world-space distance to a display string.
   * Default: `(n) => String(n)` (shows raw world units).
   */
  formatter?: (worldUnits: number) => string;
  /** Distance from the bottom of the canvas in CSS pixels (default 20). */
  bottom?: number;
  /** Distance from the left of the canvas in CSS pixels (default 16). */
  left?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Round `x` to a human-friendly number: 1, 2, 5, 10, 20, 50 …
 */
function niceNumber(x: number): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nice: number;
  if (f < 1.5) nice = 1;
  else if (f < 3.5) nice = 2;
  else if (f < 7.5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

// ── Component ──────────────────────────────────────────────────────────────

/**
 * A map-style scale bar rendered in screen space at the bottom-left corner.
 *
 * Usage:
 * ```ts
 * engine.add(new ScaleIndicator({
 *   formatter: (km) => `${km.toFixed(1)} km`,
 * }));
 * ```
 */
export class ScaleIndicator extends LTElement<ScaleIndicatorOptions> {
  protected defaultOptions(): ScaleIndicatorOptions {
    return {};
  }

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);
  }

  override render(renderer: CanvasRenderer) {
    const opts = this.options;
    const hdpi = window.devicePixelRatio || 1;
    const bottomCSS = opts.bottom ?? 20;
    const leftCSS = opts.left ?? 16;

    // ── Measure ───────────────────────────────────────────────────────────
    // How many world units correspond to 100 CSS pixels at the current zoom?
    const targetCSSpx = 100;
    const rawWorld = renderer.measureScreenInWorld(targetCSSpx * hdpi);
    if (!rawWorld || !isFinite(rawWorld) || rawWorld <= 0) return;

    const niceWorld = niceNumber(rawWorld);
    const barPx = Math.round((niceWorld / rawWorld) * targetCSSpx * hdpi);
    const label = opts.formatter ? opts.formatter(niceWorld) : String(niceWorld);

    // ── Layout (physical pixels) ──────────────────────────────────────────
    const canvasH = renderer.height; // physical
    const leftPx = leftCSS * hdpi;
    const bottomPx = bottomCSS * hdpi;
    const y = canvasH - bottomPx;

    const capH = 6 * hdpi;
    const lineW = 1.5 * hdpi;
    const ruleColor = _themeColor(renderer, 'ui.scaleIndicator.rule', new Color(0, 0, 0, 0.55)).toString();
    const textColor = _themeColor(renderer, 'ui.scaleIndicator.text', new Color(0, 0, 0, 0.7)).toString();

    // ── Draw ──────────────────────────────────────────────────────────────
    const b = renderer.drawScreenSpace(ruleColor, lineW);

    // Horizontal rule
    b.moveTo(new V2(leftPx, y));
    b.lineTo(new V2(leftPx + barPx, y));
    b.stroke();

    // Left cap
    const bL = renderer.drawScreenSpace(ruleColor, lineW);
    bL.moveTo(new V2(leftPx, y - capH));
    bL.lineTo(new V2(leftPx, y));
    bL.stroke();

    // Right cap
    const bR = renderer.drawScreenSpace(ruleColor, lineW);
    bR.moveTo(new V2(leftPx + barPx, y - capH));
    bR.lineTo(new V2(leftPx + barPx, y));
    bR.stroke();

    // Label (above rule, centred)
    const labelX = leftPx + barPx / 2;
    const labelY = y - capH - 4 * hdpi;
    renderer.drawScreenSpace(textColor).renderText(
      label,
      new V2(labelX, labelY),
      10 * hdpi,
    );
  }
}

function _themeColor(renderer: CanvasRenderer, path: string, fallback: Color): Color {
  return resolveThemeColor(themeColor(path), renderer.theme) ?? fallback;
}
