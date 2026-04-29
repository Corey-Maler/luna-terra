import { TracingInstance } from '@lunaterra/tracing';
import type { Rect2D, V2 } from '@lunaterra/math';
import { CanvasRenderer } from '../render/CanvasRenderer';
import type { EditModeOptions, ItemDragModeOptions } from '../render/MouseEventHandlers';
import type { LTElement } from '../render/Elements/LTElement';
import type { LTThemePalette } from '../render/theme';
import { InteractionManager } from './InteractionManager';

/** Interface for an FPS panel element. Typed as a plain interface to avoid circular dependency with @lunaterra/ui. */
export interface FpsPanelHandle {
  setEnabled(v: boolean): void;
  readonly isEnabled: boolean;
}


export class LunaTerraEngine {
  public renderer: CanvasRenderer;
  public running = false;
  public lastUpdate = Date.now();
  public children: LTElement[] = [];
  public interactionManager: InteractionManager | null = null;

  public static instance: LunaTerraEngine | undefined = undefined;

  /** Per-engine tracing store — isolated from other canvases on the page. */
  public readonly tracing = new TracingInstance();

  /** Attach an FPS panel element — set by the panel itself during setup(). */
  public fpsPanel: FpsPanelHandle | undefined = undefined;

  constructor() {
    this.renderer = new CanvasRenderer(this);
    LunaTerraEngine.instance = this;
  }

  /**
   * Enable the interaction system: point handles, element selection,
   * drag/resize/rotate support.
   */
  public activateInteraction(): InteractionManager {
    if (!this.interactionManager) {
      this.interactionManager = new InteractionManager();
      this.interactionManager.activate(this);
    }
    return this.interactionManager;
  }

  public activateEditMode = (props: EditModeOptions) => {
    return this.renderer.mouseHandlers.activateEditMode(props);
  };

  public activateItemDragMode = (props: ItemDragModeOptions) => {
    return this.renderer.mouseHandlers.activateItemDragMode(props);
  };

  public add(element: LTElement) {
    element.setup(this);
    this.children.push(element);
  }

  public destroy() {
    for (const child of this.children) {
      child.destroy?.();
    }
    this.children = [];
  }

  public getHtmlElements() {
    return this.renderer.getHTML();
  }

  private updateScheduled: false | 'quick' | 'full' = false;

  // ── Continuous animation loop ──────────────────────────────────────────────
  // Reference-counted: multiple elements can independently request looping.
  // When count > 0 a rAF loop fires every frame.
  // requestUpdate() becomes a no-op while the loop is active.
  private _continuousLoopCount = 0;

  /**
   * Request a continuous per-frame render loop.
   * Call once per feature that needs animation; balance with `releaseContinuousLoop()`.
   */
  public requestContinuousLoop(): void {
    this._continuousLoopCount++;
    if (this._continuousLoopCount === 1) {
      this._tickContinuous();
    }
  }

  /** Release a reference acquired via `requestContinuousLoop()`. */
  public releaseContinuousLoop(): void {
    this._continuousLoopCount = Math.max(0, this._continuousLoopCount - 1);
  }

  /** True while a continuous rAF loop is active (i.e. something is animating). */
  public get isAnimating(): boolean {
    return this._continuousLoopCount > 0;
  }

  private _tickContinuous(): void {
    if (this._continuousLoopCount <= 0) return;
    window.requestAnimationFrame(() => {
      this.update();
      this._tickContinuous();
    });
  }

  public requestQuickUpdate() {
    this.requestUpdate('quick');
  }

  public requestUpdate(type: 'quick' | 'full' = 'full') {
    // Continuous loop already fires every frame — one-shot request is redundant.
    if (this._continuousLoopCount > 0) return;

    if (this.updateScheduled) {
      // promote to full if requested
      if (type === 'full') {
        this.updateScheduled = 'full';
      }
      return;
    }

    this.updateScheduled = type;
    window.requestAnimationFrame(() => {
      // Clear BEFORE calling update() so any requestUpdate() calls made
      // from inside update() (e.g. from tick() when animating) can
      // successfully schedule the next frame.
      this.updateScheduled = false;
      this.update();
    });
  }

  private renderCycle = () => {
    window.requestAnimationFrame(() => {
      this.update();
      this.renderCycle();
    });
  };

  public run() {
    if (this.running) {
      return;
    }
    this.running = true;
    //this.renderCycle();
    this.update();
  }

  public stop() {
    this.running = false;
  }

  update = () => {
    const t1 = performance.now();
    const now = Date.now();
    const dt = now - this.lastUpdate;
    this.lastUpdate = now;

    const t2 = performance.now();
    this.tracing.perf('attractors', t2 - t1);
    this.children.forEach((child) => child.doUpdate(dt, this.renderer));
    const t3 = performance.now();
    this.tracing.perf('children', t3 - t2);

    // Step zoom animation: if it returns true the engine
    // needs to keep ticking even if no continuous-loop element is active.
    const animating = this.renderer.tick(dt);
    if (animating && this._continuousLoopCount === 0) {
      this.requestUpdate();
    }

    this.render(dt);
    const t4 = performance.now();
    const up = t4 - t1;
    this.tracing.perf('render', t4 - t3);
    this.tracing.perf('renderCycle', up);
    this.tracing.snapshot();
  };

  private render(dt: number) {
    this.renderer.prepare();
    this.children.forEach((child) => child.doRender(this.renderer));
    this.renderer.postRender(dt);
  }

  // ── Viewport / bounds convenience API ─────────────────────────────────────

  /**
   * Constrain panning to this world-space rect.
   * Set to null to disable.
   */
  public set scrollBounds(bounds: Rect2D | null) {
    this.renderer.scrollBounds = bounds;
  }

  /**
   * Enable or disable mouse/touch pan and zoom input.
   * When false, the user cannot pan or zoom via input but programmatic
   * calls (zoomToPoint, zoomToRect, etc.) still work, and the page
   * scrolls normally. Defaults to true.
   */
  public set interactive(value: boolean) {
    this.renderer.interactive = value;
  }
  public get interactive(): boolean {
    return this.renderer.interactive;
  }

  /**
   * Animate the viewport to fit `rect` in view.
   * @param padding fill-fraction 0–1 (default 0.85)
   */
  public zoomToRect(rect: Rect2D, padding = 0.85): void {
    this.renderer.zoomToRect(rect, padding);
    this.requestUpdate();
  }

  /**
   * Animate the viewport to centre `worldPoint` at the given zoom level.
   */
  public zoomToPoint(worldPoint: V2, targetZoom: number): void {
    this.renderer.zoomToPoint(worldPoint, targetZoom);
    this.requestUpdate();
  }

  /** Current viewport center in world space. */
  public get viewportCenter(): V2 {
    return this.renderer.viewportCenter;
  }

  /** Move the viewport center directly without changing zoom. */
  public moveViewportTo(worldPoint: V2): void {
    this.renderer.moveViewportTo(worldPoint);
    this.requestUpdate();
  }

  /** Offset the viewport center directly without changing zoom. */
  public moveViewportBy(delta: V2): void {
    this.renderer.moveViewportBy(delta);
    this.requestUpdate();
  }

  public set background(value: string | null) {
    this.renderer.background = value;
  }

  public get background(): string | null {
    return this.renderer.background;
  }

  public set theme(value: LTThemePalette | null) {
    this.renderer.theme = value;
  }

  public get theme(): LTThemePalette | null {
    return this.renderer.theme;
  }
}
