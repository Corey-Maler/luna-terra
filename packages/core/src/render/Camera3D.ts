import { M4, V3 } from '@lunaterra/math';

export type Camera3DMode = 'orthographic' | 'perspective';

export interface Camera3DOptions {
  mode?: Camera3DMode;
  eye?: V3;
  target?: V3;
  up?: V3;
  fovYRadians?: number;
  aspect?: number;
  near?: number;
  far?: number;
  left?: number;
  right?: number;
  bottom?: number;
  top?: number;
}

export class Camera3D {
  public mode: Camera3DMode;
  public eye: V3;
  public target: V3;
  public up: V3;
  public fovYRadians: number;
  public aspect: number;
  public near: number;
  public far: number;
  public left: number;
  public right: number;
  public bottom: number;
  public top: number;

  constructor(options: Camera3DOptions = {}) {
    this.mode = options.mode ?? 'perspective';
    this.eye = options.eye ?? new V3(0, 0, 4);
    this.target = options.target ?? new V3(0, 0, 0);
    this.up = options.up ?? new V3(0, 1, 0);
    this.fovYRadians = options.fovYRadians ?? Math.PI / 4;
    this.aspect = options.aspect ?? 1;
    this.near = options.near ?? 0.1;
    this.far = options.far ?? 100;
    this.left = options.left ?? -1;
    this.right = options.right ?? 1;
    this.bottom = options.bottom ?? -1;
    this.top = options.top ?? 1;
  }

  public get viewMatrix() {
    return M4.lookAt(this.eye, this.target, this.up);
  }

  public get projectionMatrix() {
    if (this.mode === 'orthographic') {
      return M4.orthographic(
        this.left,
        this.right,
        this.bottom,
        this.top,
        this.near,
        this.far,
      );
    }

    return M4.perspective(this.fovYRadians, this.aspect, this.near, this.far);
  }
}
