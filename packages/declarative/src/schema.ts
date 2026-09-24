/** Point styles apply to the outgoing interval, in logical pixels. */
export interface ChartPoint { x: number; y: number | null; width?: number; color?: string }
export interface ChartControls {
  zoom?: boolean;
  pan?: boolean;
  cursor?: boolean;
  tooltip?: boolean;
  /** X-domain units (milliseconds for time axes). */
  minWindow?: number;
  initialWindow?: number;
}
/** Independent Y scale placed within the plot: 0 = top, 1 = bottom.
 * Equal top/bottom values produce a constant-height strip while retaining data values. */
export interface ChartLane { min: number; max: number; top: number; bottom: number }
export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: ChartPoint[];
  stroke?: { width?: number; dash?: number[] };
  maxGapX?: number;
  interpolation?: 'linear' | 'step-after';
  lane?: ChartLane;
  unit?: string;
}
export interface ChartSpec {
  schemaVersion: 1;
  title: string;
  x: { type: 'time' | 'number'; min: number; max: number; label?: string; timeZone?: string; locale?: string };
  y: { min?: number; max?: number; label: string };
  series: ChartSeries[];
  controls?: false | ChartControls;
  rules?: Array<{ x: number; label: string; color?: string }>;
  regions?: Array<{ from: number; to: number; color: string; opacity?: number }>;
  theme?: { background?: string; foreground?: string; grid?: string };
}

export interface ChartLayout { width: number; height: number; pixelRatio: number; fontFamily?: string }
