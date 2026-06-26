import { V3 } from '@lunaterra/math';
import { DocPage } from '../../components/DocPage/DocPage';

const sampleA = new V3(1, 2, 3);
const sampleB = new V3(-2, 0.5, 4);

export default function V3Page() {
  return (
    <DocPage title="V3" section="@lunaterra/math">
      <p>
        <code>V3</code> is a small immutable-style 3D vector helper used by the
        core 3D camera and transform APIs. Methods return new vectors instead of
        mutating the current value.
      </p>

      <DocPage.Section id="example" title="Example">
        <DocPage.Pre>{`const a = new V3(1, 2, 3);
const b = new V3(-2, 0.5, 4);

a.add(b)       // V3(${sampleA.add(sampleB).x}, ${sampleA.add(sampleB).y}, ${sampleA.add(sampleB).z})
a.dot(b)       // ${sampleA.dot(sampleB).toFixed(2)}
a.cross(b)     // V3(${sampleA.cross(sampleB).x.toFixed(2)}, ${sampleA.cross(sampleB).y.toFixed(2)}, ${sampleA.cross(sampleB).z.toFixed(2)})
a.normalize()  // length ${sampleA.normalize().length().toFixed(2)}`}</DocPage.Pre>
      </DocPage.Section>

      <DocPage.Section id="api" title="API Reference">
        <DocPage.Method
          signature="new V3(x: number, y: number, z: number)"
          description="Create a 3D vector."
          params={[
            { name: 'x', type: 'number', description: 'X coordinate.' },
            { name: 'y', type: 'number', description: 'Y coordinate.' },
            { name: 'z', type: 'number', description: 'Z coordinate.' },
          ]}
        />

        <DocPage.Method
          signature="add(v: V3): V3"
          description="Returns the component-wise sum."
          params={[{ name: 'v', type: 'V3', description: 'Vector to add.' }]}
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="sub(v: V3): V3"
          description="Returns the component-wise difference."
          params={[{ name: 'v', type: 'V3', description: 'Vector to subtract.' }]}
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="scale(s: number): V3"
          description="Returns this vector multiplied by a scalar."
          params={[{ name: 's', type: 'number', description: 'Scale factor.' }]}
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="dot(v: V3): number"
          description="Computes the scalar dot product."
          params={[{ name: 'v', type: 'V3', description: 'Right-hand vector.' }]}
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature="cross(v: V3): V3"
          description="Computes the vector cross product."
          params={[{ name: 'v', type: 'V3', description: 'Right-hand vector.' }]}
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="length(): number"
          description="Returns the Euclidean vector length."
          returns={{ type: 'number' }}
        />

        <DocPage.Method
          signature="normalize(): V3"
          description="Returns a unit vector in the same direction, or zero when length is zero."
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="clone(): V3"
          description="Returns a copy of this vector."
          returns={{ type: 'V3' }}
        />

        <DocPage.Method
          signature="toJson(): { x: number; y: number; z: number }"
          description="Serializes the vector into a plain object."
        />

        <DocPage.Method
          isStatic
          signature="V3.fromJson(json: { x: number; y: number; z: number }): V3"
          description="Creates a V3 from a plain object."
          returns={{ type: 'V3' }}
        />
      </DocPage.Section>
    </DocPage>
  );
}
