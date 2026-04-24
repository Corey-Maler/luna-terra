import { Color } from '@lunaterra/color';
import type { CanvasRenderer } from '../CanvasRenderer';
import type { LTColorValue } from '../theme';
import { resolveThemeColor } from '../theme';
import { LTElement } from './LTElement';

export interface LTStyles {
  /** null means "inherit from parent's computed color" */
  color: LTColorValue;
  /** 0-1, multiplied with parent's computed opacity */
  opacity: number;
}

/** Fully-resolved styles with no nulls — available during/after doRender. */
export interface LTResolvedStyles {
  color: Color;
  opacity: number;
}

export type LTStyleOptions = Partial<LTStyles>;

const DEFAULT_STYLES: LTResolvedStyles = {
  color: new Color(0, 0, 0),
  opacity: 1,
};

export abstract class LTStyledElement<P extends {} = {}, S = {}> extends LTElement<P> {
  public styles: LTStyles & S;

  /** Resolved styles after applying parent styles from the renderer stack. Set during doRender. */
  protected _resolvedStyles: LTResolvedStyles | null = null;

  constructor(options?: Partial<P>, styles: Partial<LTStyles & S> = {}) {
    super(options);
    this.styles = {
      opacity: DEFAULT_STYLES.opacity,
      color: null,
      ...styles,
    } as LTStyles & S;
  }

  /**
   * Resolved styles for this element: opacity is multiplied through the hierarchy,
   * color is inherited from the nearest ancestor that sets one.
   * Only valid during or after doRender — falls back to DEFAULT_STYLES otherwise.
   */
  protected get computedStyles(): LTResolvedStyles {
    return this._resolvedStyles ?? DEFAULT_STYLES;
  }

  public override doRender(renderer: CanvasRenderer) {
    const parent = renderer.currentStyles;
    const resolved: LTResolvedStyles = {
      opacity: parent.opacity * this.styles.opacity * this._avoidanceOpacity,
      color: resolveThemeColor(this.styles.color, renderer.theme) ?? parent.color,
    };
    this._resolvedStyles = resolved;

    renderer.pushStyles(resolved);
    super.doRender(renderer);
    renderer.popStyles();
  }
}

