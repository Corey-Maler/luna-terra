import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer, type LunaTerraEngine } from '@lunaterra/core';
import type { CrosshairOptions } from './chart-types';

/**
 * Crosshair — follows the mouse inside the axis domain.
 * Draws a dashed vertical line and shows the X value below the axis.
 *
 * Usage: add a Crosshair with the same domain as your Axis, then hover
 * the canvas to see the X position tracked.
 */
export class Crosshair extends LTStyledElement<CrosshairOptions> {
  protected defaultOptions(): CrosshairOptions {
    return {
      xMin: -0.4,
      xMax: 0.4,
      yMin: -0.4,
      yMax: 0.4,
      labelSize: 11,
      lineWidth: 1,
    };
  }

  constructor(options?: Partial<CrosshairOptions>) {
    super(options, { opacity: 1, color: null });
  }

  /** Current world-space X under the cursor, or null when outside domain. */
  private _mouseX: number | null = null;

  private _unsubscribeMouse?: () => void;

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);

    this._unsubscribeMouse = engine.renderer.mouseHandlers.$mousePositionWorld.subscribe((p) => {
      const { xMin, xMax } = this.options;
      const next = p.x >= xMin && p.x <= xMax ? p.x : null;
      if (next !== this._mouseX) {
        this._mouseX = next;
        engine.requestUpdate();
      }
    });
  }

  destroy(): void {
    this._unsubscribeMouse?.();
    this._unsubscribeMouse = undefined;
  }

  override render(renderer: CanvasRenderer): void {
    if (this._mouseX === null) return;

    const { yMin, yMax, labelSize = 11, lineWidth = 1, fns = [], series = [] } = this.options;
    const x = this._mouseX;

    const { color } = this.computedStyles;
    const colorStr = color?.toString() ?? 'rgba(255,255,255,0.55)';

    // Dashed vertical line spanning the Y domain
    const b = renderer.batch(colorStr, lineWidth);
    b.renew(colorStr, lineWidth, { dashPattern: [5, 4] });
    b.line(new V2(x, yMin), new V2(x, yMax));
    b.stroke();

    // Dots on functions
    const dotRadius = renderer.measureScreenInWorld(4.5);
    for (const fn of fns) {
      const y = fn(x);
      if (!isFinite(y)) continue;
      const dot = renderer.batch(colorStr, 1);
      dot.fillStyle = colorStr;
      dot.arc(new V2(x, y), dotRadius);
      dot.fill();
    }

    // Dots on data series (linearly interpolated)
    for (const data of series) {
      const y = interpolateSeries(data, x);
      if (y === null) continue;
      const dot = renderer.batch(colorStr, 1);
      dot.fillStyle = colorStr;
      dot.arc(new V2(x, y), dotRadius);
      dot.fill();
    }

    // X-value label just below the X axis (below yMin)
    const labelOffset = renderer.measureScreenInWorld(14);
    const label = formatValue(x);
    renderer.batch(colorStr, 1).renderText(label, new V2(x, yMin - labelOffset), labelSize);
  }
}

/** Format a number to at most 4 significant figures, stripping trailing zeros. */
function formatValue(n: number): string {
  const s = n.toPrecision(4);
  return String(parseFloat(s));
}

/** Linearly interpolate Y from a sorted {x,y} array at the given x. Returns null when out of range. */
function interpolateSeries(data: Array<{ x: number; y: number }>, x: number): number | null {
  for (let i = 0; i < data.length - 1; i++) {
    if (x >= data[i].x && x <= data[i + 1].x) {
      const t = (x - data[i].x) / (data[i + 1].x - data[i].x);
      return data[i].y + t * (data[i + 1].y - data[i].y);
    }
  }
  return null;
}
