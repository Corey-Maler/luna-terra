import { M3, Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LunaTerraEngine, LTElement } from '@lunaterra/core';
import { Axis } from '@lunaterra/charts';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';
import { TestSquareElement } from '../../elements/TestSquareElement';

// ── Helpers ────────────────────────────────────────────────────────────────

class GroupElement extends LTElement<{}> {
  protected defaultOptions() { return {}; }
}

// ── Scene 1: Transform composition ────────────────────────────────────────

type Scene1Config = {
  tx: number; ty: number;
  angle: number;
  sx: number; sy: number;
};

const scene1Defaults: Scene1Config = {
  tx: 0.5, ty: 0.5,
  angle: 20,
  sx: 1, sy: 1,
};

const SCENE1_CODE = `
// LTElement composes localTransform from position, rotation, and scale.
// The equivalent M3 would be:
//   M3.identity().scale(sx, sy).rotate(radians(angle)).transition(tx, ty)

const square = new TestSquareElement({ size: 0.08 });
square.position = new V2(/*@live:tx:0.1:0.9*/0.50, /*@live:ty:0.1:0.9*/0.50);
square.rotation = radians(/*@live:angle:-180:180*/20);
square.scale    = new V2(/*@live:sx:0.2:2.5*/1.00, /*@live:sy:0.2:2.5*/1.00);
`.trim();

function buildScene1(engine: LunaTerraEngine, config: Scene1Config): LTElement {
  const root = new GroupElement();

  const axis = new Axis({
    xMin: 0, xMax: 1,
    yMin: 0, yMax: 1,
    tickCount: 5,
    xAxisY: 0,
    yAxisX: 0,
  });
  axis.styles.color = new Color(130, 145, 165);
  root.appendChild(axis);

  const square = new TestSquareElement({ size: 0.08 });
  square.styles.color = new Color(70, 130, 220);
  square.position = new V2(config.tx, config.ty);
  square.rotation = config.angle * (Math.PI / 180);
  square.scale = new V2(config.sx, config.sy);
  root.appendChild(square);

  engine.interactive = false;
  engine.zoomToRect(new Rect2D(new V2(0, 0), new V2(1, 1)), 0.8);
  engine.add(root);
  engine.requestUpdate();
  return root;
}

// ── Page ───────────────────────────────────────────────────────────────────

/** Shows the raw 3×3 matrix values for a given transform config. */
function MatrixDisplay({ tx, ty, angle, sx, sy }: Scene1Config) {
  const rad = angle * (Math.PI / 180);
  const m = M3.identity().scale(sx, sy).rotate(rad).transition(tx, ty);
  const fmt = (v: number) => v.toFixed(3).padStart(7);
  const row = (a: number, b: number, c: number) => `${fmt(m.matrix[a])}  ${fmt(m.matrix[b])}  ${fmt(m.matrix[c])}`;

  return (
    <DocPage.Pre>
      {'⎡ ' + row(0, 3, 6) + ' ⎤\n'}
      {'⎢ ' + row(1, 4, 7) + ' ⎥\n'}
      {'⎣ ' + row(2, 5, 8) + ' ⎦'}
    </DocPage.Pre>
  );
}

export default function M3Page() {
  return (
    <DocPage title="M3" section="@lunaterra/math">
      <p>
        <code>M3</code> is a 3×3 matrix for 2-D homogeneous transforms. It stores
        values in <strong>column-major</strong> order — the last column holds the
        translation terms. Indices run M00…M22 with M20 and M21 carrying{' '}
        <em>tx</em> and <em>ty</em>.
      </p>

      <DocPage.Section id="layout" title="Matrix Layout">
        <p>
          A 2-D transform matrix in column-major layout looks like this.
          The top-left 2×2 block encodes scale and rotation; the third column
          carries the translation.
        </p>
        <DocPage.Pre>
          {
`⎡ m[0]  m[3]  m[6] ⎤     ⎡  a   c   tx ⎤
⎢ m[1]  m[4]  m[7] ⎥  =  ⎢  b   d   ty ⎥
⎣ m[2]  m[5]  m[8] ⎦     ⎣  0   0    1 ⎦

result.x = a·x + c·y + tx
result.y = b·x + d·y + ty`
          }
        </DocPage.Pre>
        <p>
          Transforms compose right-to-left: <code>R × T</code> means "first
          translate, then rotate". The element system uses TRS order{' '}
          (scale → rotate → translate).
        </p>
      </DocPage.Section>

      <DocPage.Section id="transform" title="Transform Composition">
        <p>
          Drag the scrubbers to see how position, rotation, and scale affect
          the square. The matrix below updates to show the composed M3 values.
        </p>
        <LiveCodeScene
          buildScene={buildScene1}
          defaultConfig={scene1Defaults}
          source={SCENE1_CODE}
          canvasHeight={420}
          scrollBounds={null}
        />
        <MatrixDisplay {...scene1Defaults} />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">

        <DocPage.Method
          isStatic
          signature="M3.identity(): M3"
          description="Returns a new identity matrix (no transform)."
          returns={{ type: 'M3' }}
        />

        <DocPage.Method
          signature="multiply(m: M3): M3"
          description="Returns the matrix product this × m. Use to chain transforms: translate then rotate is rotate.multiply(translate)."
          params={[{ name: 'm', type: 'M3', description: 'The right-hand matrix.' }]}
          returns={{ type: 'M3', description: 'New composed matrix.' }}
        />

        <DocPage.Method
          signature="transition(x: number, y: number): M3"
          description="Returns a new matrix with the translation applied (stores tx/ty in column 2). Named 'transition' for historical reasons."
          params={[
            { name: 'x', type: 'number', description: 'Translation X.' },
            { name: 'y', type: 'number', description: 'Translation Y.' },
          ]}
          returns={{ type: 'M3' }}
        />

        <DocPage.Method
          signature="rotate(angle: number): M3"
          description="Returns a new matrix equal to rotationMatrix(angle) × this. Positive angle is counter-clockwise (Y-up convention)."
          params={[{ name: 'angle', type: 'number', description: 'Rotation in radians.' }]}
          returns={{ type: 'M3' }}
        />

        <DocPage.Method
          signature="scale(x: number, y: number): M3"
          description="Returns a new matrix with the scale applied to the first two columns."
          params={[
            { name: 'x', type: 'number', description: 'X scale factor.' },
            { name: 'y', type: 'number', description: 'Y scale factor.' },
          ]}
          returns={{ type: 'M3' }}
        />

        <DocPage.Method
          signature="multiplyV2(v: V2): V2"
          description="Transforms a 2-D point by this matrix (homogeneous multiply with w=1)."
          params={[{ name: 'v', type: 'V2', description: 'Point to transform.' }]}
          returns={{ type: 'V2', description: 'Transformed point.' }}
        />

        <DocPage.Method
          signature="inverse(): M3"
          description="Returns the inverse matrix. Use to convert screen-space coordinates back to world space."
          returns={{ type: 'M3', description: 'Inverted matrix.' }}
        />

        <DocPage.Method
          signature="copy(): M3"
          description="Returns a deep copy of this matrix."
          returns={{ type: 'M3' }}
        />

        <DocPage.Method
          signature="getFloatArray(): Float32Array"
          description="Returns the matrix as a Float32Array in column-major order, suitable for passing to WebGL uniforms."
          returns={{ type: 'Float32Array' }}
        />

      </DocPage.Section>
    </DocPage>
  );
}
