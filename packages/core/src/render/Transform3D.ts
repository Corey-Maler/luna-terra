import { M4, V3 } from '@lunaterra/math';

export class Transform3D {
  public position = new V3(0, 0, 0);
  public rotation = new V3(0, 0, 0);
  public scale = new V3(1, 1, 1);

  public get modelMatrix() {
    return M4.identity()
      .translate(this.position.x, this.position.y, this.position.z)
      .rotateZ(this.rotation.z)
      .rotateY(this.rotation.y)
      .rotateX(this.rotation.x)
      .scale(this.scale.x, this.scale.y, this.scale.z);
  }
}
