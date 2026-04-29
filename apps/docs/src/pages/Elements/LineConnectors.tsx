import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import { Line, type MarkerOptions } from '@lunaterra/elements';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

/** Simple filled rectangle element for diagram boxes. */
class BoxElement extends LTStyledElement<{ w: number; h: number }> {
  protected defaultOptions() { return { w: 0.12, h: 0.06 }; }

  render(renderer: CanvasRenderer) {
    const { color, opacity } = this.computedStyles;
    const { w, h } = this.options;
    const hw = w / 2, hh = h / 2;

    const tl = new V2(-hw, -hh);
    const tr = new V2(hw, -hh);
    const br = new V2(hw, hh);
    const bl = new V2(-hw, hh);

    const fill = renderer.draw(color.opaque(opacity * 0.15), 1);
    fill.path([tl, tr, br, bl, tl]);
    fill.fill(color.opaque(opacity * 0.15));

    const stroke = renderer.draw(color.opaque(opacity), 1);
    stroke.path([tl, tr, br, bl, tl]);
    stroke.stroke();
  }
}

// ── Scene 1: Arrows ────────────────────────────────────────────────────────

type Scene1Config = {
  markerSize: number;
  r: number; g: number; b: number;
};

const scene1Defaults: Scene1Config = {
  markerSize: 0.03,
  r: 60, g: 130, b: 220,
};

const SCENE1_CODE = `
// One-way arrow
const arrow1 = new Line({
  points: [new V2(0.1, 0.3), new V2(0.5, 0.3)],
  endMarker: { shape: 'arrow', size: /*@live:markerSize:0.01:0.08*/0.03 },
});

// Two-way arrow
const arrow2 = new Line({
  points: [new V2(0.1, 0.5), new V2(0.5, 0.5)],
  startMarker: { shape: 'arrow', size: markerSize },
  endMarker: { shape: 'arrow', size: markerSize },
});

// Diamond ends
const arrow3 = new Line({
  points: [new V2(0.1, 0.7), new V2(0.5, 0.7)],
  startMarker: { shape: 'diamond', size: markerSize },
  endMarker: { shape: 'diamond', size: markerSize },
});

// Circle + arrow
const arrow4 = new Line({
  points: [new V2(0.55, 0.3), new V2(0.9, 0.3)],
  startMarker: { shape: 'circle', size: markerSize },
  endMarker: { shape: 'arrow', size: markerSize },
});

line.styles.color = new Color(/*@live:r:0:255*/60, /*@live:g:0:255*/130, /*@live:b:0:255*/220);
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();
  const color = new Color(config.r, config.g, config.b);

  const makeArrow = (pts: V2[], start: MarkerOptions | null, end: MarkerOptions | null) => {
    const line = new Line({ points: pts, startMarker: start, endMarker: end }, { lineWidth: 2 });
    line.styles.color = color;
    root.appendChild(line);
  };

  const ms = config.markerSize;

  // One-way arrow
  makeArrow([new V2(0.1, 0.3), new V2(0.5, 0.3)], null, { shape: 'arrow', size: ms });
  // Two-way arrow
  makeArrow([new V2(0.1, 0.5), new V2(0.5, 0.5)], { shape: 'arrow', size: ms }, { shape: 'arrow', size: ms });
  // Diamonds
  makeArrow([new V2(0.1, 0.7), new V2(0.5, 0.7)], { shape: 'diamond', size: ms }, { shape: 'diamond', size: ms });
  // Circle→arrow
  makeArrow([new V2(0.55, 0.3), new V2(0.9, 0.3)], { shape: 'circle', size: ms }, { shape: 'arrow', size: ms });
  // Square→triangle
  makeArrow([new V2(0.55, 0.5), new V2(0.9, 0.5)], { shape: 'square', size: ms }, { shape: 'triangle', size: ms });

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Scene 2: Diagram boxes connected by lines ──────────────────────────────

type Scene2Config = {
  cornerRadius: number;
  r: number; g: number; b: number;
};

const scene2Defaults: Scene2Config = {
  cornerRadius: 0.03,
  r: 80, g: 80, b: 180,
};

const SCENE2_CODE = `
// Two boxes connected by a right-angle connector with arrow
const boxA = new BoxElement({ w: 0.14, h: 0.07 });
boxA.position = new V2(0.25, 0.5);

const boxB = new BoxElement({ w: 0.14, h: 0.07 });
boxB.position = new V2(0.75, 0.5);

const connector = new Line({
  points: [
    new V2(0.32, 0.5),   // right edge of box A
    new V2(0.5, 0.5),    // midpoint
    new V2(0.5, 0.3),    // go up
    new V2(0.68, 0.3),   // toward box B
    new V2(0.68, 0.5),   // down to box B
  ],
  cornerRadius: /*@live:cornerRadius:0:0.1*/0.03,
  endMarker: { shape: 'arrow', size: 0.025 },
});
connector.styles.color = new Color(/*@live:r:0:255*/80, /*@live:g:0:255*/80, /*@live:b:0:255*/180);
`.trim();

function buildScene2(engine: LunaTerraEngine, config: Scene2Config): LTElement {
  const root = new GroupElement();
  const color = new Color(config.r, config.g, config.b);

  const boxA = new BoxElement({ w: 0.14, h: 0.07 });
  boxA.position = new V2(0.25, 0.5);
  boxA.styles.color = color;
  root.appendChild(boxA);

  const boxB = new BoxElement({ w: 0.14, h: 0.07 });
  boxB.position = new V2(0.75, 0.5);
  boxB.styles.color = color;
  root.appendChild(boxB);

  const connector = new Line({
    points: [
      new V2(0.32, 0.5),
      new V2(0.5, 0.5),
      new V2(0.5, 0.3),
      new V2(0.68, 0.3),
      new V2(0.68, 0.5),
    ],
    cornerRadius: config.cornerRadius,
    endMarker: { shape: 'arrow', size: 0.025 },
  }, { lineWidth: 2 });
  connector.styles.color = color;
  root.appendChild(connector);

  engine.interactive = false;
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LineConnectorsPage() {
  return (
    <DocPage title="Elements/Connectors" section="@lunaterra/elements">
      <DocPage.Section id="markers" title="Marker Shapes">
        <p>
          Arrows, triangles, diamonds, circles, and squares. Markers automatically
          align to the line tangent at the endpoint.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={400}
        />
      </DocPage.Section>

      <DocPage.Section id="diagram" title="Diagram Connectors">
        <p>
          Rounded right-angle connectors linking boxes — the building block
          for UML, flowcharts, and wiring diagrams.
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
