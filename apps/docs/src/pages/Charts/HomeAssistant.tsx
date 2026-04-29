import { Rect2D, V2 } from '@lunaterra/math';
import { LunaTerraEngine, LTElement, themeColor } from '@lunaterra/core';
import { Crosshair, LineSeries } from '@lunaterra/charts';
import { TextElement } from '@lunaterra/elements';
import { ScaleRuler } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Data: 24h temperature (°C) and humidity (%) ────────────────────────────

const TEMP_RAW = [
  21, 20, 19.5, 19, 19, 19.5, 20, 21, 22.5, 24, 25.5, 26.5,
  27, 27.5, 28, 27.5, 27, 26, 25, 24, 23, 22.5, 22, 21.5,
];
const HUMIDITY_RAW = [
  62, 65, 68, 70, 71, 70, 68, 65, 61, 57, 54, 51,
  49, 47, 46, 47, 49, 52, 55, 58, 60, 62, 63, 63,
];

// Combined Y normalization: map the full sensor range to world 0→1
const Y_DATA_MIN = 15;
const Y_DATA_MAX = 75;
const Y_RANGE = Y_DATA_MAX - Y_DATA_MIN;
const CHART_BASELINE = 0.14;
const FILL_BASELINE = CHART_BASELINE - 0.035;
const CHART_TOP = 0.9;
const DATA_FLOOR = CHART_BASELINE + 0.08;
const TIMELINE_MAX_HOUR = TEMP_RAW.length - 1;
const VISIBLE_HOURS = 6;
const INITIAL_CENTER_HOUR = TIMELINE_MAX_HOUR - VISIBLE_HOURS / 2;
const MIN_CENTER_HOUR = VISIBLE_HOURS / 2;
const MAX_CENTER_HOUR = TIMELINE_MAX_HOUR - VISIBLE_HOURS / 2;
const normY = (y: number) =>
  DATA_FLOOR + ((y - Y_DATA_MIN) / Y_RANGE) * (CHART_TOP - DATA_FLOOR);

function makeSeriesData(rawY: number[]) {
  return rawY.map((y, i) => ({
    x: i,
    y: normY(y),
  }));
}

function formatHour(value: number): string {
  const totalMinutes = Math.round(value * 60);
  const wrappedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function makeTimelineTicks() {
  const ticks = [] as Array<{ value: number; label: string }>;
  const firstHour = Math.ceil(MIN_CENTER_HOUR / 4) * 4;
  for (let hour = firstHour; hour <= MAX_CENTER_HOUR; hour += 4) {
    ticks.push({ value: hour, label: formatHour(hour) });
  }
  return ticks;
}

const TIMELINE_TICKS = makeTimelineTicks();
const HISTORY_BOUNDS = new Rect2D(new V2(0, 0), new V2(TIMELINE_MAX_HOUR, 1));
const INITIAL_VIEW = new Rect2D(
  new V2(INITIAL_CENTER_HOUR - VISIBLE_HOURS / 2, FILL_BASELINE - 0.14),
  new V2(INITIAL_CENTER_HOUR + VISIBLE_HOURS / 2, CHART_TOP + 0.05),
);

// ── Scene ────────────────────────────────────────────────────────────────────

type SceneConfig = Record<string, number>;
const sceneDefaults: SceneConfig = {};

const SCENE_CODE = `
// Compact home-assistant-style history chart.
// Data spans the last 24 hours; the viewport only shows a 6-hour slice.
// A bottom ScaleRuler runs in scroll-scale mode and directly scrubs history.

// Room title — top-left corner
const title = new TextElement({ text: 'guest room', fontSize: 10, align: 'left', baseline: 'top' });
title.position = new V2(0, 0.98);
title.styles.color = themeColor('chart.widget.title');
group.appendChild(title);

// Active timeline label — top-right corner
const timeLabel = new TextElement({ text: formatHour(INITIAL_CENTER_HOUR), fontSize: 10, align: 'right', baseline: 'top' });
timeLabel.position = new V2(TIMELINE_MAX_HOUR, 0.98);
timeLabel.styles.color = themeColor('chart.widget.title');
group.appendChild(timeLabel);

// Temperature series — orange, fading fill
const temp = new LineSeries({ data: tempData, lineWidth: 1.5, fillOpacity: 0.4, yFillTo: FILL_BASELINE });
temp.styles.color = themeColor('chart.series.secondary');
group.appendChild(temp);

// Humidity series — blue, fading fill
const humidity = new LineSeries({ data: humData, lineWidth: 1.5, fillOpacity: 0.28, yFillTo: FILL_BASELINE });
humidity.styles.color = themeColor('chart.series.primary');
group.appendChild(humidity);

const crosshair = new Crosshair({
  xMin: 0,
  xMax: TIMELINE_MAX_HOUR,
  followPointer: false,
  showXLabel: false,
  yMin: FILL_BASELINE,
  yMax: CHART_TOP,
  series: [tempData, humData],
  formatXLabel: (x) => formatHour(x),
});
crosshair.styles.color = themeColor('chart.widget.title');
crosshair.styles.opacity = 0.7;
crosshair.setValue(INITIAL_CENTER_HOUR);
group.appendChild(crosshair);

const ruler = new ScaleRuler({
  ticks: TIMELINE_TICKS,
  value: INITIAL_CENTER_HOUR,
  sticky: false,
  interactionMode: 'scroll-scale',
  formatValue: (value) => formatHour(value),
  badgePosition: 'below',
  onChange: (hour) => {
    timeLabel.options.text = formatHour(hour);
    crosshair.setValue(hour);
    engine.moveViewportTo(new V2(hour, engine.viewportCenter.y));
  },
});
group.appendChild(ruler);

engine.scrollBounds = HISTORY_BOUNDS;
engine.zoomToRect(INITIAL_VIEW, 0.96);
`.trim();

function buildScene(engine: LunaTerraEngine, _config: SceneConfig): LTElement {
  const tempData = makeSeriesData(TEMP_RAW);
  const humData = makeSeriesData(HUMIDITY_RAW);

  const group = new GroupElement();

  // Room title — top-left
  const title = new TextElement({ text: 'guest room', fontSize: 10, align: 'left', baseline: 'top' });
  title.position = new V2(0, 0.98);
  title.styles.color = themeColor('chart.widget.title');
  group.appendChild(title);

  const timeLabel = new TextElement({ text: formatHour(INITIAL_CENTER_HOUR), fontSize: 10, align: 'right', baseline: 'top' });
  timeLabel.position = new V2(TIMELINE_MAX_HOUR, 0.98);
  timeLabel.styles.color = themeColor('chart.widget.title');
  group.appendChild(timeLabel);

  // Temperature — orange with gradient fill
  const temp = new LineSeries({ data: tempData, lineWidth: 1.5, fillOpacity: 0.4, yFillTo: FILL_BASELINE });
  temp.styles.color = themeColor('chart.series.secondary');
  group.appendChild(temp);

  // Humidity — blue with gradient fill
  const humidity = new LineSeries({ data: humData, lineWidth: 1.5, fillOpacity: 0.28, yFillTo: FILL_BASELINE });
  humidity.styles.color = themeColor('chart.series.primary');
  group.appendChild(humidity);

  const crosshair = new Crosshair({
    xMin: 0,
    xMax: TIMELINE_MAX_HOUR,
    followPointer: false,
    showXLabel: false,
    yMin: FILL_BASELINE,
    yMax: CHART_TOP,
    series: [tempData, humData],
    formatXLabel: (x) => formatHour(x),
  });
  crosshair.styles.color = themeColor('chart.widget.title');
  crosshair.styles.opacity = 0.7;
  crosshair.setValue(INITIAL_CENTER_HOUR);
  group.appendChild(crosshair);

  const ruler = new ScaleRuler({
    ticks: TIMELINE_TICKS,
    value: INITIAL_CENTER_HOUR,
    sticky: false,
    interactionMode: 'scroll-scale',
    formatValue: (value) => formatHour(value),
    badgePosition: 'below',
    onChange: (hour) => {
      timeLabel.options.text = formatHour(hour);
      crosshair.setValue(hour);
      engine.moveViewportTo(new V2(hour, engine.viewportCenter.y));
    },
  });
  group.appendChild(ruler);

  engine.scrollBounds = HISTORY_BOUNDS;
  engine.interactive = false;
  engine.add(group);
  engine.zoomToRect(INITIAL_VIEW, 0.96);
  engine.requestUpdate();
  return group;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomeAssistantPage() {
  return (
    <DocPage title="Charts/Home Assistant" section="@lunaterra/charts">
      <DocPage.Section id="home-assistant" title="Home Assistant Widget">
        <p>
          A compact sensor history widget styled after home-automation dashboards. The scene
          keeps a 24-hour temperature and humidity trace in world space, but the viewport only
          shows a 6-hour slice at once.
        </p>
        <p>
          The bottom <code>ScaleRuler</code> runs in <code>scroll-scale</code> mode with a
          time formatter, so dragging it scrubs the entire chart left and right through history.
          The vertical readout is synchronized with the ruler caret, so the same gesture moves
          both the chart viewport and the chart value indicator.
        </p>
        <p>
          Both <code>LineSeries</code> use <code>fillOpacity</code> to draw a vertically-fading
          gradient area down to a hidden fill floor below the data, leaving more separation
          between the chart and the timeline UI.
        </p>
        <div style={{ maxWidth: 420 }}>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={sceneDefaults}
            source={SCENE_CODE}
            canvasHeight={190}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}
