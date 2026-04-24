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

export abstract class MpStyledElement<P extends {} = {}, S = {}> extends MPElement<P> {
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

  protected get computedStyles(): MpStyles {
    const parent = this.findParent((e) => e instanceof MpStyledElement) as MpStyledElement<{}, {}> | undefined;
    const color = this.styles.color
      ? this.styles.color.opaque(this.styles.opacity)
      : parent?.computedStyles.color ?? DEFAULT_STYLES.color.opaque(this.styles.opacity);

    return {
      color,
      opacity: this.styles.opacity,
    };
  }
}

