import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import {
  LunaTerraEngine,
  LTElement,
  LTStyledElement,
  Handle,
  RadiusConstraint,
  LinearConstraint,
  type CanvasRenderer,
} from '@lunaterra/core';
import { Line } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

class StyledGroup extends LTStyledElement<{}, {}> {
  protected defaultOptions() { return {}; }
  render(_renderer: CanvasRenderer) {}
}

// ── Scene 1: RadiusConstraint — handle locked to a circle ─────────────────

type Scene1Config = {
  radius: number;
};

const scene1Defaults: Scene1Config = { radius: 0.3 };

const SCENE1_CODE = `
const CENTER = new V2(0.5, 0.5);

// Guide circle
const circle = new Line({
  points: Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(
      CENTER.x + Math.cos(a) * /*@live:radius:0.1:0.45*/0.3,
      CENTER.y + Math.sin(a) * /*@live:radius:0.1:0.45*/0.3,
    );
  }),
});
circle.styles.color = new Color(60, 60, 60);
circle.styles.opacity = 0.25;
root.appendChild(circle);

// Handle constrained to the circle
const handle = new Handle(
  new V2(CENTER.x + radius, CENTER.y),
  {
    constraints: [new RadiusConstraint(CENTER, radius)],
    onDrag: (p) => { arm.options.points = [CENTER, p]; },
  }
);
handle.styles.color = new Color(80, 160, 240);
root.appendChild(handle);

// Arm line from center to handle
const arm = new Line({ points: [CENTER, handle.position] });
arm.styles.color = new Color(80, 160, 240);
arm.styles.opacity = 0.5;
root.appendChild(arm);

engine.activateInteraction();
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const { radius } = config;
  const CENTER = new V2(0.5, 0.5);
  const root = new GroupElement();

  // Guide circle (faint)
  const circlePoints = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(CENTER.x + Math.cos(a) * radius, CENTER.y + Math.sin(a) * radius);
  });
  const circle = new Line({ points: circlePoints });
  circle.styles.color = new Color(60, 60, 60);
  circle.styles.opacity = 0.25;
  root.appendChild(circle);

  // Arm from center to handle
  const initialPos = new V2(CENTER.x + radius, CENTER.y);
  const arm = new Line({ points: [CENTER, initialPos] });
  arm.styles.color = new Color(80, 160, 240);
  arm.styles.opacity = 0.5;
  root.appendChild(arm);

  // Handle — constrained to the circle
  const handle = new Handle(initialPos, {
    constraints: [new RadiusConstraint(CENTER, radius)],
    onDrag: (p) => { arm.options.points = [CENTER, p]; },
  });
  handle.styles.color = new Color(80, 160, 240);
  root.appendChild(handle);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Scene 2: LinearConstraint (clamped) — slider ──────────────────────────

type Scene2Config = {
  minVal: number;
  maxVal: number;
};

const scene2Defaults: Scene2Config = { minVal: 0, maxVal: 15 };

const SCENE2_CODE = `
const START = new V2(0.15, 0.5);
const END   = new V2(0.85, 0.5);

// Track
const track = new Line({ points: [START, END] });
track.styles.color = new Color(80, 80, 80);
track.styles.opacity = 0.35;
root.appendChild(track);

// Handle — clamped to the segment (like a slider 0–15)
const handle = new Handle(
  V2.average(START, END),
  {
    constraints: [new LinearConstraint(START, END, { clamp: true })],
    onDrag: (p) => {
      const t = (p.x - START.x) / (END.x - START.x);
      const value = /*@live:minVal:0:10*/0 + t * (/*@live:maxVal:5:30*/15 - /*@live:minVal:0:10*/0);
      label.options.text = value.toFixed(1);
    },
  }
);
handle.styles.color = new Color(80, 200, 130);
root.appendChild(handle);

engine.activateInteraction();
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const { minVal, maxVal } = config;
  const START = new V2(0.15, 0.5);
  const END = new V2(0.85, 0.5);
  const root = new GroupElement();

  const track = new Line({ points: [START, END] });
  track.styles.color = new Color(80, 80, 80);
  track.styles.opacity = 0.35;
  root.appendChild(track);

  // Label showing current value — use a Line as a text carrier via a helper element
  const labelGroup = new (class extends LTStyledElement<{ text: string }, {}> {
    protected defaultOptions() { return { text: '' }; }
    render(renderer: CanvasRenderer) {
      const { color } = this.computedStyles;
      renderer.draw(color, 1).renderText(this.options.text, new V2(0, 0), 13, 'center', 'bottom');
    }
  })({ text: ((minVal + maxVal) / 2).toFixed(1) });
  labelGroup.styles.color = new Color(200, 200, 200);
  labelGroup.position = new V2(0.5, 0.42);
  root.appendChild(labelGroup);

  const handlePos = V2.average(START, END);
  const handle = new Handle(handlePos, {
    constraints: [new LinearConstraint(START, END, { clamp: true })],
    onDrag: (p) => {
      const t = (p.x - START.x) / (END.x - START.x);
      const value = minVal + t * (maxVal - minVal);
      labelGroup.options.text = value.toFixed(1);
      labelGroup.position = new V2(p.x, 0.42);
    },
  });
  handle.styles.color = new Color(80, 200, 130);
  root.appendChild(handle);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Scene 3: Dynamic linear constraint — line between two free handles ─────

type Scene3Config = Record<string, never>;
const scene3Defaults: Scene3Config = {};

const SCENE3_CODE = `
// Two free handles define the line; a third is constrained to it.
// Move the endpoints — the constraint updates live.

const handleA = new Handle(new V2(0.2, 0.3));
handleA.styles.color = new Color(240, 140, 60);
root.appendChild(handleA);

const handleB = new Handle(new V2(0.8, 0.7));
handleB.styles.color = new Color(240, 140, 60);
root.appendChild(handleB);

// Connector line (visual only)
const connector = new Line({ points: [handleA.position, handleB.position] });
connector.styles.color = new Color(240, 140, 60);
connector.styles.opacity = 0.3;
root.appendChild(connector);

// Constrained handle — tracks the line between A and B dynamically
const constrained = new Handle(
  V2.average(handleA.position, handleB.position),
  {
    constraints: [
      new LinearConstraint(
        () => handleA.position,
        () => handleB.position,
      ),
    ],
    onDrag: () => {
      connector.options.points = [handleA.position, handleB.position];
    },
  }
);
constrained.styles.color = new Color(100, 200, 255);
root.appendChild(constrained);

// Keep connector in sync when endpoints move
handleA.options.onDrag = () => {
  connector.options.points = [handleA.position, handleB.position];
};
handleB.options.onDrag = () => {
  connector.options.points = [handleA.position, handleB.position];
};

engine.activateInteraction();
`.trim();

function buildScene3(engine: LunaTerraEngine, _config: Scene3Config): LTElement {
  const root = new GroupElement();

  const handleA = new Handle(new V2(0.2, 0.3));
  handleA.styles.color = new Color(240, 140, 60);
  root.appendChild(handleA);

  const handleB = new Handle(new V2(0.8, 0.7));
  handleB.styles.color = new Color(240, 140, 60);
  root.appendChild(handleB);

  const connector = new Line({ points: [handleA.position, handleB.position] });
  connector.styles.color = new Color(240, 140, 60);
  connector.styles.opacity = 0.3;
  root.appendChild(connector);

  const constrained = new Handle(
    V2.average(handleA.position, handleB.position),
    {
      constraints: [
        new LinearConstraint(
          () => handleA.position,
          () => handleB.position,
        ),
      ],
      onDrag: () => {
        connector.options.points = [handleA.position, handleB.position];
      },
    },
  );
  constrained.styles.color = new Color(100, 200, 255);
  root.appendChild(constrained);

  handleA.options.onDrag = () => {
    connector.options.points = [handleA.position, handleB.position];
  };
  handleB.options.onDrag = () => {
    connector.options.points = [handleA.position, handleB.position];
  };

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Scene 4: V-shape — non-horizontal baseline ────────────────────────────
// The reference arm points at 20° (slightly above horizontal-right).
// The handle starts at 40° so the arc shows 20°.
// Demonstrates that `angleTowards` can be any direction, not just "horizontal".

type Scene4Config = Record<string, never>;
const scene4Defaults: Scene4Config = {};

const SCENE4_CODE = `
// Reference arm at 20° — this becomes the "zero line" the arc is measured from.
const CENTER = new V2(0.5, 0.5);
const RADIUS = 0.28;
const BASE_DEG = 20;
const BASE_RAD = BASE_DEG * (Math.PI / 180);

// Guide circle (faint)
const circle = new Line({
  points: Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(CENTER.x + Math.cos(a) * RADIUS, CENTER.y + Math.sin(a) * RADIUS);
  }),
});
circle.styles.color = new Color(60, 60, 60);
circle.styles.opacity = 0.2;
root.appendChild(circle);

// Reference arm (the fixed "zero" ray)
const refPoint = new V2(CENTER.x + Math.cos(BASE_RAD) * RADIUS, CENTER.y + Math.sin(BASE_RAD) * RADIUS);
const refArm = new Line({ points: [CENTER, refPoint] });
refArm.styles.color = new Color(255, 160, 60);
refArm.styles.opacity = 0.6;
root.appendChild(refArm);

// Handle arm
const initAngle = BASE_RAD + 40 * (Math.PI / 180);
const initPos = new V2(CENTER.x + Math.cos(initAngle) * RADIUS, CENTER.y + Math.sin(initAngle) * RADIUS);
const handleArm = new Line({ points: [CENTER, initPos] });
handleArm.styles.color = new Color(80, 160, 240);
handleArm.styles.opacity = 0.6;
root.appendChild(handleArm);

// Handle — arc measured from the orange reference arm
const handle = new Handle(initPos, {
  constraints: [new RadiusConstraint(CENTER, RADIUS, { angleTowards: refPoint })],
  onDrag: (p) => { handleArm.options.points = [CENTER, p]; },
});
handle.styles.color = new Color(80, 160, 240);
root.appendChild(handle);

engine.activateInteraction();
`.trim();

function buildScene4(engine: LunaTerraEngine, _config: Scene4Config): LTElement {
  const root = new GroupElement();
  const CENTER = new V2(0.5, 0.5);
  const RADIUS = 0.28;
  const BASE_DEG = 20;
  const BASE_RAD = BASE_DEG * (Math.PI / 180);

  const circlePoints = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(CENTER.x + Math.cos(a) * RADIUS, CENTER.y + Math.sin(a) * RADIUS);
  });
  const circle = new Line({ points: circlePoints });
  circle.styles.color = new Color(60, 60, 60);
  circle.styles.opacity = 0.2;
  root.appendChild(circle);

  const refPoint = new V2(CENTER.x + Math.cos(BASE_RAD) * RADIUS, CENTER.y + Math.sin(BASE_RAD) * RADIUS);
  const refArm = new Line({ points: [CENTER, refPoint] });
  refArm.styles.color = new Color(255, 160, 60);
  refArm.styles.opacity = 0.6;
  root.appendChild(refArm);

  const initAngle = BASE_RAD + 40 * (Math.PI / 180);
  const initPos = new V2(CENTER.x + Math.cos(initAngle) * RADIUS, CENTER.y + Math.sin(initAngle) * RADIUS);
  const handleArm = new Line({ points: [CENTER, initPos] });
  handleArm.styles.color = new Color(80, 160, 240);
  handleArm.styles.opacity = 0.6;
  root.appendChild(handleArm);

  const handle = new Handle(initPos, {
    constraints: [new RadiusConstraint(CENTER, RADIUS, { angleTowards: refPoint })],
    onDrag: (p) => { handleArm.options.points = [CENTER, p]; },
  });
  handle.styles.color = new Color(80, 160, 240);
  root.appendChild(handle);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Scene 5: baseAngle — delta label ("30.0° (+10.0°)") ──────────────────
// Handle starts at 20°. The constraint is told baseAngle: 20 so the label
// reads current°  (+delta°) as you drag it away from the baseline.

type Scene5Config = Record<string, never>;
const scene5Defaults: Scene5Config = {};

const SCENE5_CODE = `
const CENTER = new V2(0.5, 0.5);
const RADIUS = 0.28;
const BASE_DEG = 20;
const BASE_RAD = BASE_DEG * (Math.PI / 180);

// Guide circle
const circle = new Line({
  points: Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(CENTER.x + Math.cos(a) * RADIUS, CENTER.y + Math.sin(a) * RADIUS);
  }),
});
circle.styles.color = new Color(60, 60, 60);
circle.styles.opacity = 0.2;
root.appendChild(circle);

// Static arm — the "20 degree" baseline
const basePos = new V2(CENTER.x + Math.cos(BASE_RAD) * RADIUS, CENTER.y + Math.sin(BASE_RAD) * RADIUS);
const baseArm = new Line({ points: [CENTER, basePos] });
baseArm.styles.color = new Color(180, 180, 180);
baseArm.styles.opacity = 0.4;
root.appendChild(baseArm);

// Moving arm
const arm = new Line({ points: [CENTER, basePos.clone()] });
arm.styles.color = new Color(80, 160, 240);
arm.styles.opacity = 0.6;
root.appendChild(arm);

// Handle — arc from horizontal, labelled as "Xdeg (+Ydeg from 20deg)"
const handle = new Handle(basePos.clone(), {
  constraints: [
    new RadiusConstraint(CENTER, RADIUS, {
      angleTowards: 'horizontal',
      baseAngle: BASE_DEG,
    }),
  ],
  onDrag: (p) => { arm.options.points = [CENTER, p]; },
});
handle.styles.color = new Color(80, 160, 240);
root.appendChild(handle);

engine.activateInteraction();
`.trim();

function buildScene5(engine: LunaTerraEngine, _config: Scene5Config): LTElement {
  const root = new GroupElement();
  const CENTER = new V2(0.5, 0.5);
  const RADIUS = 0.28;
  const BASE_DEG = 20;
  const BASE_RAD = BASE_DEG * (Math.PI / 180);

  const circlePoints = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return new V2(CENTER.x + Math.cos(a) * RADIUS, CENTER.y + Math.sin(a) * RADIUS);
  });
  const circle = new Line({ points: circlePoints });
  circle.styles.color = new Color(60, 60, 60);
  circle.styles.opacity = 0.2;
  root.appendChild(circle);

  const basePos = new V2(CENTER.x + Math.cos(BASE_RAD) * RADIUS, CENTER.y + Math.sin(BASE_RAD) * RADIUS);
  const baseArm = new Line({ points: [CENTER, basePos] });
  baseArm.styles.color = new Color(180, 180, 180);
  baseArm.styles.opacity = 0.4;
  root.appendChild(baseArm);

  const handleInitPos = new V2(basePos.x, basePos.y);
  const arm = new Line({ points: [CENTER, handleInitPos] });
  arm.styles.color = new Color(80, 160, 240);
  arm.styles.opacity = 0.6;
  root.appendChild(arm);

  const handle = new Handle(handleInitPos, {
    constraints: [new RadiusConstraint(CENTER, RADIUS, { angleTowards: 'horizontal', baseAngle: BASE_DEG })],
    onDrag: (p) => { arm.options.points = [CENTER, p]; },
  });
  handle.styles.color = new Color(80, 160, 240);
  root.appendChild(handle);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ConstraintsPage() {
  return (
    <DocPage title="Core/Constraints" section="@lunaterra/core">
      <DocPage.Section id="radius" title="RadiusConstraint">
        <p>
          Constrains a <code>Handle</code> to move on a circle of fixed radius
          around a center point. Drag the handle — it snaps to the arc.
          Hover or start dragging to reveal the angle arc visual with live degree
          readout. The radius can be static or a <code>{'() => number'}</code>{' '}
          getter for dynamic values.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={380}
        />
      </DocPage.Section>

      <DocPage.Section id="linear-clamp" title="LinearConstraint (clamped)">
        <p>
          Constrains a <code>Handle</code> to slide along a segment — useful for
          range sliders, scrubbers, or any value with a min/max. Pass{' '}
          <code>{'{ clamp: true }'}</code> to keep the handle between the two
          endpoints. The dashed guide line fades in near the drag point.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={280}
        />
      </DocPage.Section>

      <DocPage.Section id="angled-baseline" title="Non-horizontal Baseline">
        <p>
          <code>angleTowards</code> can be any <code>V2</code> (or{' '}
          <code>{'() => V2'}</code>), not just <code>'horizontal'</code>. Here
          the orange arm fixes the reference at 20° — the arc and readout
          measure rotation relative to that arm, not the X axis. This is useful
          for V-shapes, bevels, or any case where &quot;zero&quot; isn't
          horizontal.
        </p>
        <LiveCodeScene
          buildScene={buildScene4}
          defaultConfig={scene4Defaults}
          source={SCENE4_CODE}
          canvasHeight={360}
        />
      </DocPage.Section>

      <DocPage.Section id="base-angle" title="Delta Label (baseAngle)">
        <p>
          Pass <code>baseAngle</code> (in degrees) to show a delta alongside the
          absolute angle. The label becomes{' '}
          <code>30.0° (+10.0°)</code> when you've rotated 10° past the 20°
          baseline. Useful for &quot;angle from nominal&quot; UI patterns.
        </p>
        <LiveCodeScene
          buildScene={buildScene5}
          defaultConfig={scene5Defaults}
          source={SCENE5_CODE}
          canvasHeight={360}
        />
      </DocPage.Section>

      <DocPage.Section id="dynamic-endpoints" title="Dynamic Endpoints">
        <p>
          Both <code>RadiusConstraint</code> and <code>LinearConstraint</code>{' '}
          accept <code>{'() => V2'}</code> getters instead of plain{' '}
          <code>V2</code> values, so constraints can track other live elements.
          Here the orange handles define a line; the blue handle is constrained
          to stay on it — move the endpoints and the constraint updates in real
          time.
        </p>
        <LiveCodeScene
          buildScene={buildScene3}
          defaultConfig={scene3Defaults}
          source={SCENE3_CODE}
          canvasHeight={380}
        />
      </DocPage.Section>
    </DocPage>
  );
}
