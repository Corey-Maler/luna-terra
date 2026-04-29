import { M3, Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { DrawContext } from './Batch';
import type { LTElement } from './Elements/LTElement';
import type { LTResolvedStyles } from './Elements/LTStyledElement';
import { LabelRegistry } from './LabelRegistry';
import { MouseEventHandlers } from './MouseEventHandlers';
import { PanningTracker } from './PanningTracker';
import { ViewPort } from './ViewPort';
import { WebGLDrawBackend } from './WebGLBatch';
import { Colors } from './colors';
import type { LTThemePalette } from './theme';

export class CanvasRenderer {
  protected rootDiv = document.createElement('div');
  public readonly ll: DrawContext;
  // Without the world transform, so 10 units means 10 screen pixels.
  public readonly llScreenSpace: DrawContext;

  /** Label avoidance registry — swap() is called once per frame by the engine. */
  public readonly labelRegistry = new LabelRegistry();

  public canvas: HTMLCanvasElement;
  private webglCanvas: HTMLCanvasElement;
  public getHTML() {
    return this.rootDiv;
  }

  public get webgl(): WebGLDrawBackend {
    if (!this._webglBackend) {
      throw new Error('WebGL backend is not yet setup');
    }
    return this._webglBackend;
  }

  public ctx: CanvasRenderingContext2D;
  public get $mousePositionScreen() {
    return this.mouseHandlers.$mousePositionScreen;
  }

  public get $mousePosition() {
    return this.mouseHandlers.$mousePositionWorld;
  }

  private updated = true;

  private _webglBackend?: WebGLDrawBackend;

  // ---------- Software transform stack ----------
  // Stores the accumulated world→screen transform at each element level.
  // All canvas drawing goes through DrawContext.updateViewMatrix() — ctx.setTransform is
  // never used for element transforms, so Canvas2D line widths stay in screen pixels.
  private _transformStack: M3[] = [];

  // When non-null, replaces panningTracker.viewMatrix as the base for draw transforms.
  // Set by pushScreenTransform / cleared by popScreenTransform.
  private _screenBaseMatrix: M3 | null = null;
  private _savedTransformStack: M3[] | null = null;

  /**
   * Build an affine matrix that maps `worldBounds` (a 2D rect in arbitrary world units)
   * onto the physical canvas sub-rect described by `cssX/cssY/cssW/cssH` (CSS pixels).
   * Y is flipped: worldBounds.yMin maps to the bottom edge (cssY + cssH) and yMax to
   * the top edge (cssY), matching conventional math/chart conventions.
   *
   * @param hdpi  device pixel ratio (canvas.width / canvas.cssWidth)
   */
  public static makeScreenMatrix(
    cssX: number, cssY: number, cssW: number, cssH: number,
    worldBounds: { xMin: number; xMax: number; yMin: number; yMax: number },
    hdpi: number,
  ): M3 {
    const { xMin, xMax, yMin, yMax } = worldBounds;
    const scaleX = (cssW / (xMax - xMin)) * hdpi;
    const scaleY = (cssH / (yMax - yMin)) * hdpi;
    const tx = (cssX - xMin * (cssW / (xMax - xMin))) * hdpi;
    // Y-flip: world yMax → cssY, world yMin → cssY + cssH
    const ty = (cssY + cssH + yMin * (cssH / (yMax - yMin))) * hdpi;
    const m = new M3();
    m.matrix[0] = scaleX;   // M00
    m.matrix[1] = 0;         // M01
    m.matrix[3] = 0;         // M10
    m.matrix[4] = -scaleY;  // M11 (negative for Y-flip)
    m.matrix[6] = tx;        // M20
    m.matrix[7] = ty;        // M21
    return m;
  }

  /** Current device pixel ratio. */
  public get hdpi(): number {
    return this.viewPortTracker.HDPI;
  }

  /**
   * Push a screen-space coordinate system.
  * While active, `renderer.draw()` maps world coordinates through `screenMatrix`
   * instead of the world-space panning transform.
   * Children rendered between push/pop live in the coordinate space defined by
   * `makeScreenMatrix()`. Nest as needed (saves/restores cleanly).
   */
  public pushScreenTransform(screenMatrix: M3): void {
    this._savedTransformStack = this._transformStack.slice();
    this._transformStack = [];
    this._screenBaseMatrix = screenMatrix;
    this._syncBatchTransforms(M3.identity());
  }

  /** Restore the world-space coordinate system saved by `pushScreenTransform()`. */
  public popScreenTransform(): void {
    this._transformStack = this._savedTransformStack ?? [];
    this._savedTransformStack = null;
    this._screenBaseMatrix = null;
    const top = this._transformStack.at(-1) ?? M3.identity();
    this._syncBatchTransforms(top);
  }

  public pushLocalTransform(local: M3 | null): void {
    const current = this._transformStack.at(-1) ?? M3.identity();
    const next = local ? current.multiply(local) : current;
    this._transformStack.push(next);
    this._syncBatchTransforms(next);
  }

  public popLocalTransform(): void {
    this._transformStack.pop();
    const top = this._transformStack.at(-1) ?? M3.identity();
    this._syncBatchTransforms(top);
  }

  private _syncBatchTransforms(accumulated: M3): void {
    const base = this._screenBaseMatrix ?? this.panningTracker.viewMatrix;
    this.ll.updateViewMatrix(base.multiply(accumulated));
    // WebGL is not supported inside ScreenContainer — leave its matrix at world-space.
    if (!this._screenBaseMatrix) {
      this._webglBackend?.updateViewMatrix(this.panningTracker.webGLMatrix.multiply(accumulated));
    }
  }

  // ---------- Style stack ----------
  private static readonly _defaultStyles: LTResolvedStyles = {
    color: new Color(0, 0, 0),
    opacity: 1,
  };
  private _styleStack: LTResolvedStyles[] = [];
  private _background: string | null = Colors.bg;
  private _theme: LTThemePalette | null = null;

  public get currentStyles(): LTResolvedStyles {
    return this._styleStack.at(-1) ?? CanvasRenderer._defaultStyles;
  }

  public get background(): string | null {
    return this._background;
  }

  public set background(value: string | null) {
    this._background = value;
    this.simpleEngine.requestUpdate();
  }

  public get theme(): LTThemePalette | null {
    return this._theme;
  }

  public set theme(value: LTThemePalette | null) {
    this._theme = value;
    this.simpleEngine.requestUpdate();
  }

  public pushStyles(styles: LTResolvedStyles): void {
    this._styleStack.push(styles);
  }

  public popStyles(): void {
    this._styleStack.pop();
  }

  public get viewMatrix() {
    return this.panningTracker.viewMatrix;
  }

  public get width() {
    return this.canvas.width;
  }

  public get height() {
    return this.canvas.height;
  }

  public get viewPortRatio() {
    return this.viewPortTracker.viewPortRatio;
  }

  public get viewPort() {
    return new V2(this.width, this.height);
  }

  private panningTracker: PanningTracker;
  private viewPortTracker: ViewPort;
  public mouseHandlers: MouseEventHandlers;

  public worldToScreen(p: V2) {
    return this.viewMatrix.multiplyV2(p);
  }

  /**
   * Returns equal distance in world space for giving screen space
   * @param x in pixels screen space
   * @returns
   */
  public measureScreenInWorld(x: number) {
    const zero = this.screenToWorld(new V2(0, 0));
    const p = this.screenToWorld(new V2(x, 0));
    return p.x - zero.x;
  }

  public screenToWorld(p: V2) {
    return this.panningTracker.screenToWorld(p);
  }

  public get mousePosition() {
    return this.mouseHandlers.mousePosition;
  }

  public rectToScreen(r: Rect2D) {
    return new Rect2D(
      this.worldToScreen(r.bottomLeft),
      this.worldToScreen(r.topRight)
    );
  }

  public get visibleArea() {
    const m = this.viewMatrix.inverse();
    const p1 = m.multiplyV2(new V2(0, 0));
    const p3 = m.multiplyV2(new V2(this.width, this.height));
    return new Rect2D(p1, p3);
  }

  // ── Zoom / viewport API ──────────────────────────────────────────────────

  /** Current linear zoom level (e.g. 2 = 2×). */
  public get zoom(): number {
    return this.panningTracker.zoom;
  }

  /** Current zoom level expressed as log₂ (0 = 1×, 1 = 2×, 3.2 = 9.2×). */
  public get zoomLevel(): number {
    return Math.log2(this.panningTracker.zoom);
  }

  /**
   * Animate the viewport so that `rect` fits in view.
   * @param padding 0–1 fraction of the viewport to fill (default 0.85)
   */
  public zoomToRect(rect: Rect2D, padding = 0.85): void {
    this.panningTracker.zoomToRect(rect, padding);
  }

  /**
   * Animate the viewport so that `worldPoint` is centred at the given zoom.
   */
  public zoomToPoint(worldPoint: V2, targetZoom: number): void {
    this.panningTracker.zoomToPoint(worldPoint, targetZoom);
  }

  /**
   * Set a scroll boundary in world space.
   * Setting to null disables bounds enforcement.
   */
  public set scrollBounds(bounds: Rect2D | null) {
    this.panningTracker.panBounds = bounds;
  }

  /**
   * Enable or disable mouse/touch pan and zoom input.
   * When false, the user cannot pan or zoom but programmatic calls still work
   * and the page scrolls normally. Defaults to true.
   */
  public set interactive(value: boolean) {
    this.mouseHandlers.interactive = value;
  }
  public get interactive(): boolean {
    return this.mouseHandlers.interactive;
  }

  /**
   * Step zoom animation.
   * Must be called every frame from the engine.
   * Returns true when a re-render was triggered.
   */
  public tick(dt: number): boolean {
    return this.panningTracker.tick(dt);
  }

  private setupStyles() {
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0px';
    this.canvas.style.left = '0px';
    this.canvas.style.zIndex = '1';

    this.webglCanvas.style.position = 'absolute';
    this.webglCanvas.style.top = '0px';
    this.webglCanvas.style.left = '0px';
    this.webglCanvas.style.pointerEvents = 'none';
    this.webglCanvas.style.zIndex = '3';

    this.rootDiv.style.position = 'relative';
    this.rootDiv.style.flex = '1';
  }

  private setupObserver() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.onCanvasResize(width, height);
        // this.updateShiftMatrix();
      }
    });

    resizeObserver.observe(this.rootDiv);
  }

  constructor(private readonly simpleEngine: { requestUpdate: () => void }) {
    const canvas = document.createElement('canvas');
    const webglCanvas = document.createElement('canvas');

    // Set the WebGL canvas to have proper transparency
    webglCanvas.style.backgroundColor = 'transparent';

    this.canvas = canvas;
    this.webglCanvas = webglCanvas;
    this.rootDiv.appendChild(canvas);
    this.rootDiv.appendChild(webglCanvas);

    this.setupStyles();
    const requestUpdate = () => this.simpleEngine.requestUpdate();
    this.viewPortTracker = new ViewPort(this.canvas.width, this.canvas.height);
    this.panningTracker = new PanningTracker(
      this.viewPortTracker,
      requestUpdate
    );
    this.mouseHandlers = new MouseEventHandlers(
      this.canvas,
      this.panningTracker,
      this.viewPortTracker,
      requestUpdate
    );

    const ctx = canvas.getContext('2d')!;
    this.ctx = ctx;

    this.ll = new DrawContext(this.viewMatrix, ctx);
    this.llScreenSpace = new DrawContext(M3.identity(), ctx);

    this._webglBackend = new WebGLDrawBackend(webglCanvas);

    // this.updateShiftMatrix();
    this.setupObserver();
  }

  public onCanvasResize = (x: number, y: number) => {
    this.viewPortTracker.update(x, y);
    const ratio = this.viewPortTracker.HDPI;
    this.canvas.width = x * ratio;
    this.canvas.height = y * ratio;

    this.canvas.style.width = `${x}px`;
    this.canvas.style.height = `${y}px`;

    this.webglCanvas.width = x * ratio;
    this.webglCanvas.height = y * ratio;

    this._webglBackend?.resize(x * ratio, y * ratio);

    this.webglCanvas.style.width = `${x}px`;
    this.webglCanvas.style.height = `${y}px`;

    this.panningTracker.updateWorldSpaceMatrix(true);
    this.panningTracker.recalculate();
  };

  protected clearBackground() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this._background !== null) {
      this.ctx.fillStyle = this._background;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  public prepare() {
    // skip rendering if nothing changed
    if (!this.updated) {
      // return;
    }

    this.updated = false;

    // Swap label registry buffers so this frame reads last frame's registrations.
    this.labelRegistry.swap();

    this.clearBackground();

    this._transformStack = [];
    this._savedTransformStack = null;
    this._screenBaseMatrix = null;
    this._styleStack = [];
    this.ll.updateViewMatrix(this.panningTracker.viewMatrix);
    this._webglBackend?.updateViewMatrix(this.panningTracker.webGLMatrix);
    this._webglBackend?.prepareRender();
  }

  public postRender(_dt: number) {
    this._webglBackend?.finishRender();
  }

  public measureText(text: string) {
    const measurements = this.ctx.measureText(text);

    const height =
      measurements.actualBoundingBoxAscent +
      measurements.actualBoundingBoxDescent;
    return new V2(
      measurements.width /
        this.viewPortTracker.width /
        this.panningTracker.zoom,
      height / this.viewPortTracker.height / this.panningTracker.zoom
    );
    // return this.panningTracker.screenToWorld(
    //   new V2(
    //     measurements.width,
    //     height
    //   )
    // )
  }

  public draw(initialColor: string | Color, lineWidth = 1) {
    // return new DrawContext(this.ll, initialColor, lineWidth);
    this.ll.begin(initialColor, lineWidth, {});
    return this.ll;
  }

  public drawScreenSpace(initialColor: string, lineWidth = 1) {
    // return new DrawContext(this.llScreenSpace, initialColor, lineWidth);
    this.llScreenSpace.begin(initialColor, lineWidth);
    return this.llScreenSpace;
  }
}
