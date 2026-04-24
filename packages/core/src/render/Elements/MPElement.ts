import { V2 } from '@lunaterra/math';
import type { LunaTerraEngine } from '../../engine/engine';
import type { CanvasRenderer } from '../CanvasRenderer';
import { Batch } from '../Batch';

// export interface MPElement {
//   testHover?: (p: V2, within: number) => boolean;
//   onHover?: () => void;
//   onBlur?: () => void;
//   compose?: () => MPElement[] | undefined;
//   compute?: (renderer: CanvasRenderer) => void;
//   visibility: boolean | Cell<boolean>;
//   rotation: number | Cell<number>;
// }

export abstract class MPElement<OPTIONS extends {} = {}> {
  // public testHover: ((p: V2, within: number) => boolean) | undefined;
  public onHover?: () => void;
  public onBlur?: () => void;
  testHover?: (p: V2, within: number) => boolean;
  // public abstract compose?: () => MPElement[] | undefined;
  // public abstract compute?: (renderer: CanvasRenderer) => void;

  public visibility = true;

  public rotation = 0;

  public options: OPTIONS;

  protected hovered = false;

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

  // Origin by default should not be set from the outside of a component
  protected _origin: V2 = new V2(0, 0);
  public get origin(): V2 {
    return this._origin;
  }

  protected _engine?: LunaTerraEngine;
  protected get engine(): LunaTerraEngine | undefined {
    return this._engine ?? this._parent?.engine;
  }


  constructor(options: Partial<OPTIONS> = {}) {
    this.options = this.mergeOptions(options);
    /*
    this.options = {
      ...this.options,
      ...options,
    } as OPTIONS;
     */
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

    // biome-ignore lint/complexity/noForEach: <explanation>
    this.children?.forEach((child) => {
      child.setup(engine);
    });
    this.helpers?.forEach((child) => {
      child.setup(engine);
    });
  }

  compose?(): MPElement[];
  composeHelpers?(): MPElement[];
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

  protected children?: MPElement[];
  protected helpers?: MPElement[];
  protected _parent?: MPElement;
  public appendChild(child: MPElement) {
    if (!this.children) {
      this.children = [];
    }
    this.children.push(child);
    child._parent = this;
  }

  public appendHelper(child: MPElement) {
    if (!this.helpers) {
      this.helpers = [];
    }
    this.helpers.push(child);
    child._parent = this;
  }

  public removeChild(child: MPElement) {
    if (!this.children) {
      return;
    }
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  public findParent(predicate: (e: MPElement) => boolean): MPElement | undefined {
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
    // constraints for now goes from up to down, but
    // updates goes from down to up

    if (this.compute) {
      this.compute(renderer);
    }

    // this.recalculateConstraints();
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

    for (const child of this.children ?? []) {
      child.doRender(renderer);
    }
    for (const child of this.helpers ?? []) {
      child.doRender(renderer);
    }
    // if (this.children) {
    //   this.children.forEach((child) => child.doRender(renderer));
    // }

    renderer.pushLocalTransform(null);
    this.render(renderer);
    renderer.popLocalTransform();
  }

  render(renderer: CanvasRenderer) {}
  renderPath(batch: Batch) {}

  public renderHelpers(renderer: CanvasRenderer) {
    for (const child of this.children ?? []) {
      child.renderHelpers(renderer);
    }
    for (const child of this.helpers ?? []) {
      child.doRender(renderer);
    }
  }
}
