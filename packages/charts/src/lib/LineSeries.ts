import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import type { LineSeriesOptions } from './chart-types';

export class LineSeries extends LTStyledElement<LineSeriesOptions> {
  protected defaultOptions(): LineSeriesOptions {
    return {
      data: [],
      lineWidth: 1.5,
    };
  }

  constructor(options?: Partial<LineSeriesOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const { data, lineWidth = 1.5, fillOpacity = 0, yFillTo = 0 } = this.options;
    if (data.length < 2) return;

    const { color } = this.computedStyles;
    const colorObj = color ?? new Color(74, 158, 255);
    const colorStr = colorObj.toString();

    const points = data.map((d) => new V2(d.x, d.y));

    if (fillOpacity > 0) {
      renderer.draw(colorStr, lineWidth).fillGradientBelow(points, yFillTo, colorObj, fillOpacity);
    }

    const b = renderer.draw(colorStr, lineWidth);
    b.path(points);
    b.stroke();
  }
}

