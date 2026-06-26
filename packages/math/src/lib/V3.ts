export class V3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public add(v: V3) {
    return new V3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  public sub(v: V3) {
    return new V3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  public scale(s: number) {
    return new V3(this.x * s, this.y * s, this.z * s);
  }

  public dot(v: V3) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  public cross(v: V3) {
    return new V3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  public length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  public normalize() {
    const length = this.length();
    if (length === 0) {
      return new V3(0, 0, 0);
    }
    return new V3(this.x / length, this.y / length, this.z / length);
  }

  public clone() {
    return new V3(this.x, this.y, this.z);
  }

  public toJson() {
    return { x: this.x, y: this.y, z: this.z };
  }

  public static fromJson(json: { x: number; y: number; z: number }) {
    return new V3(json.x, json.y, json.z);
  }
}
