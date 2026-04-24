import type { Color } from '@lunaterra/color';

export interface AxisOptions {
  /** World-space X domain start */
  xMin: number;
  /** World-space X domain end */
  xMax: number;
  /** World-space Y domain start */
  yMin: number;
  /** World-space Y domain end */
  yMax: number;
  /** Custom X tick positions (overrides tickCount) */
  xTicks?: number[];
  /** Custom Y tick positions (overrides tickCount) */
  yTicks?: number[];
  /** Approximate number of auto-generated ticks per axis (default: 5) */
  tickCount?: number;
  /** Draw the X axis (default: true) */
  showX?: boolean;
  /** Draw the Y axis (default: true) */
  showY?: boolean;
  /** Half-length of tick marks in world units (default: 0.015) */
  tickSize?: number;
  /** Length of arrow tip lines in world units (default: 0.025) */
  arrowSize?: number;
  /** Font size for tick labels in screen pixels (default: 11) */
  labelSize?: number;
  /** Color for axis lines and ticks (default: inherits from style) */
  color?: Color;
  /** Y world position of the X axis line (default: 0) */
  xAxisY?: number;
  /** X world position of the Y axis line (default: 0) */
  yAxisX?: number;
  /** Whether to draw arrowheads on axis lines (default: true) */
  showArrows?: boolean;
}

export interface FunctionPlotOptions {
  /** Function to plot — maps x → y in world coords */
  fn: (x: number) => number;
  /** World-space X domain start */
  xMin: number;
  /** World-space X domain end */
  xMax: number;
  /** Number of sample points (default: 200) */
  samples?: number;
  /** Stroke width in screen pixels (default: 1.5) */
  lineWidth?: number;
}

export interface LineSeriesOptions {
  /** Data points in world coords */
  data: Array<{ x: number; y: number }>;
  /** Stroke width in screen pixels (default: 1.5) */
  lineWidth?: number;
  /** Opacity of gradient fill below the line (0 = none, default: 0) */
  fillOpacity?: number;
  /** Y world value to fill down to (default: 0) */
  yFillTo?: number;
}

export interface StackedAreaLayer {
  /** Per-frame data for this layer (x = time index, y = value for this layer only). */
  data: Array<{ x: number; y: number }>;
  /** CSS color string for this layer (stroke + fill). */
  color: string;
}

export interface StackedAreaSeriesOptions {
  /** Ordered layers, bottom → top. Each layer's y values are its own contribution. */
  layers: StackedAreaLayer[];
  /** Y baseline (default: 0). */
  yBase?: number;
  /** Stroke width in screen pixels (default: 1). */
  lineWidth?: number;
  /** Fill opacity per layer (default: 0.75). */
  fillOpacity?: number;
}

export interface CrosshairOptions {
  /** World-space X domain start — crosshair only shows inside this range */
  xMin: number;
  /** World-space X domain end */
  xMax: number;
  /** World-space Y domain start — vertical line drawn from here */
  yMin: number;
  /** World-space Y domain end — vertical line drawn to here */
  yMax: number;
  /** Font size for the X value label in screen pixels (default: 11) */
  labelSize?: number;
  /** Stroke width in screen pixels (default: 1) */
  lineWidth?: number;
  /**
   * Functions to snap to — a filled dot is drawn at (mouseX, fn(mouseX)) for each entry.
   * Skipped when fn returns NaN or ±Infinity.
   */
  fns?: Array<(x: number) => number>;
  /**
   * Data series to snap to — a dot is drawn at the linearly interpolated Y value.
   * Each array must be sorted by x ascending.
   */
  series?: Array<Array<{ x: number; y: number }>>;
}
