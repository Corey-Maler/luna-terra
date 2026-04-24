import { M3 } from '@lunaterra/math';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { LTElement } from '../render/Elements/LTElement';

export interface ScreenContainerOptions {
  /**
   * Corner of the canvas to anchor this container to.
   * Offsets are measured from that corner in CSS pixels.
   */
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Distance from the anchor corner's X edge in CSS pixels. */
  offsetX: number;
  /** Distance from the anchor corner's Y edge in CSS pixels. */
  offsetY: number;
  /** Container width in CSS pixels. */
  width: number;
  /** Container height in CSS pixels. */
  height: number;
  /**
   * World-space coordinate bounds mapped onto the container rect.
   * Defaults to { xMin: 0, yMin: 0, xMax: width, yMax: height } (CSS-px space, Y-down).
   */
  worldBounds?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/**
 * ScreenContainer — an LTElement that pins its children into a fixed screen-space rect.
 *
 * Children are rendered in a local coordinate system defined by `worldBounds`
 * (defaulting to CSS-pixel coords, Y-down) mapped to the chosen anchor corner
 * at the given offset and size.
 *
 * ```ts
 * const panel = new ScreenContainer({
 *   anchor: 'top-left', offsetX: 8, offsetY: 8,
 *   width: 200, height: 90,
 * });
 * engine.add(panel);
 *
 * const line = new LineSeries({ data: [...] });
 * panel.appendChild(line); // drawn in CSS-px space inside the panel
 * ```
 */
export class ScreenContainer extends LTElement<ScreenContainerOptions> {
  protected defaultOptions(): ScreenContainerOptions {
    return {
      anchor: 'top-left',
      offsetX: 8,
      offsetY: 8,
      width: 200,
      height: 100,
    };
  }

  /**
   * Computes the CSS-pixel rect (top-left corner + size) for this container
   * given the current canvas CSS dimensions.
   */
  public getScreenRect(renderer: CanvasRenderer): { x: number; y: number; w: number; h: number } {
    const { anchor, offsetX, offsetY, width, height } = this.options;
    const csW = renderer.width / renderer.hdpi;
    const csH = renderer.height / renderer.hdpi;

    let x: number;
    let y: number;

    switch (anchor) {
      case 'top-right':
        x = csW - offsetX - width;
        y = offsetY;
        break;
      case 'bottom-left':
        x = offsetX;
        y = csH - offsetY - height;
        break;
      case 'bottom-right':
        x = csW - offsetX - width;
        y = csH - offsetY - height;
        break;
      default: // top-left
        x = offsetX;
        y = offsetY;
    }

    return { x, y, w: width, h: height };
  }

  override doRender(renderer: CanvasRenderer): void {
    if (!this.visibility) return;

    const { width, height } = this.options;
    const bounds = this.options.worldBounds ?? { xMin: 0, yMin: 0, xMax: width, yMax: height };
    const rect = this.getScreenRect(renderer);
    const m = CanvasRenderer.makeScreenMatrix(rect.x, rect.y, rect.w, rect.h, bounds, renderer.hdpi);

    renderer.pushScreenTransform(m);

    for (const child of (this as any).children ?? []) {
      child.doRender(renderer);
    }
    for (const child of (this as any).helpers ?? []) {
      child.doRender(renderer);
    }

    this.render(renderer);

    renderer.popScreenTransform();
  }
}
