import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import { scaleLinear } from 'd3-scale';
import type { AxisOptions } from './chart-types';

export class Axis extends LTStyledElement<AxisOptions> {
  protected defaultOptions(): AxisOptions {
    return {
      xMin: -0.4,
      xMax: 0.4,
      yMin: -0.4,
      yMax: 0.4,
      tickCount: 5,
      showX: true,
      showY: true,
      tickSize: 0.008,
      arrowSize: 0.012,
      labelSize: 11,
    };
  }

  constructor(options?: Partial<AxisOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const {
      xMin, xMax, yMin, yMax,
      tickCount = 5,
      showX = true,
      showY = true,
      tickSize = 0.008,
      arrowSize = 0.012,
      labelSize = 11,
      xAxisY = 0,
      yAxisX = 0,
      showArrows = true,
    } = this.options;

    const { color } = this.computedStyles;
    const colorStr = color?.toString() ?? '#e0e0e0';

    const xTickValues: number[] = this.options.xTicks
      ?? scaleLinear().domain([xMin, xMax]).ticks(tickCount);
    const yTickValues: number[] = this.options.yTicks
      ?? scaleLinear().domain([yMin, yMax]).ticks(tickCount);

    if (showX) {
      // X axis line
      let b = renderer.draw(colorStr, 1);
      b.line(new V2(xMin, xAxisY), new V2(xMax, xAxisY));
      b.stroke();

      if (showArrows) {
        // Arrow tip at xMax (open chevron: two angled lines)
        b = renderer.draw(colorStr, 1);
        b.line(new V2(xMax, xAxisY), new V2(xMax - arrowSize, xAxisY + arrowSize * 0.6));
        b.stroke();
        b = renderer.draw(colorStr, 1);
        b.line(new V2(xMax, xAxisY), new V2(xMax - arrowSize, xAxisY - arrowSize * 0.6));
        b.stroke();
      }

      // X ticks + labels
      for (const t of xTickValues) {
        if (t === yAxisX) continue;
        b = renderer.draw(colorStr, 1);
        b.line(new V2(t, xAxisY - tickSize), new V2(t, xAxisY + tickSize));
        b.stroke();
        const tickPos = new V2(t, xAxisY);
        const opacity = renderer.labelRegistry.avoidanceOpacity(tickPos, 'axis-label-avoid', tickSize * 10, tickSize * 3);
        if (opacity > 0.01) {
          const c = color?.opaque(opacity).toString() ?? `rgba(0,0,0,${opacity})`;
          renderer.draw(c, 1).renderText(String(t), new V2(t, xAxisY - tickSize * 4), labelSize);
        }
      }
    }

    if (showY) {
      // Y axis line
      let b = renderer.draw(colorStr, 1);
      b.line(new V2(yAxisX, yMin), new V2(yAxisX, yMax));
      b.stroke();

      if (showArrows) {
        // Arrow tip at yMax
        b = renderer.draw(colorStr, 1);
        b.line(new V2(yAxisX, yMax), new V2(yAxisX + arrowSize * 0.6, yMax - arrowSize));
        b.stroke();
        b = renderer.draw(colorStr, 1);
        b.line(new V2(yAxisX, yMax), new V2(yAxisX - arrowSize * 0.6, yMax - arrowSize));
        b.stroke();
      }

      // Y ticks + labels
      for (const t of yTickValues) {
        if (t === xAxisY) continue;
        b = renderer.draw(colorStr, 1);
        b.line(new V2(yAxisX - tickSize, t), new V2(yAxisX + tickSize, t));
        b.stroke();
        const tickPos = new V2(yAxisX, t);
        const opacity = renderer.labelRegistry.avoidanceOpacity(tickPos, 'axis-label-avoid', tickSize * 10, tickSize * 3);
        if (opacity > 0.01) {
          const c = color?.opaque(opacity).toString() ?? `rgba(0,0,0,${opacity})`;
          renderer.draw(c, 1).renderText(String(t), new V2(yAxisX + tickSize * 2.5, t), labelSize);
        }
      }
    }

    // Zero label (only when axes are at origin)
    if ((showX || showY) && xAxisY === 0 && yAxisX === 0) {
      renderer.draw(colorStr, 1).renderText('0', new V2(-tickSize * 4, -tickSize * 4), labelSize);
    }
  }
}
