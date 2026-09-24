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
    const { data, lineWidth = 1.5, fillOpacity = 0, yFillTo = 0, dashPattern = [], maxGapX = Infinity, interpolation = 'linear' } = this.options;
    if (data.length === 0) return;

    const { color } = this.computedStyles;
    const colorObj = color ?? new Color(74, 158, 255);
    const colorStr = colorObj.toString();

    // Per-sample styles describe outgoing intervals. Keep the ordinary path batched.
    if (data.some(p => p.width !== undefined || p.color !== undefined)) {
      const valid = (p: typeof data[number] | undefined) => p && p.y !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
      for (let i = 0; i < data.length; i++) {
        const a = data[i], b = data[i + 1], previous = data[i - 1];
        if (!valid(a)) continue;
        const style = a.color ?? colorStr, width = a.width ?? lineWidth;
        const batch = renderer.draw(style, width);
        batch.begin(style, width, { dashPattern });
        if (valid(b) && b.x - a.x <= maxGapX) {
          const points = [new V2(a.x, a.y!)];
          if (interpolation === 'step-after') points.push(new V2(b.x, a.y!));
          points.push(new V2(b.x, b.y!));
          batch.path(points);
          batch.stroke();
        } else if (!valid(previous) || a.x - previous.x > maxGapX) {
          batch.point(new V2(a.x, a.y!), Math.max(2.5, width * 1.4));
          batch.fill(Color.from(style));
        }
        batch.begin(style, width, { dashPattern: [] });
      }
      return;
    }

    let segment: V2[] = [];
    const drawSegment = () => {
      if (segment.length === 1) {
        const dot = renderer.draw(colorStr, lineWidth);
        dot.point(segment[0], Math.max(2.5, lineWidth * 1.4));
        dot.fill(colorObj);
      } else if (segment.length >= 2) {
        if (fillOpacity > 0) renderer.draw(colorStr, lineWidth).fillGradientBelow(segment, yFillTo, colorObj, fillOpacity);
        const b = renderer.draw(colorStr, lineWidth);
        b.begin(colorStr, lineWidth, { dashPattern });
        b.path(segment);
        b.stroke();
        b.begin(colorStr, lineWidth, { dashPattern: [] });
      }
      segment = [];
    };
    for (const sample of data) {
      if (sample.y === null || !Number.isFinite(sample.x) || !Number.isFinite(sample.y)) {
        drawSegment();
        continue;
      }
      if (segment.length && sample.x - segment[segment.length - 1].x > maxGapX) drawSegment();
      if (interpolation === 'step-after' && segment.length) segment.push(new V2(sample.x, segment[segment.length - 1].y));
      segment.push(new V2(sample.x, sample.y));
    }
    drawSegment();
  }
}
