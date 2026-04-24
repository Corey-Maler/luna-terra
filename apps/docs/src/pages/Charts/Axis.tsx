import { Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, themeColor } from '@lunaterra/core';
import { Axis, FunctionPlot, LineSeries, Crosshair } from '@lunaterra/charts';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Basic axes ────────────────────────────────────────────────────

type Scene1Config = {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  tickCount: number;
};

const scene1Defaults: Scene1Config = {
  xMin: -0.4, xMax: 0.4,
  yMin: -0.4, yMax: 0.4,
  tickCount: 5,
};

const SCENE1_CODE = `
// World space is 0–1. Place axes anywhere within it.
const axis = new Axis({
  xMin: /*@live:xMin:-0.8:0*/-0.4,
  xMax: /*@live:xMax:0:0.8*/0.4,
  yMin: /*@live:yMin:-0.8:0*/-0.4,
  yMax: /*@live:yMax:0:0.8*/0.4,
  tickCount: /*@live:tickCount:2:10*/5,
});
axis.styles.color = themeColor('chart.axis');
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({
    xMin: config.xMin,
    xMax: config.xMax,
    yMin: config.yMin,
    yMax: config.yMax,
    tickCount: config.tickCount,
  });
  axis.styles.color = themeColor('chart.axis');
  root.appendChild(axis);

  const crosshair = new Crosshair({
    xMin: config.xMin, xMax: config.xMax,
    yMin: config.yMin, yMax: config.yMax,
  });
  crosshair.styles.color = themeColor('chart.crosshair');
  root.appendChild(crosshair);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(config.xMin, config.yMin), new V2(config.xMax, config.yMax)), 0.75);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Function plot ─────────────────────────────────────────────────

type Scene2Config = {
  samples: number;
  r: number; g: number; b: number;
};

const scene2Defaults: Scene2Config = {
  samples: 200,
  r: 74, g: 158, b: 255,
};

const SCENE2_CODE = `
const axis = new Axis({ xMin: -0.45, xMax: 0.45, yMin: -0.45, yMax: 0.45 });
axis.styles.color = themeColor('chart.axis');

// sin wave stretched to fill the domain
const sineCurve = new FunctionPlot({
  fn: (x) => Math.sin(x * Math.PI * 5) * 0.3,
  xMin: -0.45, xMax: 0.45,
  samples: /*@live:samples:10:400*/200,
  lineWidth: 1.5,
});
sineCurve.styles.color = new Color(/*@live:r:0:255*/74, /*@live:g:0:255*/158, /*@live:b:0:255*/255);

// x² parabola scaled to world space
const parabola = new FunctionPlot({
  fn: (x) => x * x * 2,
  xMin: -0.45, xMax: 0.45,
  lineWidth: 1.5,
});
parabola.styles.color = themeColor('chart.series.secondary');
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: -0.45, xMax: 0.45, yMin: -0.45, yMax: 0.45 });
  axis.styles.color = themeColor('chart.axis');
  root.appendChild(axis);

  const sineCurve = new FunctionPlot({
    fn: (x) => Math.sin(x * Math.PI * 5) * 0.3,
    xMin: -0.45,
    xMax: 0.45,
    samples: config.samples,
    lineWidth: 1.5,
  });
  sineCurve.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(sineCurve);

  const parabola = new FunctionPlot({
    fn: (x) => x * x * 2,
    xMin: -0.45,
    xMax: 0.45,
    lineWidth: 1.5,
  });
  parabola.styles.color = themeColor('chart.series.secondary');
  root.appendChild(parabola);

  const crosshair = new Crosshair({ xMin: -0.45, xMax: 0.45, yMin: -0.45, yMax: 0.45,
    fns: [
      (x) => Math.sin(x * Math.PI * 5) * 0.3,
      (x) => x * x * 2,
    ],
  });
  crosshair.styles.color = themeColor('chart.crosshair');
  root.appendChild(crosshair);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(-0.45, -0.45), new V2(0.45, 0.45)), 0.75);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Line series ───────────────────────────────────────────────────

type Scene3Config = {
  r: number; g: number; b: number;
  lineWidth: number;
};

const scene3Defaults: Scene3Config = {
  r: 100, g: 220, b: 120,
  lineWidth: 2,
};

const SAMPLE_DATA = [
  { x: 0.05, y: 0.12 }, { x: 0.15, y: 0.28 }, { x: 0.22, y: 0.22 },
  { x: 0.32, y: 0.42 }, { x: 0.40, y: 0.35 }, { x: 0.50, y: 0.52 },
  { x: 0.58, y: 0.45 }, { x: 0.65, y: 0.60 }, { x: 0.74, y: 0.55 },
  { x: 0.82, y: 0.65 }, { x: 0.88, y: 0.62 },
];

const SCENE3_CODE = `
const axis = new Axis({ xMin: 0, xMax: 0.9, yMin: 0, yMax: 0.75 });
axis.styles.color = themeColor('chart.axis');

const data = [
  { x: 0.05, y: 0.12 }, { x: 0.15, y: 0.28 }, { x: 0.22, y: 0.22 },
  { x: 0.32, y: 0.42 }, { x: 0.40, y: 0.35 }, { x: 0.50, y: 0.52 },
  { x: 0.58, y: 0.45 }, { x: 0.65, y: 0.60 }, { x: 0.74, y: 0.55 },
  { x: 0.82, y: 0.65 }, { x: 0.88, y: 0.62 },
];

const series = new LineSeries({
  data,
  lineWidth: /*@live:lineWidth:1:5*/2,
});
series.styles.color = new Color(/*@live:r:0:255*/100, /*@live:g:0:255*/220, /*@live:b:0:255*/120);
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({ xMin: 0, xMax: 0.9, yMin: 0, yMax: 0.75 });
  axis.styles.color = themeColor('chart.axis');
  root.appendChild(axis);

  const series = new LineSeries({ data: SAMPLE_DATA, lineWidth: config.lineWidth });
  series.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(series);

  const crosshair = new Crosshair({ xMin: 0, xMax: 0.9, yMin: 0, yMax: 0.75,
    series: [SAMPLE_DATA],
  });
  crosshair.styles.color = themeColor('chart.crosshair');
  root.appendChild(crosshair);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(0, 0), new V2(0.9, 0.75)), 0.75);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ChartsAxisPage() {
  return (
    <DocPage title="Charts/Axis" section="@lunaterra/charts">
      <DocPage.Section id="axis" title="Axis">
        <p>
          The <code>Axis</code> element draws X and Y axes in world space (0–1 by
          default). Tick marks and labels are generated automatically via d3-scale.
          Pass <code>xTicks</code> / <code>yTicks</code> to override positions.
          Pan and zoom the canvas to explore.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="function-plot" title="Function Plot">
        <p>
          <code>FunctionPlot</code> evaluates <code>fn(x)</code> across the given
          X domain. Discontinuities (NaN, ±Infinity) automatically split the path,
          so functions like <code>tan(x)</code> render correctly. Multiple plots
          can share the same axis.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={440}
          scrollBounds={null}
        />
      </DocPage.Section>

      <DocPage.Section id="line-series" title="Line Series">
        <p>
          <code>LineSeries</code> connects an array of <code>{`{ x, y }`}</code>{' '}
          data points with a polyline in world space. Position the axis domain to
          match the data range.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={440}
          scrollBounds={null}
        />
      </DocPage.Section>
    </DocPage>
  );
}
