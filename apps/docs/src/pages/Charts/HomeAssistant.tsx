import { useCallback, useMemo } from 'react';
import { V2 } from '@lunaterra/math';
import {
  LunaTerraEngine,
  LTElement,
  ScreenContainer,
  resolveThemeColor,
  themeColor,
  type CanvasRenderer,
} from '@lunaterra/core';
import { Crosshair, LineSeries } from '@lunaterra/charts';
import { TextElement } from '@lunaterra/elements';
import { ScaleRuler } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

class GroupElement extends LTElement<object> {
  protected defaultOptions() { return {}; }
}

interface TemperatureSample {
  minute: number;
  temp: number;
}

interface TemperatureBucket {
  x: number;
  minTemp: number;
  maxTemp: number;
}

interface AggregatedSeries {
  buckets: TemperatureBucket[];
  minLine: Array<{ x: number; y: number }>;
  maxLine: Array<{ x: number; y: number }>;
}

interface RangeFillOptions {
  minData: Array<{ x: number; y: number }>;
  maxData: Array<{ x: number; y: number }>;
  colorPath: string;
  opacity: number;
}

interface ChartGestureOptions {
  chartFrame: ScreenContainer;
  getWindowMinutes: () => number;
  getVisibleCenter: () => number;
  panByMinutes: (deltaMinutes: number) => void;
  zoomAround: (nextWindowMinutes: number, focusRatio: number, focusMinute: number) => void;
}

const SCALE_RULER_TICKS = [
  { value: 0, label: 'Hours' },
  { value: 1, label: 'Days' },
  { value: 2, label: 'Weeks' },
] as const;

const MIN_WINDOW_MINUTES = 24 * 60;
const MID_WINDOW_MINUTES = 3 * 24 * 60;
const MAX_WINDOW_MINUTES = 7 * 24 * 60;
const AGGREGATE_BUCKETS = [5, 15, 30] as const;
const TIMELINE_TICK_STEP_CANDIDATES = [1440, 2 * 1440, 3 * 1440, 5 * 1440, 7 * 1440] as const;
const TIMELINE_MAX_TICKS = 7;

const DATA_START_UTC = Date.UTC(2026, 2, 31, 0, 0, 0);
const RAW_STEP_MINUTES = 5;
const TOTAL_DAYS = 30;
const TOTAL_MINUTES = TOTAL_DAYS * 24 * 60;

const CHART_BASELINE = 0.12;
const FILL_BASELINE = CHART_BASELINE - 0.04;
const CHART_TOP = 0.9;
const DATA_FLOOR = CHART_BASELINE + 0.06;
const LABEL_Y_OFFSET = 0.018;
const CHART_WIDTH = 500;
const CHART_HEIGHT = 150;
const CHART_OFFSET_X = 24;
const CHART_OFFSET_Y = 62;

class RangeFill extends LTElement<RangeFillOptions> {
  protected defaultOptions(): RangeFillOptions {
    return {
      minData: [],
      maxData: [],
      colorPath: 'chart.series.secondary',
      opacity: 0.16,
    };
  }

  override render(renderer: CanvasRenderer): void {
    const { minData, maxData, colorPath, opacity } = this.options;
    if (minData.length < 2 || maxData.length < 2 || minData.length !== maxData.length) return;

    const color = resolveThemeColor(themeColor(colorPath), renderer.theme);
    const fillColor = color?.opaque(opacity).toString() ?? 'rgba(255,124,67,0.18)';
    const polygon = [...maxData, ...[...minData].reverse()];

    const fill = renderer.draw(fillColor, 1);
    fill.ctx2d.beginPath();
    const p0 = fill.toPixelsPub(new V2(polygon[0].x, polygon[0].y));
    fill.ctx2d.moveTo(p0.x, p0.y);
    for (let i = 1; i < polygon.length; i++) {
      const point = fill.toPixelsPub(new V2(polygon[i].x, polygon[i].y));
      fill.ctx2d.lineTo(point.x, point.y);
    }
    fill.ctx2d.closePath();
    fill.ctx2d.fillStyle = fillColor;
    fill.ctx2d.fill();
  }
}

class ChartGestureLayer extends LTElement<ChartGestureOptions> {
  private removeListeners: Array<() => void> = [];
  private isMouseDragging = false;
  private lastMouseX = 0;
  private touchMode: 'none' | 'pan' | 'pinch' = 'none';
  private lastTouchX = 0;
  private lastPinchDistance = 0;

  protected defaultOptions(): ChartGestureOptions {
    return {
      chartFrame: new ScreenContainer({ anchor: 'top-left', offsetX: 0, offsetY: 0, width: 1, height: 1 }),
      getWindowMinutes: () => MIN_WINDOW_MINUTES,
      getVisibleCenter: () => 0,
      panByMinutes: () => {},
      zoomAround: () => {},
    };
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);

    const canvas = engine.renderer.canvas;
    const onWheel = (event: WheelEvent) => {
      if (!this.hitClientPoint(event.clientX, event.clientY)) return;

      event.preventDefault();
      const ratio = this.focusRatioFromClientX(event.clientX);
      const windowMinutes = this.options.getWindowMinutes();
      const focusMinute = this.minuteAtRatio(ratio);

      if (event.ctrlKey) {
        const nextWindow = windowMinutes * Math.exp(event.deltaY * 0.0025);
        this.options.zoomAround(nextWindow, ratio, focusMinute);
        return;
      }

      const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
      const deltaMinutes = (dominantDelta / chartRect.w) * windowMinutes;
      this.options.panByMinutes(deltaMinutes);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!this.hitClientPoint(event.clientX, event.clientY)) return;
      this.isMouseDragging = true;
      this.lastMouseX = event.clientX;
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!this.isMouseDragging) return;
      const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
      const windowMinutes = this.options.getWindowMinutes();
      const deltaMinutes = ((event.clientX - this.lastMouseX) / chartRect.w) * windowMinutes;
      this.lastMouseX = event.clientX;
      this.options.panByMinutes(-deltaMinutes);
      event.preventDefault();
    };

    const onMouseUp = () => {
      this.isMouseDragging = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (!this.hitClientPoint(touch.clientX, touch.clientY)) return;
        this.touchMode = 'pan';
        this.lastTouchX = touch.clientX;
        event.preventDefault();
        return;
      }

      if (event.touches.length === 2) {
        const midpoint = this.touchMidpoint(event.touches);
        if (!this.hitClientPoint(midpoint.x, midpoint.y)) return;
        this.touchMode = 'pinch';
        this.lastPinchDistance = this.touchDistance(event.touches);
        event.preventDefault();
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (this.touchMode === 'pan' && event.touches.length === 1) {
        const touch = event.touches[0];
        const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
        const windowMinutes = this.options.getWindowMinutes();
        const deltaMinutes = ((touch.clientX - this.lastTouchX) / chartRect.w) * windowMinutes;
        this.lastTouchX = touch.clientX;
        this.options.panByMinutes(-deltaMinutes);
        event.preventDefault();
        return;
      }

      if (this.touchMode === 'pinch' && event.touches.length === 2) {
        const midpoint = this.touchMidpoint(event.touches);
        const ratio = this.focusRatioFromClientX(midpoint.x);
        const focusMinute = this.minuteAtRatio(ratio);
        const nextDistance = this.touchDistance(event.touches);
        const currentWindow = this.options.getWindowMinutes();
        const nextWindow = currentWindow * (this.lastPinchDistance / nextDistance);
        this.lastPinchDistance = nextDistance;
        this.options.zoomAround(nextWindow, ratio, focusMinute);
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      this.touchMode = 'none';
      this.lastPinchDistance = 0;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    this.removeListeners = [
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd),
      () => canvas.removeEventListener('touchcancel', onTouchEnd),
    ];
  }

  override destroy(): void {
    for (const remove of this.removeListeners) remove();
    this.removeListeners = [];
  }

  private hitClientPoint(clientX: number, clientY: number): boolean {
    const renderer = this.engine?.renderer;
    if (!renderer) return false;

    const chartRect = this.options.chartFrame.getScreenRect(renderer);
    const bounds = renderer.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    return x >= chartRect.x && x <= chartRect.x + chartRect.w && y >= chartRect.y && y <= chartRect.y + chartRect.h;
  }

  private focusRatioFromClientX(clientX: number): number {
    const renderer = this.engine?.renderer;
    if (!renderer) return 0.5;

    const chartRect = this.options.chartFrame.getScreenRect(renderer);
    const bounds = renderer.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    return clamp((x - chartRect.x) / chartRect.w, 0, 1);
  }

  private minuteAtRatio(ratio: number): number {
    return this.options.getVisibleCenter() + (ratio - 0.5) * this.options.getWindowMinutes();
  }

  private touchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  private touchMidpoint(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function signedNoise(seed: number): number {
  return pseudoRandom(seed) * 2 - 1;
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

function createTemperatureSamples(): TemperatureSample[] {
  const samples: TemperatureSample[] = [];
  for (let minute = 0; minute <= TOTAL_MINUTES; minute += RAW_STEP_MINUTES) {
    const day = minute / (24 * 60);
    const hour = (minute / 60) % 24;
    const dailyCycle = Math.sin(((hour - 5) / 24) * Math.PI * 2) * 4.3;
    const weatherFront = Math.sin(day * 0.22 - 0.7) * 3.2;
    const slowDrift = Math.sin(day * 0.9 + 1.2) * 1.8;
    const jagged = signedNoise(day * 96 + hour * 17) * 0.75;
    const microJitter = signedNoise(minute * 0.37) * 0.35;
    const temp = 17.8 + dailyCycle + weatherFront + slowDrift + jagged + microJitter;
    samples.push({ minute, temp: Number(temp.toFixed(2)) });
  }
  return samples;
}

const RAW_TEMPERATURE_SAMPLES = createTemperatureSamples();
const RAW_TEMP_MIN = Math.min(...RAW_TEMPERATURE_SAMPLES.map((sample) => sample.temp)) - 0.8;
const RAW_TEMP_MAX = Math.max(...RAW_TEMPERATURE_SAMPLES.map((sample) => sample.temp)) + 0.8;
const RAW_TEMP_RANGE = RAW_TEMP_MAX - RAW_TEMP_MIN;

function normTemp(temp: number): number {
  return DATA_FLOOR + ((temp - RAW_TEMP_MIN) / RAW_TEMP_RANGE) * (CHART_TOP - DATA_FLOOR);
}

function minuteToDate(minute: number): Date {
  return new Date(DATA_START_UTC + minute * 60_000);
}

function scaleValueToWindowMinutes(scaleValue: number): number {
  if (scaleValue <= 1) {
    return lerpLog(MIN_WINDOW_MINUTES, MID_WINDOW_MINUTES, clamp(scaleValue, 0, 1));
  }
  return lerpLog(MID_WINDOW_MINUTES, MAX_WINDOW_MINUTES, clamp(scaleValue - 1, 0, 1));
}

function windowMinutesToScaleValue(windowMinutes: number): number {
  const clampedWindow = clamp(windowMinutes, MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES);
  if (clampedWindow <= MID_WINDOW_MINUTES) {
    return invLerpLog(MIN_WINDOW_MINUTES, MID_WINDOW_MINUTES, clampedWindow);
  }
  return 1 + invLerpLog(MID_WINDOW_MINUTES, MAX_WINDOW_MINUTES, clampedWindow);
}

function chooseBucketMinutes(windowMinutes: number): (typeof AGGREGATE_BUCKETS)[number] {
  if (windowMinutes <= 36 * 60) return 5;
  if (windowMinutes <= 4 * 24 * 60) return 15;
  return 30;
}

function aggregateTemperatureBuckets(bucketMinutes: number): TemperatureBucket[] {
  const buckets: TemperatureBucket[] = [];
  let sampleIndex = 0;

  for (let start = 0; start < TOTAL_MINUTES; start += bucketMinutes) {
    const end = Math.min(start + bucketMinutes, TOTAL_MINUTES + RAW_STEP_MINUTES);
    let minTemp = Infinity;
    let maxTemp = -Infinity;

    while (
      sampleIndex < RAW_TEMPERATURE_SAMPLES.length &&
      RAW_TEMPERATURE_SAMPLES[sampleIndex].minute < end
    ) {
      const value = RAW_TEMPERATURE_SAMPLES[sampleIndex].temp;
      minTemp = Math.min(minTemp, value);
      maxTemp = Math.max(maxTemp, value);
      sampleIndex += 1;
    }

    if (!isFinite(minTemp) || !isFinite(maxTemp)) continue;

    const width = Math.min(bucketMinutes, TOTAL_MINUTES - start);
    buckets.push({
      x: start + width / 2,
      minTemp,
      maxTemp,
    });
  }

  return buckets;
}

function interpolateBucketValue(
  buckets: TemperatureBucket[],
  x: number,
  key: 'minTemp' | 'maxTemp',
): number {
  if (x <= buckets[0].x) return buckets[0][key];
  if (x >= buckets[buckets.length - 1].x) return buckets[buckets.length - 1][key];

  for (let i = 0; i < buckets.length - 1; i++) {
    const left = buckets[i];
    const right = buckets[i + 1];
    if (x >= left.x && x <= right.x) {
      const t = (x - left.x) / (right.x - left.x);
      return left[key] + (right[key] - left[key]) * t;
    }
  }

  return buckets[buckets.length - 1][key];
}

function interpolateSeriesY(data: Array<{ x: number; y: number }>, x: number): number {
  if (x <= data[0].x) return data[0].y;
  if (x >= data[data.length - 1].x) return data[data.length - 1].y;

  for (let i = 0; i < data.length - 1; i++) {
    const left = data[i];
    const right = data[i + 1];
    if (x >= left.x && x <= right.x) {
      const t = (x - left.x) / (right.x - left.x);
      return left.y + (right.y - left.y) * t;
    }
  }

  return data[data.length - 1].y;
}

function formatTemperature(value: number): string {
  return `${value.toFixed(1)}C`;
}

function formatWindowLabel(windowMinutes: number): string {
  if (windowMinutes < 48 * 60) {
    return `${(windowMinutes / 60).toFixed(1)}h`;
  }
  return `${(windowMinutes / (24 * 60)).toFixed(1)}d`;
}

function formatCursorLabel(minute: number): string {
  const date = minuteToDate(minute);
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day}, ${hh}:${mm}`;
}

function formatTickLabel(minute: number, tickStepMinutes: number): string {
  const date = minuteToDate(minute);
  if (tickStepMinutes >= 24 * 60) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  if (tickStepMinutes >= 12 * 60) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function makeTimelineTicks(windowMinutes: number) {
  const ticks = [] as Array<{ value: number; label: string }>;
  // Pick a step that gives at most TIMELINE_MAX_TICKS across the full 30-day span
  let tickStepMinutes = TIMELINE_TICK_STEP_CANDIDATES[TIMELINE_TICK_STEP_CANDIDATES.length - 1];
  for (const step of TIMELINE_TICK_STEP_CANDIDATES) {
    if (TOTAL_MINUTES / step <= TIMELINE_MAX_TICKS) {
      tickStepMinutes = step;
      break;
    }
  }
  const minCenter = windowMinutes / 2;
  const maxCenter = TOTAL_MINUTES - windowMinutes / 2;
  const firstTick = Math.ceil(minCenter / tickStepMinutes) * tickStepMinutes;
  for (let minute = firstTick; minute <= maxCenter; minute += tickStepMinutes) {
    ticks.push({ value: minute, label: formatTickLabel(minute, tickStepMinutes) });
  }
  return ticks;
}

export default function HomeAssistantPage() {
  const aggregatedByBucket = useMemo<Record<number, AggregatedSeries>>(() => {
    return AGGREGATE_BUCKETS.reduce<Record<number, AggregatedSeries>>((acc, bucketMinutes) => {
      const buckets = aggregateTemperatureBuckets(bucketMinutes);
      acc[bucketMinutes] = {
        buckets,
        minLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.minTemp) })),
        maxLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.maxTemp) })),
      };
      return acc;
    }, {});
  }, []);

  const buildScene = useCallback((engine: LunaTerraEngine): LTElement => {
    const group = new GroupElement();
    let scaleValue = 2;
    let windowMinutes = scaleValueToWindowMinutes(scaleValue);
    let visibleCenter = TOTAL_MINUTES - windowMinutes / 2;
    let currentSeries = aggregatedByBucket[chooseBucketMinutes(windowMinutes)];

    const title = new TextElement({ text: 'guest room climate', fontSize: 10, align: 'left', baseline: 'top' });
    title.position = new V2(0, 0.98);
    title.styles.color = themeColor('chart.widget.title');
    group.appendChild(title);

    const chartFrame = new ScreenContainer({
      anchor: 'top-left',
      offsetX: CHART_OFFSET_X,
      offsetY: CHART_OFFSET_Y,
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      worldBounds: {
        xMin: visibleCenter - windowMinutes / 2,
        xMax: visibleCenter + windowMinutes / 2,
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
      },
    });
    group.appendChild(chartFrame);

    const rangeFill = new RangeFill({
      minData: currentSeries.minLine,
      maxData: currentSeries.maxLine,
      colorPath: 'chart.series.secondary',
      opacity: 0.16,
    });
    chartFrame.appendChild(rangeFill);

    const minLine = new LineSeries({ data: currentSeries.minLine, lineWidth: 1.1 });
    minLine.styles.color = themeColor('chart.series.secondary');
    minLine.styles.opacity = 0.62;
    chartFrame.appendChild(minLine);

    const maxLine = new LineSeries({ data: currentSeries.maxLine, lineWidth: 1.6 });
    maxLine.styles.color = themeColor('chart.series.secondary');
    chartFrame.appendChild(maxLine);

    const crosshair = new Crosshair({
      xMin: 0,
      xMax: TOTAL_MINUTES,
      followPointer: false,
      showXLabel: false,
      yMin: FILL_BASELINE,
      yMax: CHART_TOP,
      series: [currentSeries.minLine, currentSeries.maxLine],
      formatXLabel: (x) => formatCursorLabel(x),
    });
    crosshair.styles.color = themeColor('chart.widget.title');
    crosshair.styles.opacity = 0.58;
    crosshair.setValue(visibleCenter);
    chartFrame.appendChild(crosshair);

    const maxLabel = new TextElement({ text: '', fontSize: 10, align: 'left', baseline: 'middle' });
    maxLabel.styles.color = themeColor('chart.series.secondary');
    chartFrame.appendChild(maxLabel);

    const minLabel = new TextElement({ text: '', fontSize: 10, align: 'left', baseline: 'middle' });
    minLabel.styles.color = themeColor('chart.series.secondary');
    minLabel.styles.opacity = 0.74;
    chartFrame.appendChild(minLabel);

    const clampCenter = (minute: number, nextWindowMinutes = windowMinutes) => clamp(
      minute,
      nextWindowMinutes / 2,
      TOTAL_MINUTES - nextWindowMinutes / 2,
    );

    const updateReadouts = (minute: number) => {
      const currentMin = interpolateBucketValue(currentSeries.buckets, minute, 'minTemp');
      const currentMax = interpolateBucketValue(currentSeries.buckets, minute, 'maxTemp');
      const xOffset = windowMinutes * 0.03;
      const xMin = visibleCenter - windowMinutes / 2;
      const xMax = visibleCenter + windowMinutes / 2;
      const placeRight = minute + xOffset <= xMax - windowMinutes * 0.02;
      const rawX = placeRight ? minute + xOffset : minute - xOffset;
      const labelX = clamp(rawX, xMin + windowMinutes * 0.04, xMax - windowMinutes * 0.04);
      const labelAlign = placeRight ? 'left' : 'right';

      minLabel.options.text = `min ${formatTemperature(currentMin)}`;
      maxLabel.options.text = `max ${formatTemperature(currentMax)}`;
      minLabel.options.align = labelAlign;
      maxLabel.options.align = labelAlign;
      minLabel.position = new V2(labelX, interpolateSeriesY(currentSeries.minLine, minute) - LABEL_Y_OFFSET);
      maxLabel.position = new V2(labelX, interpolateSeriesY(currentSeries.maxLine, minute) + LABEL_Y_OFFSET);
    };

    const updateVisibleWindow = (minute: number) => {
      visibleCenter = clampCenter(minute);
      chartFrame.options.worldBounds = {
        xMin: visibleCenter - windowMinutes / 2,
        xMax: visibleCenter + windowMinutes / 2,
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
      };
      updateReadouts(visibleCenter);
      crosshair.setValue(visibleCenter);
      engine.requestUpdate();
    };

    const topRuler = new ScaleRuler({
      ticks: [...SCALE_RULER_TICKS],
      value: scaleValue,
      sticky: false,
      position: 'top-center',
      edgeOffset: 8,
      badgePosition: 'above',
      formatValue: (value) => formatWindowLabel(scaleValueToWindowMinutes(value)),
      onChange: (value) => {
        scaleValue = clamp(value, 0, 2);
        windowMinutes = scaleValueToWindowMinutes(scaleValue);
        currentSeries = aggregatedByBucket[chooseBucketMinutes(windowMinutes)];
        rangeFill.options.minData = currentSeries.minLine;
        rangeFill.options.maxData = currentSeries.maxLine;
        minLine.options.data = currentSeries.minLine;
        maxLine.options.data = currentSeries.maxLine;
        crosshair.options.series = [currentSeries.minLine, currentSeries.maxLine];
        bottomRuler.options.ticks = makeTimelineTicks(windowMinutes);
        bottomRuler.setValue(clampCenter(visibleCenter));
        updateVisibleWindow(visibleCenter);
      },
    });
    group.appendChild(topRuler);

    const bottomRuler = new ScaleRuler({
      ticks: makeTimelineTicks(windowMinutes),
      value: visibleCenter,
      sticky: false,
      interactionMode: 'scroll-scale',
      formatValue: (value) => formatCursorLabel(value),
      badgePosition: 'below',
      onChange: (minute) => {
        updateVisibleWindow(minute);
      },
    });
    group.appendChild(bottomRuler);

    const gestureLayer = new ChartGestureLayer({
      chartFrame,
      getWindowMinutes: () => windowMinutes,
      getVisibleCenter: () => visibleCenter,
      panByMinutes: (deltaMinutes) => {
        updateVisibleWindow(visibleCenter + deltaMinutes);
        bottomRuler.setValue(visibleCenter);
      },
      zoomAround: (nextWindowMinutes, focusRatio, focusMinute) => {
        windowMinutes = clamp(nextWindowMinutes, MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES);
        scaleValue = windowMinutesToScaleValue(windowMinutes);
        currentSeries = aggregatedByBucket[chooseBucketMinutes(windowMinutes)];
        rangeFill.options.minData = currentSeries.minLine;
        rangeFill.options.maxData = currentSeries.maxLine;
        minLine.options.data = currentSeries.minLine;
        maxLine.options.data = currentSeries.maxLine;
        crosshair.options.series = [currentSeries.minLine, currentSeries.maxLine];

        const nextCenter = clampCenter(
          focusMinute + (0.5 - focusRatio) * windowMinutes,
          windowMinutes,
        );

        topRuler.setValue(scaleValue);
        bottomRuler.options.ticks = makeTimelineTicks(windowMinutes);
        bottomRuler.setValue(nextCenter);
        updateVisibleWindow(nextCenter);
      },
    });
    group.appendChild(gestureLayer);

    engine.interactive = false;
    engine.add(group);
    updateVisibleWindow(visibleCenter);
    return group;
  }, [aggregatedByBucket]);

  return (
    <DocPage title="Charts/Home Assistant" section="@lunaterra/charts">
      <DocPage.Section id="home-assistant" title="Home Assistant Climate History">
        <p>
          The top ruler scales the chart continuously, the bottom ruler scrubs time with adaptive tick density,
          and the chart itself supports drag, wheel, and touch pinch without using engine camera zoom.
        </p>
        <div style={{ maxWidth: 560 }}>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={{}}
            source={`// Top ruler scales the chart continuously\n// Bottom ruler scrubs time; chart supports drag, wheel, and pinch`}
            canvasHeight={230}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}
