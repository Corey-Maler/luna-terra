import type { CanvasRenderer } from '@lunaterra/core';
import { LTElement } from '@lunaterra/core';
import { buildRoundedRectPath } from '@lunaterra/elements';

export interface PanelOptions {
  /** X origin inside the container's coordinate space. */
  x: number;
  /** Y origin inside the container's coordinate space. */
  y: number;
  /** Panel width in coordinate units. */
  width: number;
  /** Panel height in coordinate units. */
  height: number;
  /** Corner radius (coordinate units, default 4). */
  cornerRadius?: number;
  /** Background fill color (default 'rgba(20,20,28,0.88)'). */
  backgroundColor?: string;
  /** Border color (default 'rgba(255,255,255,0.12)'). */
  borderColor?: string;
  /** Border line width (default 1). */
  borderWidth?: number;
}

/**
 * Panel — a rounded-rect background element.
 *
 * Designed to be used inside a `ScreenContainer`. Coordinates are in the
 * container's world space (CSS-px by default). Uses quadratic bezier corners
 * so rendering is correct under any affine transform, including the Y-flip
 * applied by `ScreenContainer`.
 */
export class Panel extends LTElement<PanelOptions> {
  protected defaultOptions(): PanelOptions {
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      cornerRadius: 4,
      backgroundColor: 'rgba(20,20,28,0.88)',
      borderColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
    };
  }

  override render(renderer: CanvasRenderer): void {
    const {
      x, y, width, height,
      cornerRadius = 4,
      backgroundColor = 'rgba(20,20,28,0.88)',
      borderColor = 'rgba(255,255,255,0.12)',
      borderWidth = 1,
    } = this.options;

    const r = Math.min(cornerRadius, Math.abs(width) / 2, Math.abs(height) / 2);

    // Fill pass
    const bf = renderer.batch(backgroundColor, borderWidth);
    buildRoundedRectPath(bf, x, y, width, height, r);
    bf.ctx2d.fillStyle = backgroundColor;
    bf.fill();

    // Border pass (separate batch call → fresh beginPath)
    if (borderWidth > 0) {
      const bs = renderer.batch(borderColor, borderWidth);
      buildRoundedRectPath(bs, x, y, width, height, r);
      bs.stroke();
    }
  }
}
