import { V2 } from './V2';

const M3Indexes = {
  M00: 0,
  M01: 1,
  M02: 2,
  M10: 3,
  M11: 4,
  M12: 5,
  M20: 6,
  M21: 7,
  M22: 8,
};

export class M3 {
  static indexes = M3Indexes;
  public matrix: number[];
  constructor() {
    this.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  static identity() {
    return new M3();
  }
  multiply(m: M3) {
    const output = new M3();
    const outMatrix = output.matrix;
    const tMatrix = this.matrix;
    const iMatrix = m.matrix;
    outMatrix[0] =
      tMatrix[M3Indexes.M00] * iMatrix[M3Indexes.M00] +
      tMatrix[M3Indexes.M10] * iMatrix[M3Indexes.M01] +
      tMatrix[M3Indexes.M20] * iMatrix[M3Indexes.M02];

    outMatrix[1] =
      tMatrix[M3Indexes.M01] * iMatrix[M3Indexes.M00] +
      tMatrix[M3Indexes.M11] * iMatrix[M3Indexes.M01] +
      tMatrix[M3Indexes.M21] * iMatrix[M3Indexes.M02];

    outMatrix[2] =
      tMatrix[M3Indexes.M02] * iMatrix[M3Indexes.M00] +
      tMatrix[M3Indexes.M12] * iMatrix[M3Indexes.M01] +
      tMatrix[M3Indexes.M22] * iMatrix[M3Indexes.M02];

    outMatrix[3] =
      tMatrix[M3Indexes.M00] * iMatrix[M3Indexes.M10] +
      tMatrix[M3Indexes.M10] * iMatrix[M3Indexes.M11] +
      tMatrix[M3Indexes.M20] * iMatrix[M3Indexes.M12];

    outMatrix[4] =
      tMatrix[M3Indexes.M01] * iMatrix[M3Indexes.M10] +
      tMatrix[M3Indexes.M11] * iMatrix[M3Indexes.M11] +
      tMatrix[M3Indexes.M21] * iMatrix[M3Indexes.M12];

    outMatrix[5] =
      tMatrix[M3Indexes.M02] * iMatrix[M3Indexes.M10] +
      tMatrix[M3Indexes.M12] * iMatrix[M3Indexes.M11] +
      tMatrix[M3Indexes.M22] * iMatrix[M3Indexes.M12];

    outMatrix[6] =
      tMatrix[M3Indexes.M00] * iMatrix[M3Indexes.M20] +
      tMatrix[M3Indexes.M10] * iMatrix[M3Indexes.M21] +
      tMatrix[M3Indexes.M20] * iMatrix[M3Indexes.M22];
    outMatrix[7] =
      tMatrix[M3Indexes.M01] * iMatrix[M3Indexes.M20] +
      tMatrix[M3Indexes.M11] * iMatrix[M3Indexes.M21] +
      tMatrix[M3Indexes.M21] * iMatrix[M3Indexes.M22];
    outMatrix[8] =
      tMatrix[M3Indexes.M02] * iMatrix[M3Indexes.M20] +
      tMatrix[M3Indexes.M12] * iMatrix[M3Indexes.M21] +
      tMatrix[M3Indexes.M22] * iMatrix[M3Indexes.M22];
    return output;
  }
  transition(x: number, y: number) {
    const output = new M3();
    output.matrix = [
      this.matrix[M3Indexes.M00],
      this.matrix[M3Indexes.M01],
      this.matrix[M3Indexes.M02],

      this.matrix[M3Indexes.M10],
      this.matrix[M3Indexes.M11],
      this.matrix[M3Indexes.M12],

      x * this.matrix[M3Indexes.M00] +
        y * this.matrix[M3Indexes.M10] +
        this.matrix[M3Indexes.M20],
      x * this.matrix[M3Indexes.M01] +
        y * this.matrix[M3Indexes.M11] +
        this.matrix[M3Indexes.M21],
      x * this.matrix[M3Indexes.M02] +
        y * this.matrix[M3Indexes.M12] +
        this.matrix[M3Indexes.M22],
    ];
    return output;
  }
  /**
   * Returns a new M3 = rotationMatrix(angle) × this.
   * Positive angle = counter-clockwise (Y-up convention).
   * Because canvas Y points downward the engine negates angles at the display
   * layer — this method stays pure math.
   */
  rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const rot = new M3();
    rot.matrix = [
       c,  s, 0,
      -s,  c, 0,
       0,  0, 1,
    ];
    return rot.multiply(this);
  }

  scale(x: number, y: number) {
    const output = new M3();
    output.matrix = [
      this.matrix[M3Indexes.M00] * x,
      this.matrix[M3Indexes.M01] * x,
      this.matrix[M3Indexes.M02] * x,

      this.matrix[M3Indexes.M10] * y,
      this.matrix[M3Indexes.M11] * y,
      this.matrix[M3Indexes.M12] * y,

      this.matrix[M3Indexes.M20],
      this.matrix[M3Indexes.M21],
      this.matrix[M3Indexes.M22],
    ];
    return output;
  }
  getFloatArray() {
    return new Float32Array(this.matrix);
  }

  public multiplyV2(v: V2) {
    return new V2(
      v.x * this.matrix[M3Indexes.M00] +
        v.y * this.matrix[M3Indexes.M10] +
        this.matrix[M3Indexes.M20],
      v.x * this.matrix[M3Indexes.M01] +
        v.y * this.matrix[M3Indexes.M11] +
        this.matrix[M3Indexes.M21],
    );
  }

  public inverse() {
    const output = new M3();
    const m = this.matrix;
    const det =
      m[M3Indexes.M00] *
        (m[M3Indexes.M11] * m[M3Indexes.M22] -
          m[M3Indexes.M12] * m[M3Indexes.M21]) -
      m[M3Indexes.M01] *
        (m[M3Indexes.M10] * m[M3Indexes.M22] -
          m[M3Indexes.M12] * m[M3Indexes.M20]) +
      m[M3Indexes.M02] *
        (m[M3Indexes.M10] * m[M3Indexes.M21] -
          m[M3Indexes.M11] * m[M3Indexes.M20]);
    const invDet = 1 / det;
    output.matrix = [
      (m[M3Indexes.M11] * m[M3Indexes.M22] -
        m[M3Indexes.M12] * m[M3Indexes.M21]) *
        invDet,
      (m[M3Indexes.M02] * m[M3Indexes.M21] -
        m[M3Indexes.M01] * m[M3Indexes.M22]) *
        invDet,
      (m[M3Indexes.M01] * m[M3Indexes.M12] -
        m[M3Indexes.M02] * m[M3Indexes.M11]) *
        invDet,

      (m[M3Indexes.M12] * m[M3Indexes.M20] -
        m[M3Indexes.M10] * m[M3Indexes.M22]) *
        invDet,
      (m[M3Indexes.M00] * m[M3Indexes.M22] -
        m[M3Indexes.M02] * m[M3Indexes.M20]) *
        invDet,
      (m[M3Indexes.M02] * m[M3Indexes.M10] -
        m[M3Indexes.M00] * m[M3Indexes.M12]) *
        invDet,

      (m[M3Indexes.M10] * m[M3Indexes.M21] -
        m[M3Indexes.M11] * m[M3Indexes.M20]) *
        invDet,
      (m[M3Indexes.M01] * m[M3Indexes.M20] -
        m[M3Indexes.M00] * m[M3Indexes.M21]) *
        invDet,
      (m[M3Indexes.M00] * m[M3Indexes.M11] -
        m[M3Indexes.M01] * m[M3Indexes.M10]) *
        invDet,
    ];
    return output;
  }

  public copy(): M3 {
    const output = new M3();
    output.matrix = [...this.matrix];
    return output;
  }
}
M3Indexes.M00 = 0;
M3Indexes.M01 = 1;
M3Indexes.M02 = 2;
M3Indexes.M10 = 3;
M3Indexes.M11 = 4;
M3Indexes.M12 = 5;
M3Indexes.M20 = 6;
M3Indexes.M21 = 7;
M3Indexes.M22 = 8;
