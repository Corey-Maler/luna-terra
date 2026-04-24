import { V2 } from '@lunaterra/math';
import { LunaTerraEngine, LTElement, themeColor } from '@lunaterra/core';
import { Axis, LineSeries } from '@lunaterra/charts';
import { TextElement } from '@lunaterra/elements';
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
const normY = (y: number) => (y - Y_DATA_MIN) / Y_RANGE;

function makeSeriesData(rawY: number[], worldW: number) {
  return rawY.map((y, i) => ({
    x: (i / (rawY.length - 1)) * worldW,
    y: normY(y),
  }));
}

// ── Scene ────────────────────────────────────────────────────────────────────

type SceneConfig = Record<string, number>;
const sceneDefaults: SceneConfig = {};

const SCENE_CODE = `
// Compact home-assistant sensor widget
// Y data is normalized to 0→1 using the combined sensor range (15–75).
// X data is scaled by the canvas aspect ratio so the chart fills the width.

// WORLD_W = canvas aspect ratio (e.g. ~3.5 for a 420×120 canvas)

// Big current-value watermark — appended FIRST so it renders behind the chart
const bigVal = new TextElement({ text: '26°C', fontSize: 138, align: 'right', baseline: 'middle' });
bigVal.position = new V2(WORLD_W, 0.5);
bigVal.styles.color = themeColor('chart.widget.watermark');
bigVal.styles.opacity = 0.13;
group.appendChild(bigVal);

// Room title — top-left corner
const title = new TextElement({ text: 'guest room', fontSize: 10, align: 'left', baseline: 'top' });
title.position = new V2(0, 0.98);
title.styles.color = themeColor('chart.widget.title');
group.appendChild(title);

// Bottom-pinned baseline (no arrows, no tick labels)
const axis = new Axis({ xMin: 0, xMax: WORLD_W, yMin: 0, yMax: 1,
  xAxisY: 0, yAxisX: 0, showArrows: false, showX: true, showY: false, xTicks: [] });
axis.styles.color = themeColor('chart.widget.baseline');
group.appendChild(axis);

// Temperature series — orange, fading fill
const temp = new LineSeries({ data: tempData, lineWidth: 1.5, fillOpacity: 0.4, yFillTo: 0 });
temp.styles.color = themeColor('chart.series.secondary');
group.appendChild(temp);

// Humidity series — blue, fading fill
const humidity = new LineSeries({ data: humData, lineWidth: 1.5, fillOpacity: 0.28, yFillTo: 0 });
humidity.styles.color = themeColor('chart.series.primary');
group.appendChild(humidity);

engine.zoomToRect(new Rect2D(new V2(0, -0.05), new V2(WORLD_W, 1.08)), 0.98);
`.trim();

function buildScene(engine: LunaTerraEngine, _config: SceneConfig): LTElement {
  // The canvas itself is `position:absolute` with no CSS size until the ResizeObserver
  // fires (asynchronously, AFTER this useEffect runs). Measuring the canvas directly
  // returns the HTML default 300×150. Instead measure the rootDiv (the engine's flex
  // container) which has the correct layout dimensions immediately after mount.
  const rootDiv = engine.renderer.canvas.parentElement!;
  const cr = rootDiv.getBoundingClientRect();
  const WORLD_W = cr.height > 4 ? Math.max(cr.width / cr.height, 1) : 3.5;

  const tempData = makeSeriesData(TEMP_RAW, WORLD_W);
  const humData = makeSeriesData(HUMIDITY_RAW, WORLD_W);

  const group = new GroupElement();

  // Big value watermark — first child → renders behind everything
  const bigVal = new TextElement({ text: '26°C', fontSize: 138, align: 'right', baseline: 'middle' });
  bigVal.position = new V2(WORLD_W, 0.5);
  bigVal.styles.color = themeColor('chart.widget.watermark');
  bigVal.styles.opacity = 0.13;
  group.appendChild(bigVal);

  // Room title — top-left
  const title = new TextElement({ text: 'guest room', fontSize: 10, align: 'left', baseline: 'top' });
  title.position = new V2(0, 0.98);
  title.styles.color = themeColor('chart.widget.title');
  group.appendChild(title);

  // Bottom-pinned baseline only (no arrows, no tick labels)
  const axis = new Axis({
    xMin: 0, xMax: WORLD_W,
    yMin: 0, yMax: 1,
    xAxisY: 0, yAxisX: 0,
    showArrows: false, showX: true, showY: false,
    xTicks: [],
  });
  axis.styles.color = themeColor('chart.widget.baseline');
  group.appendChild(axis);

  // Temperature — orange with gradient fill
  const temp = new LineSeries({ data: tempData, lineWidth: 1.5, fillOpacity: 0.4, yFillTo: 0 });
  temp.styles.color = themeColor('chart.series.secondary');
  group.appendChild(temp);

  // Humidity — blue with gradient fill
  const humidity = new LineSeries({ data: humData, lineWidth: 1.5, fillOpacity: 0.28, yFillTo: 0 });
  humidity.styles.color = themeColor('chart.series.primary');
  group.appendChild(humidity);

  engine.interactive = false;
  engine.add(group);
  engine.requestUpdate();
  return group;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomeAssistantPage() {
  return (
    <DocPage title="Charts/Home Assistant" section="@lunaterra/charts">
      <DocPage.Section id="home-assistant" title="Home Assistant Widget">
        <p>
          A compact sensor widget styled after home-automation dashboards. The chart adapts
          its world width to the canvas aspect ratio so the data always fills the viewport.
          Y data is normalized to a shared 0→1 range (sensor values 15–75).
        </p>
        <p>
          The large "26°C" is a world-space <code>TextElement</code> anchored to the right
          edge with <code>align: 'right'</code>, appended first so it renders behind the
          data lines. Both <code>LineSeries</code> use <code>fillOpacity</code> to draw a
          vertically-fading gradient area below each line down to the baseline.
        </p>
        <div style={{ maxWidth: 420 }}>
          <LiveCodeScene
            buildScene={buildScene}
            defaultConfig={sceneDefaults}
            source={SCENE_CODE}
            canvasHeight={120}
            zoom={false}
            scrollBounds={null}
          />
        </div>
      </DocPage.Section>
    </DocPage>
  );
}
