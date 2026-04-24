export class V2 {
  public x: number;
  public y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public add(v: V2) {
    return new V2(this.x + v.x, this.y + v.y);
  }

  public sub(v: V2) {
    return new V2(this.x - v.x, this.y - v.y);
  }

  /**
  * @deprecated use .scale instead
  */
  public mul(s: number) {
    return new V2(this.x * s, this.y * s);
  }

  public scale(s: number) {
    return new V2(this.x * s, this.y * s);
  }

  public get half() {
    return new V2(this.x / 2, this.y / 2);
  }

  public byElementDiv(v: V2) {
    return new V2(this.x / v.x, this.y / v.y);
  }

  public dot(v: V2) {
    return this.x * v.x + this.y * v.y;
  }

  public length() {
    return Math.hypot(this.x, this.y);
    // return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public floor() {
    return new V2(Math.floor(this.x), Math.floor(this.y));
  }

  public distanceTo(v2: V2) {
    const dx = this.x - v2.x;
    const dy = this.y - v2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public withinDistance(v2: V2, distance: number) {
    return this.distanceTo(v2) <= distance;
  }

  public static average(v1: V2, v2: V2) {
    return new V2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
  }

  public static closestToLine(p: V2, a: V2, b: V2) {
    const ap = p.sub(a);
    const ab = b.sub(a);

    const t = ap.dot(ab) / ab.dot(ab);

    if (t < 0) {
      return a;
    }

    if (t > 1) {
      return b;
    }

    return a.add(ab.mul(t));
  }

  public clone() {
    return new V2(this.x, this.y);
  }

  public minFrom(p2: V2) {
    if (p2.x < this.x) {
      this.x = p2.x;
    }

    if (p2.y < this.y) {
      this.y = p2.y;
    }
  }

  public equals(p2: V2) {
    // exact equal
    return this.x === p2.x && this.y === p2.y;
  }

  public normalize() {
    const length = this.length();
    if (length === 0) {
      return new V2(0, 0);
    }
    return new V2(this.x / length, this.y / length);
  }

  public closeEnough(p2: V2, epsilon = 1e-20) {
    return (
      Math.abs(this.x - p2.x) < epsilon && Math.abs(this.y - p2.y) < epsilon
    );
  }

  public maxFrom(p2: V2) {
    if (p2.x > this.x) {
      this.x = p2.x;
    }

    if (p2.y > this.y) {
      this.y = p2.y;
    }
  }

  public printDebug() {
    return `V2(${this.x}, ${this.y})`;
  }

  public get angle() {
    return Math.atan2(this.y, this.x);
  }

  public angleTo(to: V2) {
    return this.sub(to).angle;
  }

  public setAngle(angle: number) {
    const length = this.length();
    return new V2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  public setLenght(length: number) {
    const angle = this.angle;
    return new V2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  // should subtract from this vector given amount
  public shortenBy(amount: number) {
    return this.setLenght(this.length() - amount);
  }

  toJson() {
    return { x: this.x, y: this.y };
  }

  static fromJson(json: {x: number; y: number}): V2 {
    return new V2(json.x, json.y);
  }

  /**
  *   a
  *    \
  *     \
  *      b ----- c
  * @param a
  * @param b
  * @param c
  * @returns
  */
  static angleBetweenPoints(a: V2, b: V2, c: V2) {
      const ab = new V2(a.x - b.x, a.y - b.y);
      const cb = new V2(c.x - b.x, c.y - b.y);
      const dot = ab.x * cb.x + ab.y * cb.y;
      const magAB = Math.hypot(ab.x, ab.y);
      const magCB = Math.hypot(cb.x, cb.y);
      return Math.acos(dot / (magAB * magCB));
    }
}
