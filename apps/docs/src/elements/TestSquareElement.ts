import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';

interface TestSquareOptions {
  /** Half-size of the square in world units. */
  size: number;
}

/**
 * A simple filled+stroked square centred on the element's local origin.
 * Uses computedStyles for color so it participates in the style hierarchy.
 */
export class TestSquareElement extends LTStyledElement<TestSquareOptions> {
  protected defaultOptions(): TestSquareOptions {
    return { size: 0.05 };
  }

  testHover = (point: V2, radius: number): boolean => {
    const s = this.options.size;
    return (
      Math.abs(point.x - this.position.x) < s + radius &&
      Math.abs(point.y - this.position.y) < s + radius
    );
  };

  render(renderer: CanvasRenderer) {
    const { color, opacity } = this.computedStyles;
    const s = this.options.size;
    const tl = new V2(-s, -s);
    const tr = new V2(s, -s);
    const br = new V2(s, s);
    const bl = new V2(-s, s);

    const fill = renderer.draw(color.opaque(opacity * 0.3), 1);
    fill.path([tl, tr, br, bl, tl]);
    fill.fill(color.opaque(opacity * 0.3));

    const stroke = renderer.draw(color.opaque(opacity), 1);
    stroke.path([tl, tr, br, bl, tl]);
    stroke.stroke();
  }
}
