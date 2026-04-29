import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import type { FunctionPlotOptions } from './chart-types';

export class FunctionPlot extends LTStyledElement<FunctionPlotOptions> {
  protected defaultOptions(): FunctionPlotOptions {
    return {
      fn: (x) => x,
      xMin: -0.4,
      xMax: 0.4,
      samples: 200,
      lineWidth: 1.5,
    };
  }

  constructor(options: Partial<FunctionPlotOptions> & Pick<FunctionPlotOptions, 'fn'>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const { fn, xMin, xMax, samples = 200, lineWidth = 1.5 } = this.options;
    const { color } = this.computedStyles;
    const colorStr = color?.toString() ?? '#4a9eff';

    // Sample fn across the domain, splitting at discontinuities (NaN / Infinity)
    const step = (xMax - xMin) / samples;
    let segment: V2[] = [];

    const flush = () => {
      if (segment.length >= 2) {
        const b = renderer.draw(colorStr, lineWidth);
        b.path(segment);
        b.stroke();
      }
      segment = [];
    };

    for (let i = 0; i <= samples; i++) {
      const x = xMin + i * step;
      const y = fn(x);
      if (!isFinite(y)) {
        flush();
      } else {
        segment.push(new V2(x, y));
      }
    }
    flush();
  }
}
