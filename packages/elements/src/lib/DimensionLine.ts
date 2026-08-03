import { Rect2D, V2 } from '@lunaterra/math';
import {
  LTStyledElement,
  type CanvasRenderer,
  type LTStyles,
} from '@lunaterra/core';
import { renderMarker } from './markers';

export interface DimensionLineOptions {
  /** Endpoints of the measured distance in local coordinates. */
  start: V2;
  end: V2;
  /** Text shown beside the dimension line. */
  label: string;
  /** Perpendicular distance from the measured points to the dimension line. */
  offset: number;
  /** Distance that extension lines project beyond the dimension line. */
  extensionOvershoot: number;
  /** Open-arrow size in world units. */
  arrowSize: number;
  /** Gap between the dimension line and its label in world units. */
  labelGap: number;
  /** Moves the label along the measured axis; useful for very small gaps. */
  labelAlongOffset: number;
  /** Label size in CSS pixels. */
  fontSize: number;
}

export interface DimensionLineExtraStyles {
  lineWidth: number;
  extensionLineWidth: number;
}

/**
 * Conventional engineering dimension with extension lines, outward-facing
 * open arrows, and a screen-readable label. Works at any line angle.
 */
export class DimensionLine extends LTStyledElement<
  DimensionLineOptions,
  DimensionLineExtraStyles
> {
  protected override defaultOptions(): DimensionLineOptions {
    return {
      start: new V2(0, 0),
      end: new V2(0, 1),
      label: '',
      offset: 0,
      extensionOvershoot: 0.12,
      arrowSize: 0.18,
      labelGap: 0.16,
      labelAlongOffset: 0,
      fontSize: 11,
    };
  }

  constructor(
    options?: Partial<DimensionLineOptions>,
    styles?: Partial<LTStyles & DimensionLineExtraStyles>,
  ) {
    super(options, {
      opacity: 1,
      color: null,
      lineWidth: 1.25,
      extensionLineWidth: 1,
      ...styles,
    });
  }

  override getBounds(): Rect2D {
    const geometry = this.geometry();
    if (!geometry) {
      return new Rect2D(this.options.start, this.options.start);
    }

    const points = [
      this.options.start,
      this.options.end,
      geometry.dimensionStart,
      geometry.dimensionEnd,
      geometry.extensionStartEnd,
      geometry.extensionEndEnd,
      geometry.labelPosition,
    ];
    return new Rect2D(
      new V2(
        Math.min(...points.map((point) => point.x)),
        Math.min(...points.map((point) => point.y)),
      ),
      new V2(
        Math.max(...points.map((point) => point.x)),
        Math.max(...points.map((point) => point.y)),
      ),
    );
  }

  override render(renderer: CanvasRenderer): void {
    const geometry = this.geometry();
    if (!geometry) return;

    const { color, opacity } = this.computedStyles;
    const colorString = color.opaque(opacity).toString();

    const extensionBatch = renderer.draw(
      colorString,
      this.styles.extensionLineWidth,
    );
    extensionBatch.line(this.options.start, geometry.extensionStartEnd);
    extensionBatch.stroke();
    extensionBatch.begin(colorString, this.styles.extensionLineWidth);
    extensionBatch.line(this.options.end, geometry.extensionEndEnd);
    extensionBatch.stroke();

    const dimensionBatch = renderer.draw(colorString, this.styles.lineWidth);
    dimensionBatch.line(geometry.dimensionStart, geometry.dimensionEnd);
    dimensionBatch.stroke();
    renderMarker(
      dimensionBatch,
      geometry.dimensionStart,
      geometry.unit.scale(-1),
      {
        shape: 'arrow',
        size: this.options.arrowSize,
        filled: false,
      },
      colorString,
    );
    renderMarker(
      dimensionBatch,
      geometry.dimensionEnd,
      geometry.unit,
      {
        shape: 'arrow',
        size: this.options.arrowSize,
        filled: false,
      },
      colorString,
    );

    if (this.options.label) {
      const labelBatch = renderer.draw(colorString, 1);
      labelBatch.renderText(
        this.options.label,
        geometry.labelPosition,
        this.options.fontSize,
        geometry.labelAlign,
        geometry.labelBaseline,
      );
    }
  }

  private geometry() {
    const {
      start,
      end,
      offset,
      extensionOvershoot,
      labelGap,
      labelAlongOffset,
    } = this.options;
    const delta = end.sub(start);
    const length = delta.length();
    if (length < 1e-9) return null;

    const unit = delta.scale(1 / length);
    const normal = new V2(-unit.y, unit.x);
    const offsetVector = normal.scale(offset);
    const offsetDirection =
      Math.abs(offset) > 1e-9
        ? normal.scale(Math.sign(offset))
        : normal;
    const dimensionStart = start.add(offsetVector);
    const dimensionEnd = end.add(offsetVector);
    const overshootVector = offsetDirection.scale(extensionOvershoot);
    const labelPosition = V2.average(dimensionStart, dimensionEnd)
      .add(offsetDirection.scale(labelGap))
      .add(unit.scale(labelAlongOffset));

    const labelAlign: CanvasTextAlign =
      offsetDirection.x > 0.1
        ? 'left'
        : offsetDirection.x < -0.1
          ? 'right'
          : 'center';
    const labelBaseline: CanvasTextBaseline =
      offsetDirection.y > 0.1
        ? 'bottom'
        : offsetDirection.y < -0.1
          ? 'top'
          : 'middle';

    return {
      unit,
      dimensionStart,
      dimensionEnd,
      extensionStartEnd: dimensionStart.add(overshootVector),
      extensionEndEnd: dimensionEnd.add(overshootVector),
      labelPosition,
      labelAlign,
      labelBaseline,
    };
  }
}
