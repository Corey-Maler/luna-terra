import { Rect2D, V2 } from '@lunaterra/math';
import { PanningTracker } from './PanningTracker';
import type { ViewPort } from './ViewPort';

function viewport(width: number, height: number): ViewPort {
  return {
    width,
    height,
    HDPI: 1,
    virtualWidth: width,
    virtualHeight: height,
    viewPort: new V2(width, height),
    viewPortRatio: width / height,
    update: () => undefined,
  } as ViewPort;
}

describe('PanningTracker.zoomToRect', () => {
  it('fits real-world coordinate ranges below the old normalized-scene zoom floor', () => {
    const tracker = new PanningTracker(viewport(1200, 600), () => undefined);
    tracker.updateWorldSpaceMatrix(true);

    tracker.zoomToRect(
      new Rect2D(new V2(-32, -6), new V2(32, 3)),
      0.92,
      0,
    );

    expect(tracker.zoom).toBeCloseTo(0.02875, 5);
    expect(tracker.zoom).toBeLessThan(0.8);
    expect(tracker.worldCenter.x).toBeCloseTo(0, 8);
    expect(tracker.worldCenter.y).toBeCloseTo(-1.5, 8);
  });

  it('applies a zero-duration fit immediately', () => {
    const tracker = new PanningTracker(viewport(800, 800), () => undefined);
    tracker.updateWorldSpaceMatrix(true);

    tracker.zoomToRect(
      new Rect2D(new V2(-1, -1), new V2(1, 1)),
      0.8,
      0,
    );

    expect(tracker.zoom).toBeCloseTo(0.4, 8);
    expect(tracker.tick(16)).toBe(false);
  });
});
