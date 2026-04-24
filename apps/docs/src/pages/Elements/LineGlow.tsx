import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement } from '@lunaterra/core';
import { Line } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Glowing pipes ─────────────────────────────────────────────────

type Scene1Config = {
  glowRadius: number;
  glowIntensity: number;
  flowSpeed: number;
  particleDensity: number;
  hotColor: Color;
  coldColor: Color;
};

const scene1Defaults: Scene1Config = {
  glowRadius: 0.02,
  glowIntensity: 0.2,
  flowSpeed: 0.15,
  particleDensity: 150,
  hotColor: new Color(255, 60, 30),
  coldColor: new Color(30, 120, 255),
};

const SCENE1_CODE = `
// Hot pipe (red glow, flowing energy)
const hotPipe = new Line({
  points: [
    new V2(0.05, 0.3),
    new V2(0.35, 0.3),
    new V2(0.35, 0.6),
    new V2(0.65, 0.6),
  ],
  cornerRadius: 0.04,
  glow: { radius: /*@live:glowRadius:0.01:0.08*/0.03, intensity: /*@live:glowIntensity:0.05:1*/0.33 },
  flow: { speed: /*@live:flowSpeed:0:3*/0.8, frequency: 0, particleDensity: /*@live:particleDensity:10:250*/150 },
});
hotPipe.styles.color = /*@color:hotColor*/hotColor;

// Cold pipe (blue glow, flowing energy)
const coldPipe = new Line({
  points: [
    new V2(0.05, 0.7),
    new V2(0.35, 0.7),
    new V2(0.35, 0.4),
    new V2(0.65, 0.4),
  ],
  cornerRadius: 0.04,
  glow: { radius: glowRadius, intensity: glowIntensity },
  flow: { speed: flowSpeed, frequency: 0, particleDensity },
});
coldPipe.styles.color = /*@color:coldColor*/coldColor;
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const hotPipe = new Line({
    points: [
      new V2(0.05, 0.3),
      new V2(0.35, 0.3),
      new V2(0.35, 0.6),
      new V2(0.65, 0.6),
    ],
    cornerRadius: 0.04,
    glow: { radius: config.glowRadius, intensity: config.glowIntensity },
    flow: { speed: config.flowSpeed, frequency: 0, particleDensity: config.particleDensity },
  }, { lineWidth: 2 });
  hotPipe.styles.color = config.hotColor;
  root.appendChild(hotPipe);

  const coldPipe = new Line({
    points: [
      new V2(0.05, 0.7),
      new V2(0.35, 0.7),
      new V2(0.35, 0.4),
      new V2(0.65, 0.4),
    ],
    cornerRadius: 0.04,
    glow: { radius: config.glowRadius, intensity: config.glowIntensity },
    flow: { speed: config.flowSpeed, frequency: 0, particleDensity: config.particleDensity },
  }, { lineWidth: 2 });
  coldPipe.styles.color = config.coldColor;
  root.appendChild(coldPipe);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Active / inactive wires ───────────────────────────────────────

type Scene2Config = {
  glowRadius: number;
  glowIntensity: number;
  flowSpeed: number;
  particleDensity: number;
  activeColor: Color;
};

const scene2Defaults: Scene2Config = {
  glowRadius: 0.025,
  glowIntensity: 0.33,
  flowSpeed: 1.2,
  particleDensity: 10,
  activeColor: new Color(100, 255, 80),
};

const SCENE2_CODE = `
// Active wire with glow + flow
const activeWire = new Line({
  points: [new V2(0.1, 0.35), new V2(0.5, 0.15), new V2(0.9, 0.35)],
  cornerRadius: 0.03,
  glow: { radius: /*@live:glowRadius:0.01:0.06*/0.025, intensity: /*@live:glowIntensity:0.05:1*/0.33 },
  flow: { speed: /*@live:flowSpeed:0:3*/1.2, frequency: 0, particleDensity: /*@live:particleDensity:1:50*/10 },
});
activeWire.styles.color = /*@color:activeColor*/activeColor;

// Inactive wire — no glow, muted colour
const inactiveWire = new Line({
  points: [new V2(0.1, 0.65), new V2(0.5, 0.85), new V2(0.9, 0.65)],
  cornerRadius: 0.03,
});
inactiveWire.styles.color = new Color(120, 120, 120);
inactiveWire.styles.opacity = 0.5;
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const activeWire = new Line({
    points: [new V2(0.1, 0.35), new V2(0.5, 0.15), new V2(0.9, 0.35)],
    cornerRadius: 0.03,
    glow: { radius: config.glowRadius, intensity: config.glowIntensity },
    flow: { speed: config.flowSpeed, frequency: 0, particleDensity: config.particleDensity },
  }, { lineWidth: 2 });
  activeWire.styles.color = config.activeColor;
  root.appendChild(activeWire);

  const inactiveWire = new Line({
    points: [new V2(0.1, 0.65), new V2(0.5, 0.85), new V2(0.9, 0.65)],
    cornerRadius: 0.03,
  }, { lineWidth: 2 });
  inactiveWire.styles.color = new Color(120, 120, 120);
  inactiveWire.styles.opacity = 0.5;
  root.appendChild(inactiveWire);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Bézier glow ──────────────────────────────────────────────────

type Scene3Config = {
  glowRadius: number;
  glowIntensity: number;
  flowSpeed: number;
  particleDensity: number;
  color: Color;
};

const scene3Defaults: Scene3Config = {
  glowRadius: 0.035,
  glowIntensity: 0.33,
  flowSpeed: 0.6,
  particleDensity: 10,
  color: new Color(180, 60, 220),
};

const SCENE3_CODE = `
// Cubic Bézier with glow
const curve = new Line({
  points: [
    new V2(0.1, 0.5),
    { to: new V2(0.5, 0.5), cubic: [new V2(0.2, 0.1), new V2(0.4, 0.9)] },
    { to: new V2(0.9, 0.5), cubic: [new V2(0.6, 0.1), new V2(0.8, 0.9)] },
  ],
  glow: { radius: /*@live:glowRadius:0.01:0.08*/0.035, intensity: /*@live:glowIntensity:0.05:1*/0.33 },
  flow: { speed: /*@live:flowSpeed:0:3*/0.6, frequency: 0, particleDensity: /*@live:particleDensity:1:50*/10 },
  endMarker: { shape: 'arrow', size: 0.03 },
});
curve.styles.color = /*@color:color*/color;
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  const curve = new Line({
    points: [
      new V2(0.1, 0.5),
      { to: new V2(0.5, 0.5), cubic: [new V2(0.2, 0.1), new V2(0.4, 0.9)] },
      { to: new V2(0.9, 0.5), cubic: [new V2(0.6, 0.1), new V2(0.8, 0.9)] },
    ],
    glow: { radius: config.glowRadius, intensity: config.glowIntensity },
    flow: { speed: config.flowSpeed, frequency: 0, particleDensity: config.particleDensity },
    endMarker: { shape: 'arrow', size: 0.03 },
  }, { lineWidth: 2 });
  curve.styles.color = config.color;
  root.appendChild(curve);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LineGlowPage() {
  return (
    <DocPage title="Elements/Glow & Energy" section="@lunaterra/elements">
      <DocPage.Section id="pipes" title="Glowing Pipes">
        <p>
          SDF-based WebGL glow with particle-stream animation. Red = hot pipe,
          blue = cold pipe. The glow renders on the WebGL layer behind the
          Canvas2D line for crisp edges with smooth falloff.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="wires" title="Active vs Inactive Wires">
        <p>
          Toggle between active (glowing, animated) and inactive (muted, static)
          wires — useful for electrical diagrams or home automation UIs.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="bezier-glow" title="Bézier Glow">
        <p>
          Glow works on Bézier curves too — the path is tessellated before
          being sent to the glow shader, so any path shape gets a smooth glow.
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
