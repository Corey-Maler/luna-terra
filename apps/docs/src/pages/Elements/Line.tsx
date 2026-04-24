import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, type CanvasRenderer } from '@lunaterra/core';
import { Line } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Basic polyline with rounded corners ───────────────────────────

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
// Basic polyline with rounded corners
const line = new Line({
  points: [
    new V2(0.1, 0.2),
    new V2(0.3, 0.8),
    new V2(0.5, 0.3),
    new V2(0.7, 0.7),
    new V2(0.9, 0.2),
  ],
  cornerRadius: /*@live:cornerRadius:0:0.15*/0.04,
});
line.styles.color = new Color(/*@live:r:0:255*/60, /*@live:g:0:255*/130, /*@live:b:0:255*/220);
line.styles.lineWidth = /*@live:lineWidth:1:6*/2;
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const line = new Line({
    points: [
      new V2(0.1, 0.2),
      new V2(0.3, 0.8),
      new V2(0.5, 0.3),
      new V2(0.7, 0.7),
      new V2(0.9, 0.2),
    ],
    cornerRadius: config.cornerRadius,
  }, {
    lineWidth: config.lineWidth,
  });
  line.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(line);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Bézier curves ─────────────────────────────────────────────────

type Scene2Config = {
  cpX: number; cpY: number;
  r: number; g: number; b: number;
};

const scene2Defaults: Scene2Config = {
  cpX: 0.2, cpY: 0.9,
  r: 200, g: 60, b: 120,
};

const SCENE2_CODE = `
// Quadratic & cubic Bézier segments
const line = new Line({
  points: [
    new V2(0.1, 0.5),
    // Quadratic Bézier to (0.5, 0.5) via control (cpX, cpY)
    { to: new V2(0.5, 0.5), quadratic: new V2(cpX, cpY) },
    // Cubic Bézier to (0.9, 0.5)
    { to: new V2(0.9, 0.5), cubic: [new V2(0.6, 0.1), new V2(0.8, 0.9)] },
  ],
});
line.styles.color = new Color(/*@live:r:0:255*/200, /*@live:g:0:255*/60, /*@live:b:0:255*/120);
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const line = new Line({
    points: [
      new V2(0.1, 0.5),
      { to: new V2(0.5, 0.5), quadratic: new V2(config.cpX, config.cpY) },
      { to: new V2(0.9, 0.5), cubic: [new V2(0.6, 0.1), new V2(0.8, 0.9)] },
    ],
  }, {
    lineWidth: 2,
  });
  line.styles.color = new Color(config.r, config.g, config.b);
  root.appendChild(line);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Closed shape with rounded corners ─────────────────────────────

type Scene3Config = {
  cornerRadius: number;
  r: number; g: number; b: number;
  opacity: number;
};

const scene3Defaults: Scene3Config = {
  cornerRadius: 0.05,
  r: 50, g: 180, b: 100,
  opacity: 0.8,
};

const SCENE3_CODE = `
// Closed pentagon with rounded corners
const line = new Line({
  points: pentagon(0.5, 0.5, 0.3),  // helper generates 5 vertices
  cornerRadius: /*@live:cornerRadius:0:0.2*/0.05,
  closed: true,
});
line.styles.color = new Color(/*@live:r:0:255*/50, /*@live:g:0:255*/180, /*@live:b:0:255*/100);
line.styles.opacity = /*@live:opacity:0:1*/0.8;
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  // Generate pentagon vertices
  const cx = 0.5, cy = 0.5, radius = 0.3;
  const pts: V2[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    pts.push(new V2(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
  }

  const line = new Line({
    points: pts,
    cornerRadius: config.cornerRadius,
    closed: true,
  }, {
    lineWidth: 2,
  });
  line.styles.color = new Color(config.r, config.g, config.b);
  line.styles.opacity = config.opacity;
  root.appendChild(line);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LinePage() {
  return (
    <DocPage title="Elements/Line" section="@lunaterra/elements">
      <DocPage.Section id="basic" title="Basic Polyline">
        <p>
          A multi-point polyline with configurable corner rounding.
          Drag the numbers in the code to adjust parameters in real time.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="bezier" title="Bézier Curves">
        <p>
          Line supports quadratic and cubic Bézier segments alongside
          straight segments. Mix them freely in a single path.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="closed" title="Closed Shape">
        <p>
          Set <code>closed: true</code> to connect the last point back to the first.
          Corner rounding applies to every vertex in a closed path.
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
