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

// ── Scene 1: Interactive arrow with draggable endpoints ────────────────────

type Scene1Config = {
  lineWidth: number;
};

const scene1Defaults: Scene1Config = {
  lineWidth: 2,
};

const SCENE1_CODE = `
// Interactive line with arrow markers — drag the points!
const arrow = new Line({
  points: [
    new V2(0.2, 0.3),
    new V2(0.5, 0.7),
    new V2(0.8, 0.4),
  ],
  endMarker: { shape: 'arrow', size: 0.025 },
  interactive: true,
});
arrow.styles.lineWidth = /*@live:lineWidth:1:6*/2;
arrow.styles.color = new Color(56, 130, 240);

engine.activateInteraction();
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const arrow = new Line({
    points: [
      new V2(0.2, 0.3),
      new V2(0.5, 0.7),
      new V2(0.8, 0.4),
    ],
    endMarker: { shape: 'arrow', size: 0.025 },
    interactive: true,
  }, { lineWidth: config.lineWidth });
  arrow.styles.color = new Color(56, 130, 240);
  root.appendChild(arrow);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Multiple interactive lines ────────────────────────────────────

type Scene2Config = {
  cornerRadius: number;
};

const scene2Defaults: Scene2Config = {
  cornerRadius: 0.03,
};

const SCENE2_CODE = `
// Multiple interactive lines with different styles
const line1 = new Line({
  points: [
    new V2(0.1, 0.5),
    new V2(0.3, 0.2),
    new V2(0.5, 0.5),
  ],
  cornerRadius: /*@live:cornerRadius:0:0.1*/0.03,
  startMarker: { shape: 'circle', size: 0.015 },
  endMarker: { shape: 'arrow', size: 0.02 },
  interactive: true,
});
line1.styles.color = new Color(220, 60, 80);

const line2 = new Line({
  points: [
    new V2(0.5, 0.5),
    new V2(0.7, 0.8),
    new V2(0.9, 0.5),
  ],
  endMarker: { shape: 'triangle', size: 0.02 },
  interactive: true,
});
line2.styles.color = new Color(60, 180, 100);
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();

  const line1 = new Line({
    points: [
      new V2(0.1, 0.5),
      new V2(0.3, 0.2),
      new V2(0.5, 0.5),
    ],
    cornerRadius: config.cornerRadius,
    startMarker: { shape: 'circle', size: 0.015 },
    endMarker: { shape: 'arrow', size: 0.02 },
    interactive: true,
  }, { lineWidth: 2 });
  line1.styles.color = new Color(220, 60, 80);
  root.appendChild(line1);

  const line2 = new Line({
    points: [
      new V2(0.5, 0.5),
      new V2(0.7, 0.8),
      new V2(0.9, 0.5),
    ],
    endMarker: { shape: 'triangle', size: 0.02 },
    interactive: true,
  }, { lineWidth: 2 });
  line2.styles.color = new Color(60, 180, 100);
  root.appendChild(line2);

  engine.interactive = false;
  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Page ────────────────────────────────────────────────────────────────────────────────────

type Scene3Config = {
  lineWidth: number;
};

const scene3Defaults: Scene3Config = {
  lineWidth: 2,
};

const SCENE3_CODE = `
// Disable canvas pan/zoom so drag gestures go to elements, not the camera
engine.interactive = false;

const line1 = new Line({
  points: [new V2(0.15, 0.3), new V2(0.5, 0.65), new V2(0.85, 0.3)],
  endMarker: { shape: 'arrow', size: 0.025 },
  interactive: true,
});
line1.styles.lineWidth = /*@live:lineWidth:1:6*/2;
line1.styles.color = new Color(56, 130, 240);

const line2 = new Line({
  points: [new V2(0.15, 0.7), new V2(0.5, 0.35), new V2(0.85, 0.7)],
  startMarker: { shape: 'circle', size: 0.015 },
  endMarker: { shape: 'arrow', size: 0.025 },
  interactive: true,
});
line2.styles.lineWidth = lineWidth;
line2.styles.color = new Color(220, 80, 60);

engine.activateInteraction();
`.trim();

function buildScene3(engine: LunaTerraEngine, config: Scene3Config): LTElement {
  const root = new GroupElement();

  // Disable canvas pan — drag gestures go to element handles only
  engine.interactive = false;

  const line1 = new Line({
    points: [new V2(0.15, 0.3), new V2(0.5, 0.65), new V2(0.85, 0.3)],
    endMarker: { shape: 'arrow', size: 0.025 },
    interactive: true,
  }, { lineWidth: config.lineWidth });
  line1.styles.color = new Color(56, 130, 240);
  root.appendChild(line1);

  const line2 = new Line({
    points: [new V2(0.15, 0.7), new V2(0.5, 0.35), new V2(0.85, 0.7)],
    startMarker: { shape: 'circle', size: 0.015 },
    endMarker: { shape: 'arrow', size: 0.025 },
    interactive: true,
  }, { lineWidth: config.lineWidth });
  line2.styles.color = new Color(220, 80, 60);
  root.appendChild(line2);

  engine.add(root);
  engine.activateInteraction();
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function InteractiveLinePage() {
  return (
    <DocPage title="Elements/Interactive" section="@lunaterra/elements">
      <DocPage.Section id="draggable-arrow" title="Draggable Arrow">
        <p>
          Hover near the line's control points — handles fade in based on
          proximity. Click and drag a handle to reshape the line in real time.
          The arrow marker follows the endpoint automatically.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="multiple-lines" title="Multiple Interactive Lines">
        <p>
          Multiple lines with independent draggable points. Each line's handles
          are registered with the same interaction manager. The closest handle
          always wins when handles overlap.
        </p>
        <LiveCodeScene
          buildScene={buildScene2}
          defaultConfig={scene2Defaults}
          source={SCENE2_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>
    </DocPage>
  );
}
