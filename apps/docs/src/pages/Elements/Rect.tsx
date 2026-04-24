import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement } from '@lunaterra/core';
import { RectElement } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Fill + stroke ─────────────────────────────────────────────────

type Scene1Config = {
  cornerRadius: number;
  r: number; g: number; b: number;
  lineWidth: number;
};

const scene1Defaults: Scene1Config = {
  cornerRadius: 0.04,
  r: 60, g: 130, b: 220,
  lineWidth: 2,
};

const SCENE1_CODE = `
// Filled rect with rounded corners and a stroke border.
// Position is set via element.position (centre by default is origin).
const rect = new RectElement({
  width: 0.5,
  height: 0.3,
  cornerRadius: /*@live:cornerRadius:0:0.15*/0.04,
  fillColor: 'rgba(60, 130, 220, 0.25)',
  stroke: true,
  lineWidth: /*@live:lineWidth:1:6*/2,
});
rect.position = new V2(0.25, 0.35);
rect.styles.color = new Color(/*@live:r:0:255*/60, /*@live:g:0:255*/130, /*@live:b:0:255*/220);
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const rect = new RectElement({
    width: 0.5,
    height: 0.3,
    cornerRadius: config.cornerRadius,
    fillColor: `rgba(${config.r}, ${config.g}, ${config.b}, 0.25)`,
    stroke: true,
    lineWidth: config.lineWidth,
  });
  rect.position = new V2(0.25, 0.35);
  rect.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(rect);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Stroke-only ───────────────────────────────────────────────────

type Scene2Config = {
  cornerRadius: number;
  width: number;
  height: number;
  lineWidth: number;
  r: number; g: number; b: number;
};

const scene2Defaults: Scene2Config = {
  cornerRadius: 0.06,
  width: 0.4,
  height: 0.4,
  lineWidth: 2,
  r: 220, g: 90, b: 60,
};

const SCENE2_CODE = `
// Stroke-only rect — no fill, just a border.
const rect = new RectElement({
  width: /*@live:width:0.1:0.8*/0.4,
  height: /*@live:height:0.1:0.8*/0.4,
  cornerRadius: /*@live:cornerRadius:0:0.2*/0.06,
  fillColor: null,
  stroke: true,
  lineWidth: /*@live:lineWidth:1:8*/2,
});
rect.position = new V2(0.3, 0.3);
rect.styles.color = new Color(/*@live:r:0:255*/220, /*@live:g:0:255*/90, /*@live:b:0:255*/60);
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const rect = new RectElement({
    width: config.width,
    height: config.height,
    cornerRadius: config.cornerRadius,
    fillColor: null,
    stroke: true,
    lineWidth: config.lineWidth,
  });
  rect.position = new V2((1 - config.width) / 2, (1 - config.height) / 2);
  rect.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(rect);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Composition / layering ───────────────────────────────────────

type Scene3Config = {
  cornerRadius: number;
  opacity: number;
};

const scene3Defaults: Scene3Config = {
  cornerRadius: 0.03,
  opacity: 0.7,
};

const SCENE3_CODE = `
// Multiple rects at different positions — use element.position to place them.
const colors = [
  new Color(80, 160, 255),
  new Color(255, 100, 80),
  new Color(80, 220, 130),
  new Color(200, 140, 255),
];

for (let i = 0; i < 4; i++) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const rect = new RectElement({
    width: 0.35,
    height: 0.3,
    cornerRadius: /*@live:cornerRadius:0:0.12*/0.03,
    fillColor: colors[i].toRgbaString(0.25),
    stroke: true,
    lineWidth: 1.5,
  });
  rect.position = new V2(0.08 + col * 0.48, 0.1 + row * 0.42);
  rect.styles.color = colors[i];
  rect.styles.opacity = /*@live:opacity:0.1:1*/0.7;
  root.appendChild(rect);
}
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const colors = [
    new Color(80, 160, 255),
    new Color(255, 100, 80),
    new Color(80, 220, 130),
    new Color(200, 140, 255),
  ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rect = new RectElement({
      width: 0.35,
      height: 0.3,
      cornerRadius: config.cornerRadius,
      fillColor: new Color(colors[i].r, colors[i].g, colors[i].b, 0.25).toString(),
      stroke: true,
      lineWidth: 1.5,
    });
    rect.position = new V2(0.08 + col * 0.48, 0.1 + row * 0.42);
    rect.styles.color = colors[i];
    rect.styles.opacity = config.opacity;
    root.appendChild(rect);
  }

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RectPage() {
  return (
    <DocPage title="Elements/Rect" section="@lunaterra/elements">
      <DocPage.Section id="fill-stroke" title="Fill & Stroke">
        <p>
          A rectangle with optional fill and border. Set <code>cornerRadius</code> for
          rounded corners — clamped automatically to half the shortest side so it never
          looks odd at extreme values. Stroke color comes from the element's{' '}
          <code>styles.color</code> hierarchy.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="stroke-only" title="Stroke Only">
        <p>
          Set <code>fillColor: null</code> to draw only the border. Use{' '}
          <code>lineWidth</code> to control stroke thickness in screen pixels.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="composition" title="Composition">
        <p>
          Position rects anywhere in the canvas coordinate space via{' '}
          <code>element.position</code>. Opacity is inherited through the style
          hierarchy and multiplies through the element tree.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>
    </DocPage>
  );
}
