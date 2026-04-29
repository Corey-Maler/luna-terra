import { V2 } from '@lunaterra/math';
import { Observable } from '../utils/observable';
import type { PanningTracker } from "./PanningTracker";
import type { ViewPort } from "./ViewPort";

export interface EditModeOptions {
  onClick?: (point: V2) => void;
  onMove?: (point: V2) => void;
  onEnd: (point: V2) => void;
  onStart: (point: V2) => void;
  mode: "auto" | "clicks" | "drag&drop";
  autorerender?: boolean;
}

export interface ItemDragModeOptions {
  hitTest?: (screenPt: V2) => boolean;
  onHover: (point: V2) => void;
  onMove: (point: V2) => void;
  onDragStart: (point: V2) => void;
  onDragEnd?: (point: V2) => void;
}

export class MouseEventHandlers {
  private mouseMode: "trackpad" | "mouse" = "trackpad";
  public mousePosition: V2 = new V2(0, 0);
  public $mousePositionScreen: Observable<V2> = new Observable();
  public $mousePositionWorld: Observable<V2> = new Observable();

  private $clicksScreen: Observable<V2> = new Observable();
  public $clicksWorld: Observable<V2> = new Observable();
  private dragging = false; // todo: rename to "panning" or something

  private editMode = false;
  private dragMode = false;
  /** Optional hit-test for the active item-drag element. When set, only drags that
   * start within the element's bounds are captured; all others fall through to panning. */
  private _itemDragHitTest: ((screenPt: V2) => boolean) | null = null;
  /** True when a touch gesture was captured by the draggable element (not panning). */
  private _touchGestureCaptured = false;

  /**
   * When false, mouse/touch pan and zoom input is ignored.
   * The page can scroll normally, but programmatic zoom/pan still works.
   * Defaults to true.
   */
  public interactive = true;

  // maybe switch to RXJS?
  private mouseDraggingFrom: V2 | null = null;
  private $mouseDraggingFromScreen: Observable<V2> = new Observable();
  public $mouseDraggingFromWorld: Observable<V2> = new Observable();
  public $mouseUpScreen: Observable<V2> = new Observable();

  /** Cancel any in-progress panning. Called by InteractionManager when claiming a drag. */
  public cancelPan(): void {
    this.dragging = false;
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly panningTracker: PanningTracker,
    private readonly viewPortTracker: ViewPort,
    private readonly requestUpdate: () => void,
  ) {
    this.setupEventListeners();

    this.$mousePositionScreen.subscribe((point) =>
      this.$mousePositionWorld.next(panningTracker.screenToWorld(point)),
    );

    this.$clicksScreen.subscribe((point) =>
      this.$clicksWorld.next(panningTracker.screenToWorld(point)),
    );

    this.$mouseDraggingFromScreen.subscribe((point) => {
      this.$mouseDraggingFromWorld.next(panningTracker.screenToWorld(point));
    });
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("wheel", this.onMouseScroll, {
      passive: false,
    });
    this.canvas.addEventListener("click", this.onClick);

    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  public activateItemDragMode = (props: ItemDragModeOptions) => {
    this.dragging = false;
    this.dragMode = true;
    this._itemDragHitTest = props.hitTest ?? null;

    const subs = new Set<() => void>();

    const setup = () => {
      const onHoverUnsubscibe = this.$mousePositionWorld.subscribe(
        props.onHover,
      );

      subs.add(onHoverUnsubscibe);

      const startDraggingUnsubscribe = this.$mouseDraggingFromWorld.subscribe(
        (p) => {
          // If a hit-test is registered, check the screen position where the
          // pointer went down — only capture if it's within the element's bounds.
          const screenStart = this.mouseDraggingFrom ?? this.touchDraggingFrom;
          if (this._itemDragHitTest && screenStart && !this._itemDragHitTest(screenStart)) {
            return; // drag started outside element — don't capture
          }
          onHoverUnsubscibe();
          startDraggingUnsubscribe();
          subs.delete(onHoverUnsubscibe);
          subs.delete(startDraggingUnsubscribe);
          props.onDragStart(p);
          const onMoveUnsubscribe = this.$mousePositionWorld.subscribe(
            props.onMove,
          );
          const mouseUpUnsubscribe = this.$mouseUpScreen.subscribe((p2) => {
            onMoveUnsubscribe();
            mouseUpUnsubscribe();
            subs.delete(onMoveUnsubscribe);
            subs.delete(mouseUpUnsubscribe);
            props.onDragEnd?.(this.panningTracker.screenToWorld(p2));
            setup();
          });

          subs.add(onMoveUnsubscribe);
          subs.add(mouseUpUnsubscribe);
        },
      );
      subs.add(startDraggingUnsubscribe);
    };

    setup();

    return function cancelItemDragMode() {
      subs.forEach((sub) => sub());
      subs.clear();
    }
  };

  public activateEditMode = (props: EditModeOptions) => {
    this.dragging = false; // not sure, but probably should be this
    this.editMode = true;
    const subscriptions = [] as (() => void)[];

    const { onClick, onMove, onEnd, onStart, mode, autorerender } = props;

    if (autorerender) {
      subscriptions.push(
        this.$mousePositionWorld.subscribe(() => {
          this.requestUpdate();
        }),
      );
    }

    let firstClick = true;
    const unsubscribeFromClicks = this.$clicksWorld.subscribe((point: V2) => {
      onClick?.(point);

      if (firstClick) {
        firstClick = false;
        onStart?.(point);

        if (onMove) {
          subscriptions.push(this.$mousePositionWorld.subscribe(onMove));
        }
      }
    });

    subscriptions.push(unsubscribeFromClicks);

    if (mode === "drag&drop" || mode === "auto") {
      const unsubscribeDragging = this.$mouseDraggingFromScreen.subscribe(
        (point) => {
          unsubscribeFromClicks();
          unsubscribeDragging();
          onStart?.(this.panningTracker.screenToWorld(point));

          if (onMove) {
            const moveUnsubscribe = this.$mousePositionWorld.subscribe(onMove);
            subscriptions.push(moveUnsubscribe);
          }

          if (onEnd) {
            const mouseUpUnsubscribe = this.$mouseUpScreen.subscribe(
              (point) => {
                onEnd(this.panningTracker.screenToWorld(point));
              },
            );
            subscriptions.push(mouseUpUnsubscribe);
          }
        },
      );

      subscriptions.push(unsubscribeDragging);
    }

    return () => {
      this.editMode = false;
      subscriptions.forEach((sub) => sub());
    };
  };

  onClick = (event: MouseEvent) => {
    const v2 = this.event2V(event);
    this.$clicksScreen.next(v2);
  };

  onMouseDown = (event: MouseEvent) => {
    this.mouseDraggingFrom = this.event2V(event);
    if (!this.interactive) return;
    // Cancel any running zoom animation when the user grabs the canvas.
    this.panningTracker.clearAnimation();
    // Handle mouse down event
    if (!this.editMode && !this.dragMode) {
      // No element drag mode — pan.
      this.dragging = true;
    } else if (this.dragMode && this._itemDragHitTest && !this._itemDragHitTest(this.mouseDraggingFrom)) {
      // Drag mode is active but the click missed the element — fall back to panning.
      this.dragging = true;
    }
  };

  onMouseMove = (event: MouseEvent) => {
    // Handle mouse move event
    const v2 = this.event2V(event);
    this.mousePosition = v2;
    this.$mousePositionScreen.next(v2);
    const { movementX, movementY } = event;

    if (this.mouseDraggingFrom?.withinDistance(v2, 10)) {
      console.log("dragging mode, not clicks mode");
      this.$mouseDraggingFromScreen.next(v2);
    }

    if (this.dragging) {
      this.panningTracker.moveCenterBy(
        movementX * this.viewPortTracker.HDPI,
        movementY * this.viewPortTracker.HDPI,
      );
    }
  };

  onMouseUp = (event: MouseEvent) => {
    this.dragging = false;

    if (this.mouseDraggingFrom) {
      this.$mouseUpScreen.next(this.event2V(event));
    }

    this.mouseDraggingFrom = null;
    // Kick off one more update after a drag.
    this.requestUpdate();
  };

  private event2V(event: MouseEvent) {
    const v2 = new V2(
      event.offsetX * this.viewPortTracker.HDPI,
      event.offsetY * this.viewPortTracker.HDPI,
    );
    return v2;
  }

  private handleZoom(e: WheelEvent) {
    const { deltaY } = e;

    const ratio = this.viewPortTracker.HDPI;

    const x = e.offsetX * ratio;
    const y = e.offsetY * ratio;

    const zoomBy = deltaY > 0 ? 1.1 : 1 / 1.1;

    if (this.panningTracker.zoom * zoomBy < this.panningTracker.MIN_ZOOM)
      return;
    if (this.panningTracker.zoom * zoomBy > this.panningTracker.MAX_ZOOM)
      return;

    this.panningTracker.zoom *= zoomBy;

    const center = this.panningTracker.center;
    this.panningTracker.moveCenter(
      x - (x - center.x) * zoomBy,
      y - (y - center.y) * zoomBy,
    );

    // this.center.x = x - (x - this.center.x) * zoomBy;
    // this.center.y = y - (y - this.center.y) * zoomBy;
  }

  private onMouseScroll = (e: WheelEvent) => {
    if (!this.interactive) return;
    e.preventDefault();

    if (this.mouseMode === "trackpad") {
      const ratio = this.viewPortTracker.HDPI;

      const { deltaX, deltaY } = e;

      //if (Math.abs(deltaX) < 1 && Math.abs(deltaY) > 0) {
      if (Math.floor(deltaX) === deltaX && Math.floor(deltaY) !== deltaY) {
        // likely pitch to zoom

        const x = e.offsetX * ratio;
        const y = e.offsetY * ratio;

        const ZOOM_COEF = 0.08 * Math.pow(this.panningTracker.zoom, 0.7);
        const zoomBy = deltaY * -ZOOM_COEF;

        if (this.panningTracker.zoom + zoomBy < this.panningTracker.MIN_ZOOM)
          return;
        if (this.panningTracker.zoom + zoomBy > this.panningTracker.MAX_ZOOM)
          return;

        const worldBeforeZoom = this.panningTracker.screenToWorld(new V2(x, y));

        this.panningTracker.zoom += zoomBy;
        this.panningTracker.recalculate();

        const worldAfterZoom = this.panningTracker.screenToWorld(new V2(x, y));

        const worldDiff = worldAfterZoom.sub(worldBeforeZoom);

        // why we need to divide by viewPortRatio? I have no clue
        this.panningTracker.moveCenterBy(
          (worldDiff.x *
            this.panningTracker.zoom *
            this.viewPortTracker.width) /
            this.viewPortTracker.viewPortRatio,
          -(
            worldDiff.y *
            this.panningTracker.zoom *
            this.viewPortTracker.height
          ),
        );

        /*
        this.center.x +=
          (worldDiff.x * this.zoom * this.width) / this.viewPortRatio;
        this.center.y += -worldDiff.y * this.zoom * this.height;
        */

        // this.center.x = x - (x - this.center.x) * (zoomBy / this.zoom * 10);
        // this.center.y = y - (y - this.center.y) * (zoomBy / this.zoom * 10);
      } else {
        const SPEED_COEF = 2;
        this.panningTracker.moveCenterBy(
          -deltaX * this.viewPortTracker.HDPI * SPEED_COEF,
          -deltaY * this.viewPortTracker.HDPI * SPEED_COEF,
        );
        /*
        this.center.x += -deltaX * this.ratio * SPEED_COEF;
        this.center.y += -deltaY * this.ratio * SPEED_COEF;
        */
      }
    } else {
      this.handleZoom(e);
    }
  };

  // --- Touch support ---

  private lastTouchPos: V2 | null = null;
  private lastPinchDist: number | null = null;
  // Tracks where the current single-finger touch started, used for the drag
  // threshold check (mirrors `mouseDraggingFrom` for mouse).
  private touchDraggingFrom: V2 | null = null;
  // True once the 10-px drag threshold has been crossed on the current touch,
  // so we only fire $mouseDraggingFromScreen once per gesture.
  private touchDragFired = false;

  private touchToV2(touch: Touch): V2 {
    const rect = this.canvas.getBoundingClientRect();
    return new V2(
      (touch.clientX - rect.left) * this.viewPortTracker.HDPI,
      (touch.clientY - rect.top) * this.viewPortTracker.HDPI,
    );
  }

  private pinchDistance(touches: TouchList): number {
    const a = this.touchToV2(touches[0]);
    const b = this.touchToV2(touches[1]);
    return a.distanceTo(b);
  }

  private pinchMidpoint(touches: TouchList): V2 {
    const a = this.touchToV2(touches[0]);
    const b = this.touchToV2(touches[1]);
    return new V2((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const pos = this.touchToV2(e.touches[0]);
      this.touchDraggingFrom = pos;
      this.touchDragFired = false;
      this.lastPinchDist = null;

      // Fire hover so elements can update proximity / fade-in state.
      // Done unconditionally — mirrors how onMouseMove always fires
      // $mousePositionScreen regardless of the interactive flag.
      this.$mousePositionScreen.next(pos);

      // Decide whether the element's drag mode claims this touch or panning does.
      const elementClaims =
        (this.dragMode && (!this._itemDragHitTest || this._itemDragHitTest(pos))) ||
        this.editMode;
      this._touchGestureCaptured = elementClaims;

      if (elementClaims) {
        // An element owns drag mode — prevent scroll so the drag lands cleanly.
        e.preventDefault();
      } else if (this.interactive) {
        e.preventDefault();
        this.lastTouchPos = pos;
        this.panningTracker.clearAnimation();
      }
      // When !interactive and no drag/edit mode: let the page scroll normally.
    } else if (e.touches.length === 2) {
      // Two fingers — switch to pinch; cancel any in-flight single-finger drag.
      if (this.touchDraggingFrom !== null) {
        const lastPos = this.lastTouchPos ?? this.touchDraggingFrom;
        this.$mouseUpScreen.next(lastPos);
        this.touchDraggingFrom = null;
        this.touchDragFired = false;
      }
      if (this.interactive) {
        e.preventDefault();
        this.lastPinchDist = this.pinchDistance(e.touches);
        this.lastTouchPos = null;
      }
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const current = this.touchToV2(e.touches[0]);

      // Always broadcast position — feeds onMove / onHover subscribers
      // regardless of the interactive flag (mirrors onMouseMove behaviour).
      this.$mousePositionScreen.next(current);

      if (this.touchDraggingFrom !== null && !this.touchDragFired) {
        // Fire drag-start on the first touchmove, unconditionally.
        // On mobile the first event can already be 20+ px from touchstart,
        // so a distance check would create a dead zone. The state machine
        // unsubscribes after the first catch, so this is safe to fire freely.
        this.touchDragFired = true;
        this.$mouseDraggingFromScreen.next(current);
        e.preventDefault();
      }

      if (this._touchGestureCaptured) {
        e.preventDefault();
      } else if (this.interactive && this.lastTouchPos) {
        // Pan only when no element has claimed the drag.
        e.preventDefault();
        const dx = current.x - this.lastTouchPos.x;
        const dy = current.y - this.lastTouchPos.y;
        this.panningTracker.moveCenterBy(dx, dy);
        this.requestUpdate();
      }

      this.lastTouchPos = current;

    } else if (e.touches.length === 2 && this.lastPinchDist !== null) {
      if (!this.interactive) return;
      e.preventDefault();
      const newDist = this.pinchDistance(e.touches);
      const mid = this.pinchMidpoint(e.touches);

      const zoomBy = newDist / this.lastPinchDist;

      const clampedZoom = Math.max(
        this.panningTracker.MIN_ZOOM,
        Math.min(this.panningTracker.MAX_ZOOM, this.panningTracker.zoom * zoomBy),
      );
      const actualZoomBy = clampedZoom / this.panningTracker.zoom;

      this.panningTracker.zoom = clampedZoom;
      this.panningTracker.moveCenter(
        mid.x - (mid.x - this.panningTracker.center.x) * actualZoomBy,
        mid.y - (mid.y - this.panningTracker.center.y) * actualZoomBy,
      );

      this.lastPinchDist = newDist;
      this.requestUpdate();
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      // All fingers lifted — fire mouseUp so drag-mode state machines complete.
      if (this.touchDraggingFrom !== null) {
        const releasePos = this.lastTouchPos ?? this.touchDraggingFrom;
        this.$mouseUpScreen.next(releasePos);
        e.preventDefault();
      }
      this.touchDraggingFrom = null;
      this.touchDragFired = false;
      this.lastTouchPos = null;
      this.lastPinchDist = null;
    } else if (e.touches.length === 1) {
      // One finger lifted during pinch — switch back to pan.
      const pos = this.touchToV2(e.touches[0]);
      this.lastTouchPos = pos;
      this.touchDraggingFrom = null;
      this.touchDragFired = false;
      this.lastPinchDist = null;
    }
  };
}
