import { describe, expect, it, vi } from 'vitest';
import { M3, V2 } from '@lunaterra/math';
import { CanvasRenderer } from './CanvasRenderer';

describe('nested screen containers', () => {
  it('restores both outer screen coordinates and local transforms after a nested plot', () => {
    // Exercise matrix handling independently of a browser/native canvas.
    const renderer = Object.create(CanvasRenderer.prototype) as CanvasRenderer;
    const updateViewMatrix = vi.fn();
    Object.assign(renderer, {
      _transformStack: [], _screenTransformStack: [], _screenBaseMatrix: null,
      ll: { updateViewMatrix },
      panningTracker: { viewMatrix: M3.identity() },
    });
    const outer = CanvasRenderer.makeScreenMatrix(20, 30, 400, 300, { xMin: 0, xMax: 400, yMin: 300, yMax: 0 }, 1);
    const inner = CanvasRenderer.makeScreenMatrix(70, 100, 300, 160, { xMin: 1000, xMax: 2000, yMin: 1, yMax: 0 }, 1);
    renderer.pushScreenTransform(outer);
    renderer.pushLocalTransform(M3.identity().transition(5, 7));
    const before = updateViewMatrix.mock.lastCall![0].multiplyV2(new V2(10, 10));
    renderer.pushScreenTransform(inner);
    renderer.pushLocalTransform(M3.identity().transition(100, 0));
    renderer.popLocalTransform();
    renderer.popScreenTransform();
    const after = updateViewMatrix.mock.lastCall![0].multiplyV2(new V2(10, 10));
    expect(after).toEqual(before);
    renderer.popLocalTransform();
    renderer.popScreenTransform();
    expect(updateViewMatrix.mock.lastCall![0].multiplyV2(new V2(10, 10))).toEqual(new V2(10, 10));
  });
});
