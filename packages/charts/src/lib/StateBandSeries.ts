import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import type { StateBandSeriesOptions } from './chart-types';

export class StateBandSeries extends LTStyledElement<StateBandSeriesOptions> {
  protected defaultOptions(): StateBandSeriesOptions {
    return {
      xMin: 0,
      xMax: 1,
      y: 0,
      onSegments: [],
      offLineWidth: 1,
      onLineWidth: 6,
      offOpacity: 0.4,
    };
  }

  constructor(options?: Partial<StateBandSeriesOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const {
      xMin,
      xMax,
      y,
      onSegments,
      offLineWidth = 1,
      onLineWidth = 6,
      offOpacity = 0.4,
    } = this.options;

    if (xMax <= xMin) return;

    const { color } = this.computedStyles;
    const onColor = color ?? new Color(255, 124, 67);
    const offColor = onColor.opaque(offOpacity).toString();

    const base = renderer.draw(offColor, offLineWidth);
    base.path([new V2(xMin, y), new V2(xMax, y)]);
    base.stroke();

    for (const segment of onSegments) {
      const start = Math.max(xMin, Math.min(xMax, segment.x0));
      const end = Math.max(xMin, Math.min(xMax, segment.x1));
      if (end <= start) continue;

      const on = renderer.draw(onColor.toString(), onLineWidth);
      on.ctx2d.lineCap = 'round';
      on.path([new V2(start, y), new V2(end, y)]);
      on.stroke();
      on.ctx2d.lineCap = 'butt';
    }
  }
}
