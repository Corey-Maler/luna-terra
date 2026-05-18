import { useCallback } from 'react';
import { V2 } from '@lunaterra/math';
import {
  LunaTerraEngine,
  LTElement,
  LTStyledElement,
  ScreenContainer,
  resolveThemeColor,
  themeColor,
  type CanvasRenderer,
} from '@lunaterra/core';
import { RectElement, TextElement } from '@lunaterra/elements';
import { TimelineChartChrome } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

class GroupElement extends LTElement<object> {
  protected defaultOptions() { return {}; }
}

type SignalLevel = 0 | 1;

interface DigitalSegment {
  x0: number;
  x1: number;
  level: SignalLevel;
}

interface ScopeSignal {
  name: string;
  colorPath: string;
  segments: DigitalSegment[];
}

interface DigitalSignalSeriesOptions {
  xMin: number;
  xMax: number;
  yLow: number;
  yHigh: number;
  segments: DigitalSegment[];
  lineWidth?: number;
}

const ZOOM_TICKS = [
  { value: 0, label: 'Edges' },
  { value: 1, label: 'Bursts' },
  { value: 2, label: 'Frame' },
] as const;

const MIN_WINDOW_NS = 40;
const MID_WINDOW_NS = 160;
const MAX_WINDOW_NS = 640;
const TOTAL_TIME_NS = 640;
const WINDOW_TICK_STEP_CANDIDATES = [5, 10, 20, 40, 80, 160] as const;

const CHART_WIDTH = 500;
const CHART_HEIGHT = 182;
const CHART_OFFSET_X = 24;
const CHART_OFFSET_Y = 58;

const LABEL_GUTTER_PX = 58;
const CURSOR_PANEL_W_PX = 142;
const CURSOR_PANEL_H_PX = 76;
const CURSOR_PANEL_PAD_X_PX = 6;
const CURSOR_PANEL_PAD_Y_PX = 8;
const CURSOR_PANEL_LINE_GAP_PX = 10;
const CURSOR_ANCHOR_PX = 10;

class DigitalSignalSeries extends LTStyledElement<DigitalSignalSeriesOptions> {
  protected defaultOptions(): DigitalSignalSeriesOptions {
    return {
      xMin: 0,
      xMax: 1,
      yLow: 0.3,
      yHigh: 0.7,
      segments: [],
      lineWidth: 2,
    };
  }

  constructor(options?: Partial<DigitalSignalSeriesOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const { xMin, xMax, yLow, yHigh, segments, lineWidth = 2 } = this.options;
    if (segments.length === 0 || xMax <= xMin) return;

    const { color } = this.computedStyles;
    const stroke = color?.toString() ?? 'rgba(255,255,255,0.8)';
    const path = renderer.draw(stroke, lineWidth);
    path.begin(stroke, lineWidth);

    let started = false;
    let previousY = yForLevel(sampleLevelAt(segments, xMin), yLow, yHigh);

    for (const segment of segments) {
      if (segment.x1 <= xMin || segment.x0 >= xMax) continue;

      const start = Math.max(xMin, segment.x0);
      const end = Math.min(xMax, segment.x1);
      const y = yForLevel(segment.level, yLow, yHigh);

      if (!started) {
        path.ctx2d.moveTo(path.toPixelsPub(new V2(start, y)).x, path.toPixelsPub(new V2(start, y)).y);
        started = true;
      } else if (Math.abs(previousY - y) > 1e-6) {
        path.path([new V2(start, previousY), new V2(start, y)]);
      }

      path.path([new V2(start, y), new V2(end, y)]);
      previousY = y;
    }

    path.stroke();
  }
}

function yForLevel(level: SignalLevel, yLow: number, yHigh: number): number {
  return level === 1 ? yHigh : yLow;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function lerpLog(minValue: number, maxValue: number, t: number): number {
  return Math.exp(Math.log(minValue) + (Math.log(maxValue) - Math.log(minValue)) * t);
}

function invLerpLog(minValue: number, maxValue: number, value: number): number {
  return (Math.log(value) - Math.log(minValue)) / (Math.log(maxValue) - Math.log(minValue));
}

function scaleValueToWindowNs(scaleValue: number): number {
  if (scaleValue <= 1) {
    return lerpLog(MIN_WINDOW_NS, MID_WINDOW_NS, clamp(scaleValue, 0, 1));
  }
  return lerpLog(MID_WINDOW_NS, MAX_WINDOW_NS, clamp(scaleValue - 1, 0, 1));
}

function windowNsToScaleValue(windowNs: number): number {
  const clampedWindow = clamp(windowNs, MIN_WINDOW_NS, MAX_WINDOW_NS);
  if (clampedWindow <= MID_WINDOW_NS) {
    return invLerpLog(MIN_WINDOW_NS, MID_WINDOW_NS, clampedWindow);
  }
  return 1 + invLerpLog(MID_WINDOW_NS, MAX_WINDOW_NS, clampedWindow);
}

function formatScopeWindow(windowNs: number): string {
  return `${Math.round(windowNs)} ns`;
}

function formatScopeTick(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} us`;
  return `${Math.round(value)} ns`;
}

function formatCursorTime(value: number): string {
  return `t = ${formatScopeTick(value)}`;
}

function createSignalSegments(
  initialLevel: SignalLevel,
  transitions: Array<{ x: number; level: SignalLevel }>,
): DigitalSegment[] {
  const segments: DigitalSegment[] = [];
  let currentLevel = initialLevel;
  let start = 0;

  for (const transition of transitions) {
    if (transition.x > start) {
      segments.push({ x0: start, x1: transition.x, level: currentLevel });
    }
    currentLevel = transition.level;
    start = transition.x;
  }

  if (start < TOTAL_TIME_NS) {
    segments.push({ x0: start, x1: TOTAL_TIME_NS, level: currentLevel });
  }

  return segments;
}

function createClockSegments(periodNs: number): DigitalSegment[] {
  const halfPeriod = periodNs / 2;
  const segments: DigitalSegment[] = [];

  for (let start = 0; start < TOTAL_TIME_NS; start += halfPeriod) {
    const index = Math.floor(start / halfPeriod);
    segments.push({
      x0: start,
      x1: Math.min(TOTAL_TIME_NS, start + halfPeriod),
      level: index % 2 === 0 ? 0 : 1,
    });
  }

  return segments;
}

function sampleLevelAt(segments: DigitalSegment[], timeNs: number): SignalLevel {
  for (const segment of segments) {
    if (timeNs >= segment.x0 && timeNs < segment.x1) return segment.level;
  }
  return segments[segments.length - 1]?.level ?? 0;
}

const SCOPE_SIGNALS: ScopeSignal[] = [
  { name: 'clk', colorPath: 'chart.widget.title', segments: createClockSegments(20) },
  { name: 'reset_n', colorPath: 'chart.series.secondary', segments: createSignalSegments(0, [{ x: 40, level: 1 }]) },
  {
    name: 'req',
    colorPath: 'chart.series.primary',
    segments: createSignalSegments(0, [
      { x: 92, level: 1 },
      { x: 156, level: 0 },
      { x: 244, level: 1 },
      { x: 320, level: 0 },
      { x: 416, level: 1 },
      { x: 476, level: 0 },
    ]),
  },
  {
    name: 'grant',
    colorPath: 'chart.series.secondary',
    segments: createSignalSegments(0, [
      { x: 116, level: 1 },
      { x: 156, level: 0 },
      { x: 276, level: 1 },
      { x: 320, level: 0 },
      { x: 442, level: 1 },
      { x: 476, level: 0 },
    ]),
  },
  {
    name: 'valid',
    colorPath: 'chart.series.primary',
    segments: createSignalSegments(0, [
      { x: 136, level: 1 },
      { x: 196, level: 0 },
      { x: 294, level: 1 },
      { x: 356, level: 0 },
      { x: 454, level: 1 },
      { x: 526, level: 0 },
    ]),
  },
  {
    name: 'stall',
    colorPath: 'chart.widget.title',
    segments: createSignalSegments(0, [
      { x: 170, level: 1 },
      { x: 184, level: 0 },
      { x: 482, level: 1 },
      { x: 504, level: 0 },
    ]),
  },
];

const SIGNAL_SCOPE_SOURCE = `const timelineChrome = new TimelineChartChrome({
  chartFrame,
  scaleTicks: [...ZOOM_TICKS],
  initialScaleValue: scaleValue,
  initialVisibleCenter: visibleCenter,
  initialCursorValue: cursorTime,
  domainMin: 0,
  domainMax: TOTAL_TIME_NS,
  minWindowSize: MIN_WINDOW_NS,
  maxWindowSize: MAX_WINDOW_NS,
  scaleValueToWindowSize: scaleValueToWindowNs,
  windowSizeToScaleValue: windowNsToScaleValue,
  windowTickStepCandidates: WINDOW_TICK_STEP_CANDIDATES,
  formatScaleValue: (value) => formatScopeWindow(scaleValueToWindowNs(value)),
  formatWindowTick: (value) => formatScopeTick(value),
  formatCursorValue: formatCursorTime,
  crosshair: {
    yMin: 0.04,
    yMax: 0.92,
    showXLabel: false,
  },
  tooltip: {
    widthPx: 142,
    heightPx: 76,
    anchorOffsetPx: 10,
    paddingXPx: 6,
    paddingTopPx: 8,
    lineGapPx: 10,
    title: { format: formatCursorTime },
    getRows: (timeNs) => SCOPE_SIGNALS.map((signal) => ({
      text: signal.name + '  ' + sampleLevelAt(signal.segments, timeNs),
      fontSize: 7,
      opacity: 0.82,
    })),
    getPanelY: () => 0.06,
  },
});`;

export default function SignalScopePage() {
  const buildScene = useCallback((engine: LunaTerraEngine): LTElement => {
    const group = new GroupElement();
    let scaleValue = 1.35;
    let windowNs = scaleValueToWindowNs(scaleValue);
    let visibleCenter = TOTAL_TIME_NS - windowNs / 2;
    let cursorTime = visibleCenter;

    const title = new TextElement({ text: 'digital scope', fontSize: 10, align: 'left', baseline: 'top' });
    title.position = new V2(0, 0.98);
    title.styles.color = themeColor('chart.widget.title');
    group.appendChild(title);

    const subtitle = new TextElement({ text: 'clk / req / grant / valid / stall', fontSize: 8, align: 'left', baseline: 'top' });
    subtitle.position = new V2(0.38, 0.98);
    subtitle.styles.color = themeColor('chart.widget.title');
    subtitle.styles.opacity = 0.72;
    group.appendChild(subtitle);

    const chartFrame = new ScreenContainer({
      anchor: 'top-left',
      offsetX: CHART_OFFSET_X,
      offsetY: CHART_OFFSET_Y,
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      worldBounds: {
        xMin: visibleCenter - windowNs / 2,
        xMax: visibleCenter + windowNs / 2,
        yMin: 0,
        yMax: 1,
      },
    });
    group.appendChild(chartFrame);

    const resolvePanelFill = () => {
      const base = resolveThemeColor(themeColor('ui.zoomControls.panelBg'), engine.renderer.theme);
      return base?.opaque(0.94).toString() ?? 'rgba(36, 36, 36, 0.94)';
    };

    const labelMask = new RectElement({
      width: (windowNs / CHART_WIDTH) * LABEL_GUTTER_PX,
      height: 1,
      cornerRadius: 0,
      fillColor: resolvePanelFill(),
      stroke: false,
    });
    labelMask.position = new V2(visibleCenter - windowNs / 2, 0);
    chartFrame.appendChild(labelMask);

    const laneLabelElements: TextElement[] = [];
    const digitalSeriesElements: DigitalSignalSeries[] = [];

    const laneTop = 0.86;
    const laneStep = 0.145;
    const laneAmplitude = 0.032;

    for (let index = 0; index < SCOPE_SIGNALS.length; index++) {
      const signal = SCOPE_SIGNALS[index];
      const laneCenter = laneTop - index * laneStep;
      const series = new DigitalSignalSeries({
        xMin: visibleCenter - windowNs / 2,
        xMax: visibleCenter + windowNs / 2,
        yLow: laneCenter + laneAmplitude,
        yHigh: laneCenter - laneAmplitude,
        segments: signal.segments,
        lineWidth: signal.name === 'clk' ? 1.6 : 2.2,
      });
      series.styles.color = themeColor(signal.colorPath);
      chartFrame.appendChild(series);
      digitalSeriesElements.push(series);

      const label = new TextElement({ text: signal.name, fontSize: 8, align: 'left', baseline: 'middle' });
      label.styles.color = themeColor('chart.widget.title');
      label.styles.opacity = 0.84;
      label.position = new V2(visibleCenter - windowNs / 2, laneCenter);
      chartFrame.appendChild(label);
      laneLabelElements.push(label);
    }

    const clampCenter = (timeNs: number, nextWindowNs = windowNs) => clamp(
      timeNs,
      nextWindowNs / 2,
      TOTAL_TIME_NS - nextWindowNs / 2,
    );

    const clampCursorToWindow = (timeNs: number) => {
      const xMin = visibleCenter - windowNs / 2;
      const xMax = visibleCenter + windowNs / 2;
      return clamp(timeNs, xMin, xMax);
    };

    const getTooltipRows = (timeNs: number) => {
      return SCOPE_SIGNALS.map((signal) => ({
        text: `${signal.name}  ${sampleLevelAt(signal.segments, timeNs)}`,
        colorPath: 'chart.widget.title',
        opacity: 0.82,
        fontSize: 7,
      }));
    };

    const updateVisibleWindow = (timeNs: number) => {
      visibleCenter = clampCenter(timeNs);
      chartFrame.options.worldBounds = {
        xMin: visibleCenter - windowNs / 2,
        xMax: visibleCenter + windowNs / 2,
        yMin: 0,
        yMax: 1,
      };

      cursorTime = clampCursorToWindow(cursorTime);
      const worldPerPxX = windowNs / CHART_WIDTH;
      labelMask.options = {
        ...labelMask.options,
        width: worldPerPxX * LABEL_GUTTER_PX,
        fillColor: resolvePanelFill(),
      };
      labelMask.position = new V2(visibleCenter - windowNs / 2, 0);

      for (let index = 0; index < digitalSeriesElements.length; index++) {
        digitalSeriesElements[index].options = {
          ...digitalSeriesElements[index].options,
          xMin: visibleCenter - windowNs / 2,
          xMax: visibleCenter + windowNs / 2,
        };
        laneLabelElements[index].position = new V2(
          visibleCenter - windowNs / 2 + worldPerPxX * 6,
          laneTop - index * laneStep,
        );
      }
      engine.requestUpdate();
    };

    const timelineChrome = new TimelineChartChrome({
      chartFrame,
      scaleTicks: [...ZOOM_TICKS],
      initialScaleValue: scaleValue,
      initialVisibleCenter: visibleCenter,
      initialCursorValue: cursorTime,
      domainMin: 0,
      domainMax: TOTAL_TIME_NS,
      minWindowSize: MIN_WINDOW_NS,
      maxWindowSize: MAX_WINDOW_NS,
      scaleValueToWindowSize: scaleValueToWindowNs,
      windowSizeToScaleValue: windowNsToScaleValue,
      windowTickStepCandidates: WINDOW_TICK_STEP_CANDIDATES,
      formatScaleValue: (value) => formatScopeWindow(scaleValueToWindowNs(value)),
      formatWindowTick: (value) => formatScopeTick(value),
      formatCursorValue: formatCursorTime,
      sidePadding: CHART_OFFSET_X,
      crosshair: {
        yMin: 0.04,
        yMax: 0.92,
        showXLabel: false,
        formatXLabel: formatCursorTime,
        colorPath: 'chart.widget.title',
        opacity: 0.54,
      },
      tooltip: {
        widthPx: CURSOR_PANEL_W_PX,
        heightPx: CURSOR_PANEL_H_PX,
        anchorOffsetPx: CURSOR_ANCHOR_PX,
        paddingXPx: CURSOR_PANEL_PAD_X_PX,
        paddingTopPx: CURSOR_PANEL_PAD_Y_PX,
        lineGapPx: CURSOR_PANEL_LINE_GAP_PX,
        backgroundOpacity: 0.94,
        title: {
          format: formatCursorTime,
          fontSize: 8,
          colorPath: 'chart.widget.title',
          opacity: 1,
        },
        getRows: (timeNs) => getTooltipRows(timeNs),
        getPanelY: () => 0.06,
      },
      onStateChange: (state) => {
        scaleValue = state.scaleValue;
        windowNs = state.windowSize;
        visibleCenter = state.visibleCenter;
        cursorTime = state.cursorValue;
        updateVisibleWindow(visibleCenter);
      },
    });
    group.appendChild(timelineChrome);

    engine.interactive = false;
    engine.add(group);
    updateVisibleWindow(visibleCenter);
    return group;
  }, []);

  return (
    <DocPage title="Charts/Signal Scope" section="@lunaterra/charts">
      <DocPage.Section id="signal-scope" title="Digital Signal Scope">
        <p>
          This scope-style demo uses the shared chart shell for pan, zoom, crosshair, and cursor tooltip behavior while
          rendering multiple digital traces like a simulator waveform view.
        </p>
        <div style={{ maxWidth: 560 }}>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={{}}
            source={SIGNAL_SCOPE_SOURCE}
            canvasHeight={294}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}