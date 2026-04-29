import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';

export interface RectOptions {
  /** Width in local coordinate units. */
  width: number;
  /** Height in local coordinate units. */
  height: number;
  /**
   * Corner radius in local coordinate units (default 0 = sharp corners).
   * Clamped to half the shortest side.
   */
  cornerRadius?: number;
  /**
   * Fill color as a CSS string (e.g. '#ff0000', 'rgba(0,0,0,0.5)').
   * null / undefined = no fill (default).
   */
  fillColor?: string | null;
  /**
   * Draw a border stroke. Color comes from the element's style hierarchy.
   * Default true.
   */
  stroke?: boolean;
  /** Border stroke width in screen pixels (default 1). */
  lineWidth?: number;
}

/**
 * RectElement — draws a rectangle (optionally with rounded corners) in local
 * coordinate space.
 *
 * Position the rect by setting `element.position`. Width/height are specified
 * in options. Stroke color is inherited from the element's `styles.color`
 * (same mechanism as `LineSeries`, etc.).
 *
 * Rounded corners use quadratic bezier curves so the shape transforms
 * correctly under any affine transform, including the Y-flip applied by
 * `ScreenContainer`.
 *
 * ```ts
 * const box = new RectElement({ width: 100, height: 60, cornerRadius: 6,
 *                                fillColor: 'rgba(0,0,0,0.8)', lineWidth: 1 });
 * box.position = new V2(10, 10);
 * box.styles.color = new Color(255, 255, 255);
 * container.appendChild(box);
 * ```
 */
export class RectElement extends LTStyledElement<RectOptions> {
  protected defaultOptions(): RectOptions {
    return {
      width: 100,
      height: 60,
      cornerRadius: 0,
      fillColor: null,
      stroke: true,
      lineWidth: 1,
    };
  }

  constructor(options?: Partial<RectOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const {
      width, height,
      cornerRadius = 0,
      fillColor = null,
      stroke = true,
      lineWidth = 1,
    } = this.options;

    const { color } = this.computedStyles;
    const strokeColor = color?.toString() ?? 'rgba(255,255,255,0.8)';

    // Clamp corner radius so it never exceeds half the shortest side.
    const r = Math.min(cornerRadius, Math.abs(width) / 2, Math.abs(height) / 2);

    if (fillColor) {
      const b = renderer.draw(fillColor, lineWidth);
      buildRoundedRectPath(b, 0, 0, width, height, r);
      b.ctx2d.fillStyle = fillColor;
      b.fill();

      if (stroke) {
        // Rebuild on the same draw context; draw() already started a fresh path.
        // We need a new draw() call to get a fresh path for stroke.
        const bs = renderer.draw(strokeColor, lineWidth);
        buildRoundedRectPath(bs, 0, 0, width, height, r);
        bs.stroke();
      }
    } else if (stroke) {
      const b = renderer.draw(strokeColor, lineWidth);
      buildRoundedRectPath(b, 0, 0, width, height, r);
      b.stroke();
    }
  }
}

/**
 * Build a rounded-rect path on `b` in local/world coordinate space.
 * Uses quadratic bezier corners — transforms correctly under any affine
 * transform (including Y-flip from ScreenContainer).
 *
 * After calling this, invoke `b.fill()` and/or `b.stroke()` to render.
 * Do NOT call `renderer.draw()` between this and the fill/stroke call
 * (it would clear the path).
 *
 * @param b      Draw context returned by `renderer.draw()`
 * @param x      Left edge in local coords
 * @param y      Bottom (or top in CSS-Y-down) edge in local coords
 * @param w      Width in local coords
 * @param h      Height in local coords
 * @param r      Corner radius in local coords (already clamped by caller)
 */
export function buildRoundedRectPath(
  b: ReturnType<CanvasRenderer['draw']>,
  x: number, y: number, w: number, h: number,
  r: number,
): void {
  b.moveTo(new V2(x + r, y));
  b.lineTo(new V2(x + w - r, y));
  b.quadraticCurveTo(new V2(x + w, y), new V2(x + w, y + r));
  b.lineTo(new V2(x + w, y + h - r));
  b.quadraticCurveTo(new V2(x + w, y + h), new V2(x + w - r, y + h));
  b.lineTo(new V2(x + r, y + h));
  b.quadraticCurveTo(new V2(x, y + h), new V2(x, y + h - r));
  b.lineTo(new V2(x, y + r));
  b.quadraticCurveTo(new V2(x, y), new V2(x + r, y));
  b.ctx2d.closePath();
}
