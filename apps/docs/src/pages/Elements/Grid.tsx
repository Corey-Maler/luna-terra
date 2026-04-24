import { Rect2D, V2 } from '@lunaterra/math';
import { LunaTerraEngine, LTElement, themeColor } from '@lunaterra/core';
import { Grid, GridMode, Line, RectElement } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

class GroupElement extends LTElement<object> {
  protected defaultOptions() { return {}; }
}

const GRID_SCROLL_BOUNDS = new Rect2D(new V2(-3, -3), new V2(3, 3));

type Scene1Config = {
  density: number;
  lineWidth: number;
};

const scene1Defaults: Scene1Config = {
  density: 0,
  lineWidth: 1,
};

const SCENE1_CODE = `
// Adaptive line grid in world space.
const grid = new Grid({
  mode: GridMode.LINES,
  density: /*@live:density:0:1*/0,
  lineWidth: /*@live:lineWidth:1:3*/1,
  subgridColor: themeColor('math.grid.minor'),
});
grid.styles.color = themeColor('math.grid.major');

const frame = new RectElement({
  width: 0.42,
  height: 0.28,
  cornerRadius: 0.03,
  fillColor: null,
  stroke: true,
  lineWidth: 1.5,
});
frame.position = new V2(0.29, 0.36);
frame.styles.color = themeColor('math.rect.primary');
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const grid = new Grid({
    mode: GridMode.LINES,
    density: config.density,
    lineWidth: config.lineWidth,
    subgridColor: themeColor('math.grid.minor'),
  });
  grid.styles.color = themeColor('math.grid.major');
  root.appendChild(grid);

  const xAxis = new Line({
    points: [new V2(0.08, 0.5), new V2(0.92, 0.5)],
    endMarker: { shape: 'arrow', size: 0.025 },
  }, { lineWidth: 1.5 });
  xAxis.styles.color = themeColor('math.axis');
  root.appendChild(xAxis);

  const yAxis = new Line({
    points: [new V2(0.5, 0.92), new V2(0.5, 0.08)],
    endMarker: { shape: 'arrow', size: 0.025 },
  }, { lineWidth: 1.5 });
  yAxis.styles.color = themeColor('math.axis');
  root.appendChild(yAxis);

  const frame = new RectElement({
    width: 0.42,
    height: 0.28,
    cornerRadius: 0.03,
    fillColor: null,
    stroke: true,
    lineWidth: 1.5,
  });
  frame.position = new V2(0.29, 0.36);
  frame.styles.color = themeColor('math.rect.primary');
  root.appendChild(frame);

  engine.add(root);
  engine.requestUpdate();
  return root;
}

type Scene2Config = {
  density: number;
  dotSize: number;
};

const scene2Defaults: Scene2Config = {
  density: 1,
  dotSize: 3,
};

const SCENE2_CODE = `
// Dot mode uses the WebGL grid path.
const grid = new Grid({
  mode: GridMode.DOTS,
  density: /*@live:density:0:1*/1,
  dotSize: /*@live:dotSize:1:6*/3,
  subgridColor: themeColor('math.gridDots.minor'),
});
grid.styles.color = themeColor('math.gridDots.major');

const route = new Line({
  points: [
    new V2(0.12, 0.2),
    new V2(0.3, 0.42),
    new V2(0.56, 0.34),
    new V2(0.82, 0.72),
  ],
  cornerRadius: 0.04,
  endMarker: { shape: 'arrow', size: 0.03 },
}, { lineWidth: 2 });
route.styles.color = themeColor('math.rect.secondary');
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const grid = new Grid({
    mode: GridMode.DOTS,
    density: config.density,
    dotSize: config.dotSize,
    subgridColor: themeColor('math.gridDots.minor'),
  });
  grid.styles.color = themeColor('math.gridDots.major');
  root.appendChild(grid);

  const route = new Line({
    points: [
      new V2(0.12, 0.2),
      new V2(0.3, 0.42),
      new V2(0.56, 0.34),
      new V2(0.82, 0.72),
    ],
    cornerRadius: 0.04,
    endMarker: { shape: 'arrow', size: 0.03 },
  }, { lineWidth: 2 });
  route.styles.color = themeColor('math.rect.secondary');
  root.appendChild(route);

  engine.add(root);
  engine.requestUpdate();
  return root;
}

type Scene3Config = {
  density: number;
};

const scene3Defaults: Scene3Config = {
  density: 1,
};

const SCENE3_CODE = `
// Denser grid mode for tighter drafting guides.
const grid = new Grid({
  mode: GridMode.LINES,
  density: /*@live:density:0:1*/1,
  subgridColor: themeColor('math.grid.minor'),
});
grid.styles.color = themeColor('math.grid.major');
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const grid = new Grid({
    mode: GridMode.LINES,
    density: config.density,
    subgridColor: themeColor('math.grid.minor'),
  });
  grid.styles.color = themeColor('math.grid.major');
  root.appendChild(grid);

  const focus = new RectElement({
    width: 0.22,
    height: 0.22,
    cornerRadius: 0.02,
    fillColor: null,
    stroke: true,
    lineWidth: 1.5,
  });
  focus.position = new V2(0.39, 0.39);
  focus.styles.color = themeColor('math.rect.primary');
  root.appendChild(focus);

  engine.add(root);
  engine.requestUpdate();
  return root;
}

export default function GridPage() {
  return (
    <DocPage title="Elements/Grid" section="@lunaterra/elements">
      <DocPage.Section id="adaptive-lines" title="Adaptive Lines">
        <p>
          Grid renders in world space and automatically picks major and minor spacing
          from the current visible area. The major and minor colors can come from the
          active drawing theme instead of being hard-coded into the element.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={420}
          scrollBounds={GRID_SCROLL_BOUNDS}
        />
      </DocPage.Section>

      <DocPage.Section id="dot-mode" title="Dot Mode">
        <p>
          Dot mode uses the WebGL grid shader for dense drafting backdrops. Major and
          minor dots share the same adaptive spacing logic as line mode, but now both
          colors stay theme-aware.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={420}
          scrollBounds={GRID_SCROLL_BOUNDS}
        />
      </DocPage.Section>

      <DocPage.Section id="density-theme" title="Density & Theme">
        <p>
          Set <code>density</code> above zero to bias the grid toward tighter major steps.
          Use the zoom controls or mouse wheel to inspect how the subgrid fades in and out
          as the visible range changes.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={420}
          scrollBounds={GRID_SCROLL_BOUNDS}
        />
      </DocPage.Section>
    </DocPage>
  );
}