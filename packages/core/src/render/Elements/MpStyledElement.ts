import { Color } from '@lunaterra/color';
import { MPElement } from './MPElement';

export interface MpStyles {
  color: Color;
  opacity: number;
}

export type MPStyleOptios = Partial<MpStyles>;

const DEFAULT_STYLES: MpStyles = {
  color: new Color(0, 0, 0),
  opacity: 1,
};

export abstract class MpStyledElement<P, S = {}> extends MPElement<P> {
  public styles: MpStyles & S;

  constructor(options?: Partial<P>, styles: Partial<MpStyles & S> = {}) {
    super(options);
    this.styles = {
      opacity: DEFAULT_STYLES.opacity,
      ...styles,
    } as MpStyles & S;
    if (!this.styles.color) {
      this.styles.color = DEFAULT_STYLES.color;
    }
  }

  protected get computedStyles() {
    const self = this;
    const parent = this.findParent((e) => e instanceof MpStyledElement) as MpStyledElement<unknown, unknown> | undefined;
    return {
      get color() {
        if (self.styles.color) {
          return self.styles.color.opaque(self.styles.opacity);
        }
        if (parent?.computedStyles?.color) {
          return parent.computedStyles.color;
        }
        return DEFAULT_STYLES.color.opaque(self.styles.opacity);
      },
      get opacity() {
        return self.styles.opacity;
      },
    };
  }
}

