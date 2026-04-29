import { M3, Rect2D, V2 } from '@lunaterra/math';
import type { LunaTerraEngine } from '../../engine/engine';
import type { CanvasRenderer } from '../CanvasRenderer';
import { DrawContext } from '../Batch';

export interface InteractiveOptions {
  selectable?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  rotatable?: boolean;
}

export abstract class LTElement<OPTIONS extends {} = {}> {
  public onHover?: () => void;
  public onBlur?: () => void;
  testHover?: (p: V2, within: number) => boolean;

  public visibility = true;

  /** Opt-in interaction capabilities for this element. */
  public interactive?: InteractiveOptions;

  /** Local-space position (relative to parent). */
  public position: V2 = new V2(0, 0);
  /** Local-space rotation in radians (relative to parent). */
  public rotation: number = 0;
  /** Local-space scale (relative to parent). */
  public scale: V2 = new V2(1, 1);

  public options: OPTIONS;

  protected hovered = false;

  // ── Label avoidance ──────────────────────────────────────────────────────

  /**
   * When set, this element registers its *world-space* `position` under this tag
   * each frame. Other elements can fade themselves when this tag comes near.
   */
  public occupyTag?: string;

  /**
   * Fade this element (and children via opacity propagation) when another
   * element with a matching `occupyTag` is within range.
   *
   * `fadeRadius`  — distance at which fading begins (world units).
   * `hideRadius`  — distance at which element becomes fully invisible.
   *
   * To compute world-unit distances from screen pixels use
   * `renderer.measureScreenInWorld(px)` during render.
   */
  public fadeWhenNear?: {
    tag: string;
    fadeRadius: number;
    hideRadius: number;
  };

  /**
   * Avoidance opacity factor computed by `doRender` when `fadeWhenNear` is set.
   * 0 = fully hidden, 1 = fully visible. Default 1.
   */
  protected _avoidanceOpacity = 1;

  public updateHover(point: V2, radius: number) {
    if (this.testHover) {
      const nowHovered = this.testHover(point, radius);
      if (this.hovered !== nowHovered) {
        this.engine?.requestQuickUpdate();
      }
      if (nowHovered && !this.hovered && this.onHover) {
        this.onHover();
      }
      if (!nowHovered && this.hovered && this.onBlur) {
        this.onBlur();
      }
      this.hovered = nowHovered;
    }
  }

  /**
   * Local transform matrix derived from position/rotation/scale.
   * Returns null when all fields are identity (optimisation — avoids redundant matrix
   * multiplications every frame for static root-level elements).
   * TRS order: scale → rotate → translate.
   */
  public get localTransform(): M3 | null {
    const isIdentityPos = this.position.x === 0 && this.position.y === 0;
    const isIdentityRot = this.rotation === 0;
    const isIdentityScale = this.scale.x === 1 && this.scale.y === 1;
    if (isIdentityPos && isIdentityRot && isIdentityScale) {
      return null;
    }
    return M3.identity()
      .scale(this.scale.x, this.scale.y)
      .rotate(this.rotation)
      .transition(this.position.x, this.position.y);
  }

  /**
   * Override to return the element's local-space axis-aligned bounding box.
   * Required for selection, resize, and rotate interactions.
   */
  getBounds?(): Rect2D;

  /**
   * Compute the accumulated world transform by walking up the parent chain.
   * Returns identity if the element has no transforms.
   */
  public getWorldTransform(): M3 {
    const chain: (M3 | null)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: LTElement | undefined = this;
    while (current) {
      chain.push(current.localTransform);
      current = current._parent;
    }
    // Compose from root down (outermost first)
    let result = M3.identity();
    for (let i = chain.length - 1; i >= 0; i--) {
      const m = chain[i];
      if (m) result = result.multiply(m);
    }
    return result;
  }

  protected _engine?: LunaTerraEngine;
  protected get engine(): LunaTerraEngine | undefined {
    return this._engine ?? this._parent?.engine;
  }

  constructor(options: Partial<OPTIONS> = {}) {
    this.options = this.mergeOptions(options);
  }

  protected abstract defaultOptions(): OPTIONS;

  protected mergeOptions(userOptions: Partial<OPTIONS>): OPTIONS {
    return {
      ...this.defaultOptions(),
      ...userOptions,
    };
  }

  setup(engine: LunaTerraEngine) {
    this._engine = engine;

    this.tryCompose();

    this.children?.forEach((child) => {
      child.setup(engine);
    });
    this.helpers?.forEach((child) => {
      child.setup(engine);
    });
  }

  compose?(): LTElement[];
  composeHelpers?(): LTElement[];
  compute?(renderer: CanvasRenderer): void;

  private tryCompose() {
    if (this.compose) {
      const children = this.compose();
      if (children) {
        for (const child of children) {
          this.appendChild(child);
        }
      }
    }
    if (this.composeHelpers) {
      const helpers = this.composeHelpers();
      if (helpers) {
        for (const helper of helpers) {
          this.appendHelper(helper);
        }
      }
    }
  }

  // children operations

  protected children?: LTElement[];
  protected helpers?: LTElement[];
  protected _parent?: LTElement;

  public appendChild(child: LTElement) {
    if (!this.children) {
      this.children = [];
    }
    this.children.push(child);
    child._parent = this;
  }

  public appendHelper(child: LTElement) {
    if (!this.helpers) {
      this.helpers = [];
    }
    this.helpers.push(child);
    child._parent = this;
  }

  public removeChild(child: LTElement) {
    if (!this.children) {
      return;
    }
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  public findParent(predicate: (e: LTElement) => boolean): LTElement | undefined {
    const parent = this._parent;
    if (parent && predicate(parent)) {
      return parent;
    }
    if (parent) {
      return parent.findParent(predicate);
    }
    return undefined;
  }

  // updates and render

  public doUpdate(dt: number, renderer: CanvasRenderer) {
    if (this.compute) {
      this.compute(renderer);
    }

    if (this.children) {
      for (const child of this.children) {
        child.doUpdate(dt, renderer);
      }
    }
    if (this.helpers) {
      for (const child of this.helpers) {
        child.doUpdate(dt, renderer);
      }
    }
    if (this.update) {
      this.update(dt);
    }
  }

  update?(dt: number): void;
  destroy?(): void;

  public doRender(renderer: CanvasRenderer) {
    if (!this.visibility) {
      return;
    }

    // ── Label avoidance: read ────────────────────────────────────────────
    if (this.fadeWhenNear) {
      const worldPos = this.getWorldTransform().multiplyV2(this.position);
      this._avoidanceOpacity = renderer.labelRegistry.avoidanceOpacity(
        worldPos,
        this.fadeWhenNear.tag,
        this.fadeWhenNear.fadeRadius,
        this.fadeWhenNear.hideRadius,
      );
    }

    // Push this element's local transform so children and self render in local space.
    renderer.pushLocalTransform(this.localTransform);

    for (const child of this.children ?? []) {
      child.doRender(renderer);
    }
    for (const child of this.helpers ?? []) {
      child.doRender(renderer);
    }

    this.render(renderer);

    // ── Label avoidance: write ───────────────────────────────────────────
    if (this.occupyTag) {
      const worldPos = this.getWorldTransform().multiplyV2(this.position);
      renderer.labelRegistry.register(worldPos, this.occupyTag);
    }

    renderer.popLocalTransform();
  }

  render(renderer: CanvasRenderer) {}
  renderPath(batch: DrawContext) {}

  public renderHelpers(renderer: CanvasRenderer) {
    for (const child of this.children ?? []) {
      child.renderHelpers(renderer);
    }
    for (const child of this.helpers ?? []) {
      child.doRender(renderer);
    }
  }
}
