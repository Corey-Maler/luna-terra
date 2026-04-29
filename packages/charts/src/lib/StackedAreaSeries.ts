import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import type { StackedAreaSeriesOptions } from './chart-types';

/**
 * StackedAreaSeries — renders multiple data layers as cumulative stacked areas.
 *
 * Each layer is a series of `{ x, y }` points. Layers are stacked cumulatively:
 * the bottom edge of layer N is the top edge of layer N-1.
 *
 * Works in any coordinate space — particularly useful inside a `ScreenContainer`
 * where world coords map to CSS pixels.
 *
 * ```ts
 * const stacked = new StackedAreaSeries({
 *   layers: [
 *     { data: frames.map((f, i) => ({ x: i, y: f.children })), color: '#4a9eff' },
 *     { data: frames.map((f, i) => ({ x: i, y: f.render })),   color: '#ff7c43' },
 *   ],
 *   yBase: 0,
 * });
 * ```
 */
export class StackedAreaSeries extends LTStyledElement<StackedAreaSeriesOptions> {
  protected defaultOptions(): StackedAreaSeriesOptions {
    return {
      layers: [],
      yBase: 0,
      lineWidth: 1,
      fillOpacity: 0.75,
    };
  }

  constructor(options?: Partial<StackedAreaSeriesOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const { layers, yBase = 0, lineWidth = 1, fillOpacity = 0.75 } = this.options;
    if (!layers.length) return;

    const n = Math.max(...layers.map((l) => l.data.length));
    if (n < 2) return;

    // Build cumulative stacks: each entry = sum of all layers below + this layer.
    const stacks: Array<{ x: number; y: number }[]> = [];

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const prev = stacks[li - 1];
      const cum: { x: number; y: number }[] = [];

      for (let i = 0; i < layer.data.length; i++) {
        const x = layer.data[i].x;
        const prevY = prev ? (prev[i]?.y ?? yBase) : yBase;
        cum.push({ x, y: prevY + layer.data[i].y });
      }
      stacks.push(cum);
    }

    // Draw layers bottom-to-top so lower layers are behind upper ones.
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const topPoints = stacks[li].map((d) => new V2(d.x, d.y));
      const bottomY = li === 0 ? yBase : undefined;
      const bottomPoints =
        li === 0
          ? null
          : stacks[li - 1].map((d) => new V2(d.x, d.y));

      const colorStr = layer.color;
      const colorObj = new Color(...parseColorStr(colorStr));

      // Fill between top edge and bottom edge (or yBase for first layer)
      if (fillOpacity > 0) {
        if (bottomPoints) {
          // Polygon: top edge forward, bottom edge reversed.
          const pts = [...topPoints, ...[...bottomPoints].reverse()];
          const b = renderer.draw(colorStr, lineWidth);
          b.ctx2d.beginPath();
          const p0 = b.toPixelsPub(pts[0]);
          b.ctx2d.moveTo(p0.x, p0.y);
          for (let i = 1; i < pts.length; i++) {
            const pp = b.toPixelsPub(pts[i]);
            b.ctx2d.lineTo(pp.x, pp.y);
          }
          b.ctx2d.closePath();
          b.ctx2d.fillStyle = colorObj.opaque(fillOpacity).toString();
          b.ctx2d.fill();
        } else {
          renderer.draw(colorStr, lineWidth).fillGradientBelow(topPoints, bottomY!, colorObj, fillOpacity);
        }
      }

      // Top edge stroke
      const b = renderer.draw(colorStr, lineWidth);
      b.path(topPoints);
      b.stroke();
    }
  }
}

/** Parse a CSS color string like '#aabbcc' or 'rgb(r,g,b)' or 'rgba(r,g,b,a)'. */
function parseColorStr(str: string): [number, number, number, number] {
  const hex = str.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16), 1];
  }
  const rgb = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return [parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3]), 1];
  }
  return [100, 150, 255, 1];
}
