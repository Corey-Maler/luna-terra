import { M4 } from '@lunaterra/math';
import { DocPage } from '../../components/DocPage/DocPage';

function MatrixDisplay({ matrix }: { matrix: M4 }) {
  const fmt = (v: number) => v.toFixed(3).padStart(8);
  const row = (a: number, b: number, c: number, d: number) =>
    `${fmt(matrix.matrix[a])} ${fmt(matrix.matrix[b])} ${fmt(matrix.matrix[c])} ${fmt(matrix.matrix[d])}`;

  return (
    <DocPage.Pre>
      {'⎡ ' + row(0, 4, 8, 12) + ' ⎤\n'}
      {'⎢ ' + row(1, 5, 9, 13) + ' ⎥\n'}
      {'⎢ ' + row(2, 6, 10, 14) + ' ⎥\n'}
      {'⎣ ' + row(3, 7, 11, 15) + ' ⎦'}
    </DocPage.Pre>
  );
}

export default function M4Page() {
  const transform = M4.identity()
    .translate(1, 2, 3)
    .rotateY(Math.PI / 6)
    .scale(2, 2, 2);

  return (
    <DocPage title="M4" section="@lunaterra/math">
      <p>
        <code>M4</code> is a 4×4 column-major matrix for 3D homogeneous
        transforms. It is designed for WebGL uniforms and the new core 3D
        renderer path.
      </p>

      <DocPage.Section id="layout" title="Matrix Layout">
        <p>
          Values are stored in column-major order. Translation lives in
          <code>M30</code>, <code>M31</code>, and <code>M32</code>, matching the
          layout expected by <code>uniformMatrix4fv(..., false, matrix)</code>.
        </p>
        <MatrixDisplay matrix={M4.identity()} />
      </DocPage.Section>

      <DocPage.Section id="composition" title="Composition">
        <p>
          Transform helpers return new matrices and compose with
          <code>this.multiply(transform)</code>. This example translates, rotates,
          and scales a point.
        </p>
        <DocPage.Pre>{`const m = M4.identity()
  .translate(1, 2, 3)
  .rotateY(Math.PI / 6)
  .scale(2, 2, 2);

m.multiplyV3(new V3(1, 0, 0));`}</DocPage.Pre>
        <MatrixDisplay matrix={transform} />
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">
        <DocPage.Method
          isStatic
          signature="M4.identity(): M4"
          description="Returns a new identity matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          isStatic
          signature="M4.perspective(fovYRadians: number, aspect: number, near: number, far: number): M4"
          description="Creates a perspective projection matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          isStatic
          signature="M4.orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): M4"
          description="Creates an orthographic projection matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          isStatic
          signature="M4.lookAt(eye: V3, target: V3, up: V3): M4"
          description="Creates a view matrix looking from eye toward target."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="multiply(m: M4): M4"
          description="Returns the matrix product this × m."
          params={[{ name: 'm', type: 'M4', description: 'Right-hand matrix.' }]}
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="translate(x: number, y: number, z: number): M4"
          description="Returns a translated matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="scale(x: number, y: number, z: number): M4"
          description="Returns a scaled matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="rotateX(angle: number): M4"
          description="Returns a matrix rotated around the X axis."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="rotateY(angle: number): M4"
          description="Returns a matrix rotated around the Y axis."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="rotateZ(angle: number): M4"
          description="Returns a matrix rotated around the Z axis."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="multiplyV3(v: V3, w = 1): V3"
          description="Transforms a 3D point by this matrix and performs perspective divide when needed."
          params={[
            { name: 'v', type: 'V3', description: 'Point or vector to transform.' },
            { name: 'w', type: 'number', optional: true, default: '1', description: 'Homogeneous coordinate.' },
          ]}
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="copy(): M4"
          description="Returns a deep copy of this matrix."
          returns={{ type: 'M4' }}
        />

        <DocPage.Method
          signature="getFloatArray(): Float32Array"
          description="Returns the matrix in column-major order for WebGL uniforms."
          returns={{ type: 'Float32Array' }}
        />
      </DocPage.Section>
    </DocPage>
  );
}
