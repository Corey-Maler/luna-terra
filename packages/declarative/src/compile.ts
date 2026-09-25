import { CanvasRenderer, LTElement, ScreenContainer, themeColor } from '@lunaterra/core';
import { LineSeries } from '@lunaterra/charts';
import { Color } from '@lunaterra/color';
import { Line, RectElement, TextElement } from '@lunaterra/elements';
import { TimelineChartChrome, type TimelineChartState } from '@lunaterra/ui';
import { V2 } from '@lunaterra/math';
import type { ChartLayout, ChartSeries, ChartSpec } from './schema';
import { ChartValidationError, validateChartSpec } from './validate';

export interface ChartViewOptions {
  /** Enable chart controls. The specification selects individual controls. Defaults to true. */
  interactive?: boolean;
  /** Follow the engine canvas size. Defaults to false for explicit image layouts. */
  responsive?: boolean;
  onStateChange?: (state: TimelineChartState) => void;
}

class ClippedFrame extends ScreenContainer {
  override doRender(renderer: CanvasRenderer): void {
    const { x, y, w, h } = this.getScreenRect(renderer);
    renderer.ctx.save();
    try {
      renderer.ctx.beginPath();
      renderer.ctx.rect(x * renderer.hdpi, y * renderer.hdpi, w * renderer.hdpi, h * renderer.hdpi);
      renderer.ctx.clip();
      super.doRender(renderer);
    } finally { renderer.ctx.restore(); }
  }
}

function line(parent: LTElement, a: V2, b: V2, color: string | undefined, width = 1, dashPattern: number[] = [], opacity = 1): void {
  const element = new Line({ points: [a, b] }, { color: color ? Color.from(color) : themeColor('chart.widget.title'), lineWidth: width, dashPattern });
  element.styles.opacity = opacity;
  parent.appendChild(element);
}

function label(parent: LTElement, text: string, x: number, y: number, color?: string, fontSize = 12, align: CanvasTextAlign = 'left'): TextElement {
  const element = new TextElement({ text, fontSize, align, baseline: 'middle' });
  element.styles.color = color ? Color.from(color) : themeColor('chart.widget.title');
  element.position = new V2(x, y);
  parent.appendChild(element);
  return element;
}

function niceStep(span: number, target = 5): number {
  const rough = span / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map((factor) => factor * power).find((step) => step >= rough) ?? 10 * power;
}

/** Read a series without inventing values across missing readings or outside its domain. */
export function sampleSeries(series: ChartSeries, x: number): number | null {
  const data = series.data;
  let low = 0, high = data.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (data[mid].x < x) low = mid + 1;
    else high = mid;
  }
  if (data[low]?.x === x) return data[low].y;
  const a = data[low - 1], b = data[low];
  if (!a || !b || a.y === null || b.y === null || b.x - a.x > (series.maxGapX ?? Infinity)) return null;
  if (series.interpolation === 'step-after') return a.y;
  return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
}

/** Reusable scene: LineSeries + ScreenContainer + the shared timeline shell. */
export class ChartView extends ScreenContainer {
  public timeline?: TimelineChartChrome;
  private spec: ChartSpec;
  private layout: ChartLayout;

  constructor(spec: ChartSpec, layout: ChartLayout, private readonly viewOptions: ChartViewOptions = {}) {
    super({ offsetX: 0, offsetY: 0 });
    this.spec = validateChartSpec(spec);
    this.layout = layout;
    this.rebuild();
  }

  public setSpec(spec: ChartSpec): void {
    this.spec = validateChartSpec(spec);
    this.rebuild();
    this.engine?.requestUpdate();
  }

  public resize(width: number, height: number): void {
    if (width === this.layout.width && height === this.layout.height) return;
    this.layout = { ...this.layout, width, height };
    this.rebuild();
    this.engine?.requestUpdate();
  }

  override compute(renderer: CanvasRenderer): void {
    if (this.viewOptions.responsive) {
      const width = Math.max(320, Math.round(renderer.width / renderer.hdpi));
      const controls = this.spec.controls === false ? {} : this.spec.controls ?? {};
      const interactive = this.viewOptions.interactive !== false && this.spec.controls !== false;
      const rows = Math.max(1, Math.ceil(this.spec.series.length / Math.max(1, Math.floor((width - 64) / 180))));
      const minHeight = 172 + (interactive && controls.zoom !== false ? 54 : 0) + (interactive && controls.cursor !== false ? 20 : 0) + (rows - 1) * 22;
      this.resize(width, Math.max(280, minHeight, Math.round(renderer.height / renderer.hdpi)));
    }
  }

  override destroy(): void {
    this.timeline?.destroy();
    this.timeline = undefined;
  }

  private rebuild(): void {
    const { width, height, pixelRatio } = this.layout;
    if (![width, height, pixelRatio].every(Number.isFinite) || width <= 0 || height <= 0 || pixelRatio < 0.5 || pixelRatio > 4) {
      throw new ChartValidationError('output', 'expected positive logical dimensions and pixel ratio 0.5–4');
    }
    this.destroy();
    this.children = [];
    this.options = { ...this.options, width, height, worldBounds: { xMin: 0, xMax: width, yMin: height, yMax: 0 } };
    const spec = this.spec;
    const controls = spec.controls === false ? {} : spec.controls ?? {};
    const interactive = this.viewOptions.interactive !== false && spec.controls !== false;
    const showZoom = interactive && controls.zoom !== false;
    const showCursor = interactive && controls.cursor !== false;
    const enablePan = interactive && controls.pan !== false;
    const hasTimeline = showZoom || showCursor || enablePan;
    // Static status-panel images can be much smaller than an interactive chart.
    // Reserve every pixel for the plot and omit chrome that would not be legible.
    const compact = !interactive && (width < 320 || height < 240);
    const onlyLanes = spec.series.length > 0 && spec.series.every(series => series.lane);
    const columns = Math.max(1, Math.floor((width - 64) / 180));
    const rows = Math.max(1, Math.ceil(spec.series.length / columns));
    const sidePadding = compact ? Math.min(6, Math.floor(width / 4)) : onlyLanes ? 76 : 54;
    const plot = compact
      ? { x: sidePadding, y: Math.min(6, Math.floor(height / 4)), w: Math.max(1, width - sidePadding * 2), h: Math.max(1, height - Math.min(12, Math.floor(height / 2))) }
      : { x: sidePadding, y: showZoom ? 120 : 66, w: width - sidePadding * 2,
        h: height - 132 - (showZoom ? 54 : 0) - (showCursor ? 20 : 0) - (rows - 1) * 22 };
    if (!compact && plot.h < 40) throw new ChartValidationError('output', 'image is too short for the chart legend');
    if (spec.theme?.background) this.appendChild(new RectElement({ width, height, fillColor: spec.theme.background, stroke: false }));
    if (!compact) {
      const titleLimit = Math.floor((width - 48) / 10);
      label(this, spec.title.length > titleLimit ? `${spec.title.slice(0, titleLimit - 1)}…` : spec.title, 24, 24, spec.theme?.foreground, 17);
      label(this, spec.y.label, plot.x, plot.y - 16, spec.theme?.foreground, 11);
    }

    const values = spec.series.filter(s => !s.lane).flatMap((s) => s.data.filter((p) => p.x >= spec.x.min && p.x <= spec.x.max && p.y !== null).map((p) => p.y as number));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const padding = Math.max((max - min) * 0.15, 1);
    const yMin = spec.y.min ?? min - padding, yMax = spec.y.max ?? max + padding;
    if (yMin >= yMax) throw new ChartValidationError('chart.y', 'resolved min must be below max');
    const y = (value: number) => (yMax - value) / (yMax - yMin);
    const frame = new ClippedFrame({ offsetX: plot.x, offsetY: plot.y, width: plot.w, height: plot.h, worldBounds: { xMin: spec.x.min, xMax: spec.x.max, yMin: 1, yMax: 0 } });
    this.appendChild(frame);
    for (const region of spec.regions ?? []) {
      const rect = new RectElement({ width: region.to - region.from, height: 1, fillColor: Color.from(region.color).withAlpha(region.opacity ?? 1).toString(), stroke: false });
      rect.position = new V2(region.from, 0);
      frame.appendChild(rect);
    }
    const step = niceStep(yMax - yMin, Math.max(2, Math.floor(plot.h / 48)));
    for (let tick = Math.ceil(yMin / step) * step; !onlyLanes && tick <= yMax; tick += step) {
      line(frame, new V2(spec.x.min, y(tick)), new V2(spec.x.max, y(tick)), spec.theme?.grid, 1, [], 0.16);
      if (!compact) label(this, Number(tick.toFixed(5)).toString(), plot.x - 10, plot.y + y(tick) * plot.h, spec.theme?.foreground, 11, 'right');
    }
    for (const series of spec.series) {
      const lane = series.lane;
      const mapY = lane ? (value: number) => lane.bottom - (Math.max(lane.min, Math.min(lane.max, value)) - lane.min) / (lane.max - lane.min) * (lane.bottom - lane.top) : y;
      if (lane && onlyLanes && !compact) {
        label(this, series.label, plot.x - 10, plot.y + (lane.top + lane.bottom) / 2 * plot.h, series.color, 11, 'right');
        line(frame, new V2(spec.x.min, lane.bottom), new V2(spec.x.max, lane.bottom), spec.theme?.grid, 1, [], 0.16);
      }
      const element = new LineSeries({ data: series.data.map((p) => ({ ...p, y: p.y === null ? null : mapY(p.y) })), interpolation: series.interpolation, lineWidth: series.stroke?.width ?? 2, dashPattern: series.stroke?.dash ?? [], maxGapX: series.maxGapX });
      element.styles.color = Color.from(series.color);
      frame.appendChild(element);
    }
    for (const rule of spec.rules ?? []) {
      line(frame, new V2(rule.x, 0), new V2(rule.x, 1), rule.color, 1, [3, 5], 0.7);
    }
    const ruleLabels = compact ? [] : (spec.rules ?? []).map((rule) => label(this, rule.label, 0, plot.y + 10, rule.color, 10));
    const formatter = spec.x.type === 'time' ? new Intl.DateTimeFormat(spec.x.locale ?? 'en-GB', { timeZone: spec.x.timeZone ?? 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
    const formatX = (x: number) => formatter ? formatter.format(new Date(x)) : `${Number(x.toPrecision(5))}${spec.x.label ? ` ${spec.x.label}` : ''}`;
    const formatTick = (x: number) => spec.x.type === 'time' ? new Intl.DateTimeFormat(spec.x.locale ?? 'en-GB', { timeZone: spec.x.timeZone ?? 'UTC', day: 'numeric', month: 'short', hour: '2-digit', hourCycle: 'h23' }).format(new Date(x)) : formatX(x);
    const syncRules = (windowMin: number, windowMax: number) => ruleLabels.forEach((element, i) => {
      const x = spec.rules![i].x;
      element.visibility = x >= windowMin && x <= windowMax;
      element.position.x = Math.max(plot.x + 4, Math.min(plot.x + plot.w - 105, plot.x + (x - windowMin) / (windowMax - windowMin) * plot.w + 8));
    });
    syncRules(spec.x.min, spec.x.max);
    if (!compact) {
      spec.series.forEach((series, i) => {
        const xx = 24 + (i % columns) * ((width - 48) / columns);
        const yy = height - (showCursor ? 76 : 26) - (rows - 1 - Math.floor(i / columns)) * 22;
        line(this, new V2(xx, yy), new V2(xx + 24, yy), series.color, 2, series.stroke?.dash);
        label(this, series.label.length > 20 ? `${series.label.slice(0, 19)}…` : series.label, xx + 32, yy, spec.theme?.foreground, 11);
      });
      if (!spec.series.some(s => s.data.some(p => p.y !== null && p.x >= spec.x.min && p.x <= spec.x.max))) label(this, 'No readings available', plot.x + plot.w / 2, plot.y + plot.h / 2, spec.theme?.foreground, 14, 'center');
    }
    const span = spec.x.max - spec.x.min;
    const axisLabels: TextElement[] = [];
    const syncAxis = (min: number, max: number) => axisLabels.forEach((element, i) => {
      element.options.text = formatTick(min + (max - min) * i / (axisLabels.length - 1));
    });
    if (!showCursor && !compact) {
      const count = Math.max(2, Math.floor(plot.w / 140));
      for (let i = 0; i <= count; i++) axisLabels.push(label(this, formatTick(spec.x.min + span * i / count), plot.x + plot.w * i / count, plot.y + plot.h + 22, spec.theme?.foreground, 10, i === 0 ? 'left' : i === count ? 'right' : 'center'));
    }
    if (hasTimeline) {
      const minWindow = controls.minWindow ?? Math.min(controls.initialWindow ?? span, span / 12);
      const sizeAt = (value: number) => minWindow * (span / minWindow) ** value;
      this.timeline = new TimelineChartChrome({
        chartFrame: frame, domainMin: spec.x.min, domainMax: spec.x.max,
        scaleTicks: [{ value: 0, label: 'Detail' }, { value: 0.5, label: 'Overview' }, { value: 1, label: 'Full range' }],
        showZoom, showCursor, enablePan,
        initialScaleValue: span === minWindow ? 1 : Math.log((controls.initialWindow ?? span) / minWindow) / Math.log(span / minWindow), initialCursorValue: spec.rules?.[0]?.x ?? spec.x.min + span / 2,
        minWindowSize: minWindow, maxWindowSize: span,
        scaleValueToWindowSize: sizeAt,
        windowSizeToScaleValue: (size) => span === minWindow ? 1 : Math.log(size / minWindow) / Math.log(span / minWindow),
        windowTickStepCandidates: spec.x.type === 'time'
          ? [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 2592000, 31536000].map(seconds => seconds * 1000)
          : Array.from({ length: 24 }, (_, i) => [1, 2, 5][i % 3] * 10 ** (Math.floor(Math.log10(minWindow / 6)) + Math.floor(i / 3))),
        maxWindowTickCount: Math.max(2, Math.floor(plot.w / 110)),
        formatScaleValue: (_, size) => spec.x.type === 'time' ? `${(size / 3_600_000).toFixed(1)}h` : `${Number(size.toPrecision(3))}`,
        formatWindowTick: formatTick, formatCursorValue: formatX,
        edgeOffset: 48, sidePadding,
        crosshair: showCursor ? { yMin: 0, yMax: 1, showXLabel: false, opacity: 0.35 } : undefined,
        tooltip: showCursor && controls.tooltip !== false ? {
          widthPx: Math.min(220, plot.w - 8), paddingTopPx: 9, lineGapPx: 17,
          title: { format: formatX, fontSize: 11 },
          getRows: (cursor) => spec.series.map((series) => {
            const value = sampleSeries(series, cursor);
            return { text: `${series.label}: ${value === null ? '—' : Number(value.toFixed(2))}${series.unit ? ` ${series.unit}` : ''}`, fontSize: 11 };
          }),
          getPanelY: () => 0.12,
        } : undefined,
        onStateChange: (state) => { syncRules(state.windowMin, state.windowMax); syncAxis(state.windowMin, state.windowMax); this.viewOptions.onStateChange?.(state); },
      });
      this.appendChild(this.timeline);
    }
    if (this.engine) for (const child of this.children ?? []) child.setup(this.engine);
  }
}

export function compileChart(spec: ChartSpec, layout: ChartLayout, options: ChartViewOptions = {}): ChartView {
  return new ChartView(spec, layout, options);
}
