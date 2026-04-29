import { V2 } from '@lunaterra/math';
import type { CanvasRenderer } from '../render/CanvasRenderer';
import { LTElement } from '../render/Elements/LTElement';

export class DummyElement extends LTElement<{}> {
  protected override defaultOptions() {
    return {};
  }

  override render(renderer: CanvasRenderer) {
    const { path, stroke } = renderer.draw('green');

    path([
      new V2(0.11, 0.11),
      new V2(0.11, 0.89),
      new V2(0.89, 0.89),
      new V2(0.89, 0.11),
      new V2(0.11, 0.11),
    ]);
    stroke();

    renderer.webgl.p3(
      new Float32Array([
        0.09, 0.09, 0.09, 0.91, 0.91, 0.91, 0.91, 0.09, 0.09, 0.09, 0.91, 0.91,
        0.91, 0.09, 0.09, 0.91,
      ]),
      [0],
      [8],
      ['#666600'],
    );

    renderer.webgl.p3(
      new Float32Array([
        0.09, 0.09, 0.09, 0.21, 0.21, 0.21, 0.21, 0.09, 0.09, 0.09,
      ]),
      [0],
      [5],
      ['#ff0000'],
    );
  }
}
