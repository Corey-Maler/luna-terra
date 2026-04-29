import { V2 } from '@lunaterra/math';
import { LTStyledElement, type CanvasRenderer } from '@lunaterra/core';

export interface TextOptions {
  text: string;
  fontSize?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export class TextElement extends LTStyledElement<TextOptions> {
  protected defaultOptions(): TextOptions {
    return { text: '', fontSize: 14, align: 'left', baseline: 'alphabetic' };
  }

  constructor(options?: Partial<TextOptions>) {
    super(options, { opacity: 1, color: null });
  }

  override render(renderer: CanvasRenderer): void {
    const { text, fontSize = 14, align = 'left', baseline = 'alphabetic' } = this.options;
    if (!text) return;

    const { color } = this.computedStyles;
    const colorStr = color?.toString() ?? '#ffffff';

    renderer.draw(colorStr, 1).renderText(text, new V2(0, 0), fontSize, align, baseline);
  }
}
