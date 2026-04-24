import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement, LTStyledElement, type CanvasRenderer } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { TestSquareElement } from '../../elements/TestSquareElement';
import { LiveCodeScene } from '../../components/LiveCodeScene';

// ---- Helpers ----

/** A plain container element with no rendering of its own — used to group children. */
class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

/**
 * Styled container that sets a color for all LTStyledElement descendants.
 * Renders nothing itself — just propagates styles and transform down.
 */
class StyledGroup extends LTStyledElement<{}, {}> {
  protected defaultOptions() { return {}; }
  render(_renderer: CanvasRenderer) {}
}

// ---- Scene config -----------------------------------------------------------

type SceneConfig = {
  // Square A — red
  squareAR: number; squareAG: number; squareAB: number;
  // Group B — translated + rotated, blue tint
  groupBX: number;
  groupBR: number; groupBG: number; groupBB: number;
  // Square B2 — green override inside group B
  squareB2Size: number;
  squareB2X: number;
  squareB2R: number; squareB2G: number; squareB2B: number;
  squareB2Op: number;
  // Group C — scaled, orange tint
  groupCX: number; groupCY: number;
  groupCScale: number;
  groupCR: number; groupCG: number; groupCB: number;
  // Square C & C2
  squareCSize: number;
  squareC2Size: number;
  squareC2X: number; squareC2Y: number;
  squareC2Op: number;
};

const defaultConfig: SceneConfig = {
  squareAR: 220, squareAG: 50,  squareAB: 50,
  groupBX:  0.3,
  groupBR:  50,  groupBG:  150, groupBB:  220,
  squareB2Size: 0.03,
  squareB2X:    0.15,
  squareB2R:  50,  squareB2G: 220, squareB2B: 100,
  squareB2Op: 0.7,
  groupCX: 0.3, groupCY: 0.2,
  groupCScale: 2,
  groupCR: 200, groupCG: 120, groupCB: 50,
  squareCSize:  0.04,
  squareC2Size: 0.025,
  squareC2X: 0.1, squareC2Y: 0.1,
  squareC2Op: 0.5,
};

// ---- Annotated source for the live code preview ----------------------------
//
// /*@live:key:min:max*/ before a numeric literal marks it as a live scrubber.
// The annotation is stripped for display; the number becomes draggable.

const SCENE_CODE = `
// Square A: plain red square at (0, 0), no transform
const squareA = new TestSquareElement();
squareA.styles.color = new Color(/*@live:squareAR:0:255*/220, /*@live:squareAG:0:255*/50, /*@live:squareAB:0:255*/50);
squareA.styles.opacity = 1;
root.appendChild(squareA);

// Group B: translated right + rotated 30°, blue tint
const groupB = new StyledGroup();
groupB.position = new V2(/*@live:groupBX:0:1*/0.3, 0);
groupB.rotation = Math.PI / 6;
groupB.styles.color = new Color(/*@live:groupBR:0:255*/50, /*@live:groupBG:0:255*/150, /*@live:groupBB:0:255*/220);

// B1: no explicit color — inherits blue from groupB
const squareB1 = new TestSquareElement();
groupB.appendChild(squareB1);

// B2: green override, offset + semi-transparent
const squareB2 = new TestSquareElement({ size: /*@live:squareB2Size:0.01:0.12*/0.03 });
squareB2.position = new V2(/*@live:squareB2X:0:0.5*/0.15, 0);
squareB2.styles.color = new Color(/*@live:squareB2R:0:255*/50, /*@live:squareB2G:0:255*/220, /*@live:squareB2B:0:255*/100);
squareB2.styles.opacity = /*@live:squareB2Op:0:1*/0.7;
groupB.appendChild(squareB2);
root.appendChild(groupB);

// Group C: 2× uniform scale, orange tint
const groupC = new StyledGroup();
groupC.position = new V2(/*@live:groupCX:-0.8:0.8*/0.3, /*@live:groupCY:-0.8:0.8*/0.2);
groupC.scale = new V2(/*@live:groupCScale:0.5:4*/2, /*@live:groupCScale:0.5:4*/2);
groupC.styles.color = new Color(/*@live:groupCR:0:255*/200, /*@live:groupCG:0:255*/120, /*@live:groupCB:0:255*/50);

const squareC = new TestSquareElement({ size: /*@live:squareCSize:0.01:0.1*/0.04 });
groupC.appendChild(squareC);

// C2: rotated 45° grandchild with reduced opacity
const squareC2 = new TestSquareElement({ size: /*@live:squareC2Size:0.01:0.1*/0.025 });
squareC2.position = new V2(/*@live:squareC2X:0:0.4*/0.1, /*@live:squareC2Y:0:0.4*/0.1);
squareC2.rotation = Math.PI / 4;
squareC2.styles.opacity = /*@live:squareC2Op:0:1*/0.5;
groupC.appendChild(squareC2);
root.appendChild(groupC);
`.trim();

// ---- Scene builder ----------------------------------------------------------

function buildScene(engine: LunaTerraEngine, config: SceneConfig): LTElement {
  const root = new GroupElement();

  // ── Square A ──
  const squareA = new TestSquareElement();
  squareA.styles.color = new Color(config.squareAR, config.squareAG, config.squareAB);
  squareA.styles.opacity = 1;
  root.appendChild(squareA);

  // ── Group B: translated right + rotated 30° ──
  const groupB = new StyledGroup();
  groupB.position = new V2(config.groupBX, 0);
  groupB.rotation = Math.PI / 6;
  groupB.styles.color = new Color(config.groupBR, config.groupBG, config.groupBB);

  const squareB1 = new TestSquareElement();
  groupB.appendChild(squareB1);

  const squareB2 = new TestSquareElement({ size: config.squareB2Size });
  squareB2.position = new V2(config.squareB2X, 0);
  squareB2.styles.color = new Color(config.squareB2R, config.squareB2G, config.squareB2B);
  squareB2.styles.opacity = config.squareB2Op;
  groupB.appendChild(squareB2);

  root.appendChild(groupB);

  // ── Group C: uniform scale ──
  const groupC = new StyledGroup();
  groupC.position = new V2(config.groupCX, config.groupCY);
  groupC.scale = new V2(config.groupCScale, config.groupCScale);
  groupC.styles.color = new Color(config.groupCR, config.groupCG, config.groupCB);

  const squareC = new TestSquareElement({ size: config.squareCSize });
  groupC.appendChild(squareC);

  const squareC2 = new TestSquareElement({ size: config.squareC2Size });
  squareC2.position = new V2(config.squareC2X, config.squareC2Y);
  squareC2.rotation = Math.PI / 4;
  squareC2.styles.opacity = config.squareC2Op;
  groupC.appendChild(squareC2);

  root.appendChild(groupC);

  engine.add(root);
  return root;
}

// ---- Page component ---------------------------------------------------------

export default () => (
  <DocPage title="LTElement — hierarchical transforms" section="@lunaterra/core">
    <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
      Three groups demonstrating parent→child transform and style inheritance.
      Red square: no transform. Blue group: translated + rotated 30°, with a
      green child override. Orange group: 2× scale, semi-transparent grandchild
      rotated 45°. Drag any highlighted number to tweak the scene live.
    </p>
    <LiveCodeScene
      buildScene={buildScene}
      defaultConfig={defaultConfig}
      source={SCENE_CODE}
      canvasHeight={420}
    />
  </DocPage>
);

