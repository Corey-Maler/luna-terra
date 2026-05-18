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
import { LineSeries, StateBandSeries } from '@lunaterra/charts';
import { RectElement, TextElement } from '@lunaterra/elements';
import { TimelineChartChrome } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

class GroupElement extends LTElement<object> {
  protected defaultOptions() { return {}; }
}

interface TemperatureSample {
  minute: number;
  temp: number;
}

interface HumiditySample {
  minute: number;
  humidity: number;
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
  humidityLine: Array<{ x: number; y: number }>;
}

interface RangeFillOptions {
  minData: Array<{ x: number; y: number }>;
  maxData: Array<{ x: number; y: number }>;
  colorPath: string;
  opacity: number;
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
const WINDOW_TICK_STEP_CANDIDATES = [60, 120, 240, 360, 720, 1440] as const;

const DATA_START_UTC = Date.UTC(2026, 2, 31, 0, 0, 0);
const RAW_STEP_MINUTES = 5;
const DAY_MINUTES = 24 * 60;
const TOTAL_DAYS = 30;
const TOTAL_MINUTES = TOTAL_DAYS * 24 * 60;

const CHART_BASELINE = 0.12;
const FILL_BASELINE = CHART_BASELINE - 0.04;
const CHART_TOP = 0.9;
const DATA_FLOOR = CHART_BASELINE + 0.06;
const CHART_WIDTH = 500;
const CHART_HEIGHT = 140;
const CHART_OFFSET_X = 24;
const CHART_OFFSET_Y = 62;
const HEATING_LANE_Y = CHART_TOP - 0.03;
const DATA_CEILING = HEATING_LANE_Y - 0.06;
const DAILY_LABEL_CLEARANCE_PX = 12;
const DAILY_LABEL_EDGE_PAD_PX = 8;
const EXTREMA_LABEL_POOL_SIZE = 10;
const EXTREMA_SMOOTH_MINUTES_MIN = 45;
const EXTREMA_SMOOTH_MINUTES_MAX = 180;
const EXTREMA_MIN_PROMINENCE_PX = 2;
const EXTREMA_SAME_TYPE_MIN_DISTANCE_MINUTES = 10 * 60;

const HOME_ASSISTANT_SOURCE = `const timelineChrome = new TimelineChartChrome({
  chartFrame,
  scaleTicks: [...SCALE_RULER_TICKS],
  initialScaleValue: scaleValue,
  initialVisibleCenter: visibleCenter,
  initialCursorValue: cursorMinute,
  domainMin: 0,
  domainMax: TOTAL_MINUTES,
  minWindowSize: MIN_WINDOW_MINUTES,
  maxWindowSize: MAX_WINDOW_MINUTES,
  scaleValueToWindowSize: scaleValueToWindowMinutes,
  windowSizeToScaleValue: windowMinutesToScaleValue,
  windowTickStepCandidates: WINDOW_TICK_STEP_CANDIDATES,
  formatScaleValue: (value) => formatWindowLabel(scaleValueToWindowMinutes(value)),
  formatWindowTick: (minute, step) => formatTickLabel(minute, step),
  formatCursorValue: formatCursorLabel,
  crosshair: {
    yMin: FILL_BASELINE,
    yMax: CHART_TOP,
    showXLabel: false,
    getSeries: () => [currentSeries.minLine, currentSeries.maxLine],
  },
  tooltip: {
    widthPx: 148,
    heightPx: 40,
    anchorOffsetPx: 8,
    paddingXPx: 6,
    paddingTopPx: 10,
    lineGapPx: 12,
    getRows: (minute) => [
      { text: "temp / humidity / heater", fontSize: 9 },
      { text: "min and max temperature", fontSize: 8, opacity: 0.84 },
      { text: "heater on/off state", fontSize: 8, opacity: 0.86 },
    ],
    getPanelY: (_state, panelHeightWorld) => clamp(DATA_CEILING - panelHeightWorld, DATA_FLOOR, DATA_CEILING - panelHeightWorld),
  },
  onStateChange: (state) => {
    windowMinutes = state.windowSize;
    visibleCenter = state.visibleCenter;
    cursorMinute = state.cursorValue;
  },
});`;

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

function createHumiditySamples(temperatureSamples: TemperatureSample[]): HumiditySample[] {
  return temperatureSamples.map((sample) => {
    const day = sample.minute / DAY_MINUTES;
    const baseline = 52 + Math.sin(day * 0.18 + 0.9) * 10;
    const antiTemp = (22 - sample.temp) * 1.6;
    const breeze = signedNoise(sample.minute * 0.21 + 17) * 3.5;
    const humidity = clamp(baseline + antiTemp + breeze, 28, 88);
    return { minute: sample.minute, humidity: Number(humidity.toFixed(1)) };
  });
}

function createHeatingSegments(temperatureSamples: TemperatureSample[]): Array<{ x0: number; x1: number }> {
  const segments: Array<{ x0: number; x1: number }> = [];
  const thresholdOn = 19;
  const thresholdOff = 20;

  let isHeatingOn = false;
  let activeStart = 0;

  for (const sample of temperatureSamples) {
    if (!isHeatingOn && sample.temp <= thresholdOn) {
      isHeatingOn = true;
      activeStart = sample.minute;
      continue;
    }

    if (isHeatingOn && sample.temp >= thresholdOff) {
      segments.push({ x0: activeStart, x1: sample.minute });
      isHeatingOn = false;
    }
  }

  if (isHeatingOn) {
    segments.push({ x0: activeStart, x1: TOTAL_MINUTES });
  }

  return segments;
}

const RAW_TEMPERATURE_SAMPLES = createTemperatureSamples();
const RAW_HUMIDITY_SAMPLES = createHumiditySamples(RAW_TEMPERATURE_SAMPLES);
const HEATING_SEGMENTS = createHeatingSegments(RAW_TEMPERATURE_SAMPLES);
const RAW_TEMP_MIN = Math.min(...RAW_TEMPERATURE_SAMPLES.map((sample) => sample.temp)) - 0.8;
const RAW_TEMP_MAX = Math.max(...RAW_TEMPERATURE_SAMPLES.map((sample) => sample.temp)) + 0.8;
const RAW_TEMP_RANGE = RAW_TEMP_MAX - RAW_TEMP_MIN;

const HUMIDITY_MIN = 20;
const HUMIDITY_MAX = 90;

function normHumidity(humidity: number): number {
  return DATA_FLOOR + ((humidity - HUMIDITY_MIN) / (HUMIDITY_MAX - HUMIDITY_MIN)) * (DATA_CEILING - DATA_FLOOR);
}

function denormHumidity(y: number): number {
  const t = clamp((y - DATA_FLOOR) / Math.max(1e-6, DATA_CEILING - DATA_FLOOR), 0, 1);
  return HUMIDITY_MIN + t * (HUMIDITY_MAX - HUMIDITY_MIN);
}

function normTemp(temp: number): number {
  return DATA_FLOOR + ((temp - RAW_TEMP_MIN) / RAW_TEMP_RANGE) * (DATA_CEILING - DATA_FLOOR);
}

function chartPxToWorldY(px: number): number {
  return ((CHART_TOP - FILL_BASELINE) * px) / CHART_HEIGHT;
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

function aggregateHumidityBuckets(bucketMinutes: number): Array<{ x: number; humidity: number }> {
  const points: Array<{ x: number; humidity: number }> = [];
  let sampleIndex = 0;

  for (let start = 0; start < TOTAL_MINUTES; start += bucketMinutes) {
    const end = Math.min(start + bucketMinutes, TOTAL_MINUTES + RAW_STEP_MINUTES);
    let sum = 0;
    let count = 0;

    while (
      sampleIndex < RAW_HUMIDITY_SAMPLES.length &&
      RAW_HUMIDITY_SAMPLES[sampleIndex].minute < end
    ) {
      sum += RAW_HUMIDITY_SAMPLES[sampleIndex].humidity;
      count += 1;
      sampleIndex += 1;
    }

    if (count === 0) continue;

    const width = Math.min(bucketMinutes, TOTAL_MINUTES - start);
    points.push({
      x: start + width / 2,
      humidity: sum / count,
    });
  }

  return points;
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

function smoothSeriesMovingAverage(
  data: Array<{ x: number; y: number }>,
  smoothingMinutes: number,
): Array<{ x: number; y: number }> {
  if (data.length < 3) return data;

  const avgStepMinutes = (data[data.length - 1].x - data[0].x) / Math.max(1, data.length - 1);
  const radiusPoints = Math.max(1, Math.round((smoothingMinutes / avgStepMinutes) * 0.5));
  const out: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - radiusPoints);
    const end = Math.min(data.length - 1, i + radiusPoints);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += data[j].y;
      count += 1;
    }
    out.push({ x: data[i].x, y: sum / Math.max(1, count) });
  }

  return out;
}

function findAdaptiveExtrema(
  data: Array<{ x: number; y: number }>,
  xMin: number,
  xMax: number,
  type: 'max' | 'min',
  smoothingMinutes: number,
  minDistanceMinutes: number,
  minProminenceWorld: number,
  maxCount: number,
): Array<{ x: number; y: number }> {
  const smoothed = smoothSeriesMovingAverage(data, smoothingMinutes);
  const visible = smoothed.filter((p) => p.x >= xMin && p.x <= xMax);
  if (visible.length < 3) return [];

  const candidates: Array<{ x: number; y: number }> = [];
  for (let i = 1; i < visible.length - 1; i++) {
    const prev = visible[i - 1];
    const curr = visible[i];
    const next = visible[i + 1];

    const isPeak = curr.y >= prev.y && curr.y >= next.y && (curr.y > prev.y || curr.y > next.y);
    const isTrough = curr.y <= prev.y && curr.y <= next.y && (curr.y < prev.y || curr.y < next.y);
    if ((type === 'max' && !isPeak) || (type === 'min' && !isTrough)) continue;

    const prominence = type === 'max'
      ? curr.y - Math.max(prev.y, next.y)
      : Math.min(prev.y, next.y) - curr.y;
    if (prominence < minProminenceWorld) continue;

    candidates.push(curr);
  }

  const selected: Array<{ x: number; y: number }> = [];
  candidates.sort((a, b) => a.x - b.x);
  for (const candidate of candidates) {
    if (selected.length === 0) {
      selected.push(candidate);
      if (selected.length >= maxCount) break;
      continue;
    }

    const last = selected[selected.length - 1];
    if (Math.abs(candidate.x - last.x) < minDistanceMinutes) {
      const shouldReplace = type === 'max' ? candidate.y > last.y : candidate.y < last.y;
      if (shouldReplace) {
        selected[selected.length - 1] = candidate;
      }
      continue;
    }

    selected.push(candidate);
    if (selected.length >= maxCount) break;
  }

  if (selected.length === 0) {
    // Monotonic-ish fallback: emit one global extrema in the visible range.
    let bestRaw = data[0];
    for (let i = 1; i < data.length; i++) {
      const p = data[i];
      if (p.x < xMin || p.x > xMax) continue;
      if ((type === 'max' && p.y > bestRaw.y) || (type === 'min' && p.y < bestRaw.y)) {
        bestRaw = p;
      }
    }
    return [bestRaw];
  }

  // Map selected smoothed extrema x back to raw y for accurate label anchoring.
  for (let i = 0; i < selected.length; i++) {
    const x = selected[i].x;
    selected[i] = { x, y: interpolateSeriesY(data, x) };
  }
  return selected;
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

export default function HomeAssistantPage() {
  const aggregatedByBucket = useMemo<Record<number, AggregatedSeries>>(() => {
    return AGGREGATE_BUCKETS.reduce<Record<number, AggregatedSeries>>((acc, bucketMinutes) => {
      const buckets = aggregateTemperatureBuckets(bucketMinutes);
      const humidityBuckets = aggregateHumidityBuckets(bucketMinutes);
      acc[bucketMinutes] = {
        buckets,
        minLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.minTemp) })),
        maxLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.maxTemp) })),
        humidityLine: humidityBuckets.map((bucket) => ({ x: bucket.x, y: normHumidity(bucket.humidity) })),
      };
      return acc;
    }, {});
  }, []);

  const buildScene = useCallback((engine: LunaTerraEngine): LTElement => {
    const group = new GroupElement();
    let scaleValue = 2;
    let windowMinutes = scaleValueToWindowMinutes(scaleValue);
    let visibleCenter = TOTAL_MINUTES - windowMinutes / 2;
    let cursorMinute = TOTAL_MINUTES;
    let currentSeries = aggregatedByBucket[chooseBucketMinutes(windowMinutes)];

    const title = new TextElement({ text: 'guest room climate', fontSize: 10, align: 'left', baseline: 'top' });
    title.position = new V2(0, 0.98);
    title.styles.color = themeColor('chart.widget.title');
    group.appendChild(title);

    const heatingLegend = new TextElement({ text: 'heating on/off', fontSize: 9, align: 'left', baseline: 'top' });
    heatingLegend.position = new V2(0.52, 0.98);
    heatingLegend.styles.color = themeColor('chart.series.secondary');
    heatingLegend.styles.opacity = 0.8;
    group.appendChild(heatingLegend);

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

    const humidityLine = new LineSeries({ data: currentSeries.humidityLine, lineWidth: 1.2 });
    humidityLine.styles.color = themeColor('chart.series.primary');
    humidityLine.styles.opacity = 0.85;
    chartFrame.appendChild(humidityLine);

    const heatingLabelPxPad = 4;
    const heatingLabelMaskPxW = 38;
    const heatingLabelMaskPxH = 12;
    const heatingLaneGapPx = 2;
    const heatingLaneStartPx = heatingLabelPxPad + heatingLabelMaskPxW + heatingLaneGapPx;
    const heatingLabelWorldPerPxX = windowMinutes / CHART_WIDTH;
    const heatingLabelWorldPerPxY = (CHART_TOP - FILL_BASELINE) / CHART_HEIGHT;
    const resolvePanelBgFill = () => {
      const base = resolveThemeColor(themeColor('ui.zoomControls.panelBg'), engine.renderer.theme);
      return base?.opaque(0.94).toString() ?? 'rgba(36, 36, 36, 0.94)';
    };
    const heatingState = new StateBandSeries({
      xMin: visibleCenter - windowMinutes / 2 + heatingLaneStartPx * heatingLabelWorldPerPxX,
      xMax: visibleCenter + windowMinutes / 2,
      y: HEATING_LANE_Y,
      onSegments: HEATING_SEGMENTS,
      offLineWidth: 1,
      onLineWidth: 6,
      offOpacity: 0.28,
    });
    heatingState.styles.color = themeColor('chart.series.secondary');
    chartFrame.appendChild(heatingState);

    const heatingLabel = new TextElement({ text: 'heating', fontSize: 8, align: 'left', baseline: 'middle' });
    const heatingLabelMask = new RectElement({
      width: heatingLabelMaskPxW * heatingLabelWorldPerPxX,
      height: heatingLabelMaskPxH * heatingLabelWorldPerPxY,
      cornerRadius: 0,
      fillColor: resolvePanelBgFill(),
      stroke: false,
    });
    heatingLabelMask.position = new V2(
      visibleCenter - windowMinutes / 2 + (heatingLabelPxPad - 1) * heatingLabelWorldPerPxX,
      HEATING_LANE_Y - (heatingLabelMaskPxH * heatingLabelWorldPerPxY) / 2
    );
    chartFrame.appendChild(heatingLabelMask);
    heatingLabel.position = new V2(
      visibleCenter - windowMinutes / 2 + heatingLabelPxPad * heatingLabelWorldPerPxX,
      HEATING_LANE_Y
    );
    heatingLabel.styles.color = themeColor('chart.series.secondary');
    heatingLabel.styles.opacity = 0.86;
    chartFrame.appendChild(heatingLabel);

    const readoutPanelPadPx = 6;
    const readoutPanelWpx = 148;
    const readoutPanelHpx = 40;
    const readoutPanelTopPadPx = 10;
    const readoutLineGapPx = 12;
    const readoutAnchorOffsetPx = 8;

    const adaptiveMaxLabels: TextElement[] = Array.from({ length: EXTREMA_LABEL_POOL_SIZE }, () => {
      const label = new TextElement({ text: '', fontSize: 8, align: 'center', baseline: 'bottom' });
      label.styles.color = themeColor('chart.series.secondary');
      label.styles.opacity = 0.66;
      label.visibility = false;
      chartFrame.appendChild(label);
      return label;
    });

    const adaptiveMinLabels: TextElement[] = Array.from({ length: EXTREMA_LABEL_POOL_SIZE }, () => {
      const label = new TextElement({ text: '', fontSize: 8, align: 'center', baseline: 'top' });
      label.styles.color = themeColor('chart.series.secondary');
      label.styles.opacity = 0.56;
      label.visibility = false;
      chartFrame.appendChild(label);
      return label;
    });

    const clampCenter = (minute: number, nextWindowMinutes = windowMinutes) => clamp(
      minute,
      nextWindowMinutes / 2,
      TOTAL_MINUTES - nextWindowMinutes / 2,
    );

    const clampCursorToWindow = (minute: number) => {
      const xMin = visibleCenter - windowMinutes / 2;
      const xMax = visibleCenter + windowMinutes / 2;
      return clamp(minute, xMin, xMax);
    };

    const syncSeriesForWindow = () => {
      currentSeries = aggregatedByBucket[chooseBucketMinutes(windowMinutes)];
      rangeFill.options.minData = currentSeries.minLine;
      rangeFill.options.maxData = currentSeries.maxLine;
      minLine.options.data = currentSeries.minLine;
      maxLine.options.data = currentSeries.maxLine;
      humidityLine.options.data = currentSeries.humidityLine;
    };

    const getTooltipRows = (minute: number) => {
      const rawMin = interpolateBucketValue(currentSeries.buckets, minute, 'minTemp');
      const rawMax = interpolateBucketValue(currentSeries.buckets, minute, 'maxTemp');
      const currentMin = Math.min(rawMin, rawMax);
      const currentMax = Math.max(rawMin, rawMax);

      const humidityY = interpolateSeriesY(currentSeries.humidityLine, minute);
      const humidity = denormHumidity(humidityY);
      const heaterOn = HEATING_SEGMENTS.some((seg) => minute >= seg.x0 && minute <= seg.x1);
      const isSingleValueMode = chooseBucketMinutes(windowMinutes) === RAW_STEP_MINUTES;
      return [
        {
          text: isSingleValueMode
            ? `temp ${formatTemperature((currentMin + currentMax) * 0.5)}`
            : `min ${formatTemperature(currentMin)}  max ${formatTemperature(currentMax)}`,
          colorPath: 'chart.widget.title',
          opacity: 1,
          fontSize: 9,
        },
        {
          text: `humidity ${humidity.toFixed(0)}%`,
          colorPath: 'chart.widget.title',
          opacity: 0.84,
          fontSize: 8,
        },
        {
          text: `heater ${heaterOn ? 'on' : 'off'}`,
          colorPath: 'chart.series.secondary',
          opacity: 0.86,
          fontSize: 8,
        },
      ];
    };

    const updateExtremaLabels = () => {
      const xMin = visibleCenter - windowMinutes / 2;
      const xMax = visibleCenter + windowMinutes / 2;
      const clearY = chartPxToWorldY(DAILY_LABEL_CLEARANCE_PX);
      const edgePadY = chartPxToWorldY(DAILY_LABEL_EDGE_PAD_PX);
      const yMinSafe = DATA_FLOOR + edgePadY;
      const yMaxSafe = DATA_CEILING - edgePadY;

      const smoothingMinutes = clamp(
        windowMinutes / 24,
        EXTREMA_SMOOTH_MINUTES_MIN,
        EXTREMA_SMOOTH_MINUTES_MAX,
      );
      const minProminenceWorld = chartPxToWorldY(EXTREMA_MIN_PROMINENCE_PX);
      const maxCount = Math.max(1, Math.min(EXTREMA_LABEL_POOL_SIZE, Math.floor(CHART_WIDTH / 90)));

      const visibleMaxima = findAdaptiveExtrema(
        currentSeries.maxLine,
        xMin,
        xMax,
        'max',
        smoothingMinutes,
        EXTREMA_SAME_TYPE_MIN_DISTANCE_MINUTES,
        minProminenceWorld,
        maxCount,
      );
      const visibleMinima = findAdaptiveExtrema(
        currentSeries.minLine,
        xMin,
        xMax,
        'min',
        smoothingMinutes,
        EXTREMA_SAME_TYPE_MIN_DISTANCE_MINUTES,
        minProminenceWorld,
        maxCount,
      );

      for (let i = 0; i < adaptiveMaxLabels.length; i++) {
        adaptiveMaxLabels[i].visibility = false;
      }
      for (let i = 0; i < adaptiveMinLabels.length; i++) {
        adaptiveMinLabels[i].visibility = false;
      }

      for (let i = 0; i < visibleMaxima.length && i < adaptiveMaxLabels.length; i++) {
        const point = visibleMaxima[i];
        const label = adaptiveMaxLabels[i];
        const temp = interpolateBucketValue(currentSeries.buckets, point.x, 'maxTemp');
        label.options.text = `max ${formatTemperature(temp)}`;
        label.position = new V2(point.x, clamp(point.y + clearY, yMinSafe, yMaxSafe));
        label.visibility = true;
      }

      for (let i = 0; i < visibleMinima.length && i < adaptiveMinLabels.length; i++) {
        const point = visibleMinima[i];
        const label = adaptiveMinLabels[i];
        const temp = interpolateBucketValue(currentSeries.buckets, point.x, 'minTemp');
        label.options.text = `min ${formatTemperature(temp)}`;
        label.position = new V2(point.x, clamp(point.y - clearY, yMinSafe, yMaxSafe));
        label.visibility = true;
      }
    };

    const updateVisibleWindow = (minute: number) => {
      visibleCenter = clampCenter(minute);
      chartFrame.options.worldBounds = {
        xMin: visibleCenter - windowMinutes / 2,
        xMax: visibleCenter + windowMinutes / 2,
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
      };
      cursorMinute = clampCursorToWindow(cursorMinute);
      updateExtremaLabels();
      const worldPerPxX = windowMinutes / CHART_WIDTH;
      const worldPerPxY = (CHART_TOP - FILL_BASELINE) / CHART_HEIGHT;
      heatingState.options = {
        ...heatingState.options,
        xMin: visibleCenter - windowMinutes / 2 + heatingLaneStartPx * worldPerPxX,
        xMax: visibleCenter + windowMinutes / 2,
      };
      heatingLabelMask.options = {
        ...heatingLabelMask.options,
        width: heatingLabelMaskPxW * worldPerPxX,
        height: heatingLabelMaskPxH * worldPerPxY,
        fillColor: resolvePanelBgFill(),
      };
      heatingLabelMask.position = new V2(
        visibleCenter - windowMinutes / 2 + (heatingLabelPxPad - 1) * worldPerPxX,
        HEATING_LANE_Y - (heatingLabelMaskPxH * worldPerPxY) / 2
      );
      heatingLabel.position = new V2(
        visibleCenter - windowMinutes / 2 + heatingLabelPxPad * worldPerPxX,
        HEATING_LANE_Y
      );
      engine.requestUpdate();
    };

    const timelineChrome = new TimelineChartChrome({
      chartFrame,
      scaleTicks: [...SCALE_RULER_TICKS],
      initialScaleValue: scaleValue,
      initialVisibleCenter: visibleCenter,
      initialCursorValue: cursorMinute,
      domainMin: 0,
      domainMax: TOTAL_MINUTES,
      minWindowSize: MIN_WINDOW_MINUTES,
      maxWindowSize: MAX_WINDOW_MINUTES,
      scaleValueToWindowSize: scaleValueToWindowMinutes,
      windowSizeToScaleValue: windowMinutesToScaleValue,
      windowTickStepCandidates: WINDOW_TICK_STEP_CANDIDATES,
      formatScaleValue: (value) => formatWindowLabel(scaleValueToWindowMinutes(value)),
      formatWindowTick: (minute, step) => formatTickLabel(minute, step),
      formatCursorValue: formatCursorLabel,
      sidePadding: CHART_OFFSET_X,
      crosshair: {
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
        showXLabel: false,
        formatXLabel: formatCursorLabel,
        colorPath: 'chart.widget.title',
        opacity: 0.58,
        getSeries: () => [currentSeries.minLine, currentSeries.maxLine],
      },
      tooltip: {
        widthPx: readoutPanelWpx,
        heightPx: readoutPanelHpx,
        anchorOffsetPx: readoutAnchorOffsetPx,
        paddingXPx: readoutPanelPadPx,
        paddingTopPx: readoutPanelTopPadPx,
        lineGapPx: readoutLineGapPx,
        backgroundOpacity: 0.94,
        getRows: (minute) => getTooltipRows(minute),
        getPanelY: (_state, panelHeightWorld) => {
          const worldPerPxY = (CHART_TOP - FILL_BASELINE) / CHART_HEIGHT;
          return clamp(
            DATA_CEILING - panelHeightWorld - worldPerPxY * 2,
            DATA_FLOOR + worldPerPxY * 2,
            DATA_CEILING - panelHeightWorld - worldPerPxY * 2,
          );
        },
      },
      onStateChange: (state) => {
        scaleValue = state.scaleValue;
        windowMinutes = state.windowSize;
        visibleCenter = state.visibleCenter;
        cursorMinute = state.cursorValue;
        syncSeriesForWindow();
        updateVisibleWindow(visibleCenter);
      },
    });
    group.appendChild(timelineChrome);

    engine.interactive = false;
    engine.add(group);
    updateVisibleWindow(visibleCenter);
    return group;
  }, [aggregatedByBucket]);

  return (
    <DocPage title="Charts/Home Assistant" section="@lunaterra/charts">
      <DocPage.Section id="home-assistant" title="Home Assistant Climate History">
        <p>
          The top ruler controls the visible time window, the bottom ruler scrubs the cursor, and the shared shell now
          owns the crosshair plus cursor tooltip. The chart overlays temperature, humidity, and a heating on/off lane.
        </p>
        <div style={{ maxWidth: 560 }}>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={{}}
            source={HOME_ASSISTANT_SOURCE}
            canvasHeight={252}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}
