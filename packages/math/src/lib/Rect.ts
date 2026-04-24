import { V2 } from './V2';

export class Rect2D {
  public static identity() {
    return new Rect2D(new V2(0, 0), new V2(1, 1));
  }
  public v1: V2;
  public v2: V2;
  public get bottomLeft() {
    return this.v1;
  }
  public get topRight() {
    return this.v2;
  }

  public get width() {
    return this.v2.x - this.v1.x;
  }

  public get height() {
    return this.v2.y - this.v1.y;
  }

  public get center(): V2 {
    return this.v1.add(this.v2).mul(0.5);
  }

  constructor(_v1: V2, _v2: V2) {
    const v1 = _v1.clone();
    const v2 = _v2.clone();
    this.v1 = v1;
    this.v2 = v2;
    // fix rect
    if (v1.x > v2.x) {
      const t = v1.x;
      v1.x = v2.x;
      v2.x = t;
    }
    if (v1.y > v2.y) {
      const t = v1.y;
      v1.y = v2.y;
      v2.y = t;
    }
    // if (v1.x > v2.x || v1.y > v2.y) {
    //   throw new Error('Invalid rect');
    // }
  }

  public contains(v: V2) {
    return (
      v.x >= this.v1.x &&
      v.x <= this.v2.x &&
      v.y >= this.v1.y &&
      v.y <= this.v2.y
    );
  }

  public intersects(r: Rect2D) {
    // return true;

    // Check if one rectangle is on the left side of the other
    if (this.topRight.x < r.bottomLeft.x || r.topRight.x < this.bottomLeft.x) {
      // return false;
    }

    // Check if one rectangle is above the other
    if (this.topRight.y < r.bottomLeft.y || r.topRight.y < this.bottomLeft.y) {
      // return false;
    }

    // If none of the above conditions are true, then the rectangles intersect
    // return true;

    return (
      this.v1.x < r.v2.x &&
      this.v2.x > r.v1.x &&
      this.v1.y < r.v2.y &&
      this.v2.y > r.v1.y
    );
  }

  /**
   * 0 - bottom left
   * 1 - bottom right
   * 2 - top right
   * 3 - top left
   */
  public quadrant(n: number) {
    const half = this.v1.add(this.v2).mul(0.5);
    if (n === 0) {
      return new Rect2D(this.v1, half);
    }
    if (n === 1) {
      return new Rect2D(new V2(half.x, this.v1.y), new V2(this.v2.x, half.y));
    }
    if (n === 2) {
      return new Rect2D(half, this.v2);
    }
    if (n === 3) {
      return new Rect2D(new V2(this.v1.x, half.y), new V2(half.x, this.v2.y));
    }
    throw new Error('Invalid quadrant');
  }

  public printDebug() {
    return `Rect2D(${this.v1.printDebug()} ${this.v2.printDebug()})`;
  }
}
