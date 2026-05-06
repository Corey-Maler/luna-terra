import { useCallback, useMemo, useState } from 'react';
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
import { Button } from '../../components/Button/Button';
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

interface RangeFillOptions {
  minData: Array<{ x: number; y: number }>;
  maxData: Array<{ x: number; y: number }>;
  colorPath: string;
  opacity: number;
}

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

type ScaleKey = 'weeks' | 'days' | 'hours';

interface ScalePreset {
  label: string;
  windowMinutes: number;
  bucketMinutes: number;
  tickStepMinutes: number;
}

const SCALE_PRESETS: Record<ScaleKey, ScalePreset> = {
  weeks: { label: 'Weeks', windowMinutes: 7 * 24 * 60, bucketMinutes: 30, tickStepMinutes: 24 * 60 },
  days: { label: 'Days', windowMinutes: 3 * 24 * 60, bucketMinutes: 15, tickStepMinutes: 12 * 60 },
  hours: { label: 'Hours', windowMinutes: 24 * 60, bucketMinutes: 5, tickStepMinutes: 2 * 60 },
};

const DATA_START_UTC = Date.UTC(2026, 2, 31, 0, 0, 0);
const RAW_STEP_MINUTES = 5;
const TOTAL_DAYS = 30;
const TOTAL_MINUTES = TOTAL_DAYS * 24 * 60;

const CHART_BASELINE = 0.12;
const FILL_BASELINE = CHART_BASELINE - 0.04;
const CHART_TOP = 0.9;
const DATA_FLOOR = CHART_BASELINE + 0.06;
const LABEL_Y_OFFSET = 0.018;

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function signedNoise(seed: number): number {
  return pseudoRandom(seed) * 2 - 1;
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
const CHART_WIDTH = 500;
const CHART_HEIGHT = 150;
const CHART_OFFSET_X = 24;
const CHART_OFFSET_Y = 22;

function normTemp(temp: number): number {
  return DATA_FLOOR + ((temp - RAW_TEMP_MIN) / RAW_TEMP_RANGE) * (CHART_TOP - DATA_FLOOR);
}

function minuteToDate(minute: number): Date {
  return new Date(DATA_START_UTC + minute * 60_000);
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

function formatTickLabel(minute: number, scale: ScaleKey): string {
  const date = minuteToDate(minute);
  if (scale === 'weeks') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  if (scale === 'days') {
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

function makeTimelineTicks(scale: ScaleKey, preset: ScalePreset) {
  const ticks = [] as Array<{ value: number; label: string }>;
  const minCenter = preset.windowMinutes / 2;
  const maxCenter = TOTAL_MINUTES - preset.windowMinutes / 2;
  const firstTick = Math.ceil(minCenter / preset.tickStepMinutes) * preset.tickStepMinutes;
  for (let minute = firstTick; minute <= maxCenter; minute += preset.tickStepMinutes) {
    ticks.push({ value: minute, label: formatTickLabel(minute, scale) });
  }
  return ticks;
}

export default function HomeAssistantPage() {
  const [scale, setScale] = useState<ScaleKey>('weeks');
  const preset = SCALE_PRESETS[scale];

  const aggregated = useMemo(() => {
    const buckets = aggregateTemperatureBuckets(preset.bucketMinutes);
    return {
      buckets,
      minLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.minTemp) })),
      maxLine: buckets.map((bucket) => ({ x: bucket.x, y: normTemp(bucket.maxTemp) })),
    };
  }, [preset.bucketMinutes]);

  const timelineTicks = useMemo(() => makeTimelineTicks(scale, preset), [scale, preset]);
  
  const centerMinute = TOTAL_MINUTES - preset.windowMinutes / 2;
  
  const readoutXOffset = preset.windowMinutes * 0.018;

  const buildScene = useCallback((engine: LunaTerraEngine): LTElement => {
    const group = new GroupElement();
    let visibleCenter = centerMinute;
    const minValue = interpolateBucketValue(aggregated.buckets, centerMinute, 'minTemp');
    const maxValue = interpolateBucketValue(aggregated.buckets, centerMinute, 'maxTemp');

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
        xMin: centerMinute - preset.windowMinutes / 2,
        xMax: centerMinute + preset.windowMinutes / 2,
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
      },
    });
    group.appendChild(chartFrame);

    const rangeFill = new RangeFill({
      minData: aggregated.minLine,
      maxData: aggregated.maxLine,
      colorPath: 'chart.series.secondary',
      opacity: 0.16,
    });
    chartFrame.appendChild(rangeFill);

    const minLine = new LineSeries({ data: aggregated.minLine, lineWidth: 1.1 });
    minLine.styles.color = themeColor('chart.series.secondary');
    minLine.styles.opacity = 0.62;
    chartFrame.appendChild(minLine);

    const maxLine = new LineSeries({ data: aggregated.maxLine, lineWidth: 1.6 });
    maxLine.styles.color = themeColor('chart.series.secondary');
    chartFrame.appendChild(maxLine);

    const crosshair = new Crosshair({
      xMin: 0,
      xMax: TOTAL_MINUTES,
      followPointer: false,
      showXLabel: false,
      yMin: FILL_BASELINE,
      yMax: CHART_TOP,
      series: [aggregated.minLine, aggregated.maxLine],
      formatXLabel: (x) => formatCursorLabel(x),
    });
    crosshair.styles.color = themeColor('chart.widget.title');
    crosshair.styles.opacity = 0.58;
    crosshair.setValue(centerMinute);
    chartFrame.appendChild(crosshair);

    const maxLabel = new TextElement({ text: `max ${formatTemperature(maxValue)}`, fontSize: 10, align: 'left', baseline: 'middle' });
    maxLabel.position = new V2(centerMinute + readoutXOffset, interpolateSeriesY(aggregated.maxLine, centerMinute) + LABEL_Y_OFFSET);
    maxLabel.styles.color = themeColor('chart.series.secondary');
    chartFrame.appendChild(maxLabel);

    const minLabel = new TextElement({ text: `min ${formatTemperature(minValue)}`, fontSize: 10, align: 'left', baseline: 'middle' });
    minLabel.position = new V2(centerMinute + readoutXOffset, interpolateSeriesY(aggregated.minLine, centerMinute) - LABEL_Y_OFFSET);
    minLabel.styles.color = themeColor('chart.series.secondary');
    minLabel.styles.opacity = 0.74;
    chartFrame.appendChild(minLabel);

    const clampCenter = (minute: number) => Math.max(
      preset.windowMinutes / 2,
      Math.min(minute, TOTAL_MINUTES - preset.windowMinutes / 2),
    );

    const updateVisibleWindow = (minute: number) => {
      visibleCenter = clampCenter(minute);
      chartFrame.options.worldBounds = {
        xMin: visibleCenter - preset.windowMinutes / 2,
        xMax: visibleCenter + preset.windowMinutes / 2,
        yMin: FILL_BASELINE,
        yMax: CHART_TOP,
      };

      const currentMin = interpolateBucketValue(aggregated.buckets, visibleCenter, 'minTemp');
      const currentMax = interpolateBucketValue(aggregated.buckets, visibleCenter, 'maxTemp');
      minLabel.options.text = `min ${formatTemperature(currentMin)}`;
      maxLabel.options.text = `max ${formatTemperature(currentMax)}`;
      minLabel.position = new V2(
        visibleCenter + readoutXOffset,
        interpolateSeriesY(aggregated.minLine, visibleCenter) - LABEL_Y_OFFSET,
      );
      maxLabel.position = new V2(
        visibleCenter + readoutXOffset,
        interpolateSeriesY(aggregated.maxLine, visibleCenter) + LABEL_Y_OFFSET,
      );
      crosshair.setValue(visibleCenter);
      engine.requestUpdate();
    };

    const ruler = new ScaleRuler({
      ticks: timelineTicks,
      value: centerMinute,
      sticky: false,
      interactionMode: 'scroll-scale',
      formatValue: (value) => formatCursorLabel(value),
      badgePosition: 'below',
      onChange: (minute) => {
        updateVisibleWindow(minute);
      },
    });
    group.appendChild(ruler);

    engine.interactive = false;
    engine.add(group);
    updateVisibleWindow(centerMinute);
    engine.requestUpdate();
    return group;
  }, [aggregated, centerMinute, preset.windowMinutes, timelineTicks, readoutXOffset]);

  return (
    <DocPage title="Charts/Home Assistant" section="@lunaterra/charts">
      <DocPage.Section id="home-assistant" title="Home Assistant Climate History">
        <p>
          Switch between week, multi-day, and hourly views while keeping the chart in the same fixed viewport.
          Drag the ruler at the bottom to scrub through time.
        </p>
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.keys(SCALE_PRESETS) as ScaleKey[]).map((key) => (
              <Button
                key={key}
                variant={key === scale ? 'solid' : 'secondary'}
                onClick={() => setScale(key)}
              >
                {SCALE_PRESETS[key].label}
              </Button>
            ))}
          </div>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={{}}
            source={`// Fixed chart viewport with switchable time windows\n// Drag the ruler to scrub through time`}
            canvasHeight={230}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}
