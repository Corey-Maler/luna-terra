import { V3 } from './V3';

const M4Indexes = {
  M00: 0,
  M01: 1,
  M02: 2,
  M03: 3,
  M10: 4,
  M11: 5,
  M12: 6,
  M13: 7,
  M20: 8,
  M21: 9,
  M22: 10,
  M23: 11,
  M30: 12,
  M31: 13,
  M32: 14,
  M33: 15,
};

export class M4 {
  static indexes = M4Indexes;
  public matrix: number[];

  constructor() {
    this.matrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }

  static identity() {
    return new M4();
  }

  static perspective(fovYRadians: number, aspect: number, near: number, far: number) {
    const out = new M4();
    const f = 1 / Math.tan(fovYRadians / 2);
    const nf = 1 / (near - far);

    out.matrix = [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
    return out;
  }

  static orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ) {
    const out = new M4();
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    out.matrix = [
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr,
      (top + bottom) * bt,
      (far + near) * nf,
      1,
    ];
    return out;
  }

  static lookAt(eye: V3, target: V3, up: V3) {
    const z = eye.sub(target).normalize();
    const x = up.cross(z).normalize();
    const y = z.cross(x).normalize();

    const out = new M4();
    out.matrix = [
      x.x, y.x, z.x, 0,
      x.y, y.y, z.y, 0,
      x.z, y.z, z.z, 0,
      -x.dot(eye), -y.dot(eye), -z.dot(eye), 1,
    ];
    return out;
  }

  public multiply(m: M4) {
    const out = new M4();
    const a = this.matrix;
    const b = m.matrix;
    const o = out.matrix;

    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        o[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }

    return out;
  }

  public translate(x: number, y: number, z: number) {
    const transform = new M4();
    transform.matrix[M4Indexes.M30] = x;
    transform.matrix[M4Indexes.M31] = y;
    transform.matrix[M4Indexes.M32] = z;
    return this.multiply(transform);
  }

  public scale(x: number, y: number, z: number) {
    const transform = new M4();
    transform.matrix[M4Indexes.M00] = x;
    transform.matrix[M4Indexes.M11] = y;
    transform.matrix[M4Indexes.M22] = z;
    return this.multiply(transform);
  }

  public rotateX(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const transform = new M4();
    transform.matrix = [
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ];
    return this.multiply(transform);
  }

  public rotateY(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const transform = new M4();
    transform.matrix = [
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ];
    return this.multiply(transform);
  }

  public rotateZ(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const transform = new M4();
    transform.matrix = [
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    return this.multiply(transform);
  }

  public multiplyV3(v: V3, w = 1) {
    const m = this.matrix;
    const x = v.x * m[M4Indexes.M00] +
      v.y * m[M4Indexes.M10] +
      v.z * m[M4Indexes.M20] +
      w * m[M4Indexes.M30];
    const y = v.x * m[M4Indexes.M01] +
      v.y * m[M4Indexes.M11] +
      v.z * m[M4Indexes.M21] +
      w * m[M4Indexes.M31];
    const z = v.x * m[M4Indexes.M02] +
      v.y * m[M4Indexes.M12] +
      v.z * m[M4Indexes.M22] +
      w * m[M4Indexes.M32];
    const nextW = v.x * m[M4Indexes.M03] +
      v.y * m[M4Indexes.M13] +
      v.z * m[M4Indexes.M23] +
      w * m[M4Indexes.M33];

    if (nextW !== 0 && nextW !== 1) {
      return new V3(x / nextW, y / nextW, z / nextW);
    }
    return new V3(x, y, z);
  }

  public copy() {
    const out = new M4();
    out.matrix = [...this.matrix];
    return out;
  }

  public getFloatArray() {
    return new Float32Array(this.matrix);
  }
}
