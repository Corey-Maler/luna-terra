import {
  LTElement,
  ScreenContainer,
  type LunaTerraEngine,
} from '@lunaterra/core';

export interface ViewportGestureLayerOptions {
  chartFrame: ScreenContainer;
  getWindowSize: () => number;
  getVisibleCenter: () => number;
  panBy: (delta: number) => void;
  zoomAround: (nextWindowSize: number, focusRatio: number, focusValue: number) => void;
  wheelZoomRequiresCtrl?: boolean;
  wheelZoomSensitivity?: number;
  valueAtRatio?: (ratio: number) => number;
}

export class ViewportGestureLayer extends LTElement<ViewportGestureLayerOptions> {
  private removeListeners: Array<() => void> = [];
  private isMouseDragging = false;
  private lastMouseX = 0;
  private touchMode: 'none' | 'pan' | 'pinch' = 'none';
  private lastTouchX = 0;
  private lastPinchDistance = 0;

  protected defaultOptions(): ViewportGestureLayerOptions {
    return {
      chartFrame: new ScreenContainer({
        anchor: 'top-left',
        offsetX: 0,
        offsetY: 0,
        width: 1,
        height: 1,
      }),
      getWindowSize: () => 1,
      getVisibleCenter: () => 0,
      panBy: () => {},
      zoomAround: () => {},
      wheelZoomRequiresCtrl: true,
      wheelZoomSensitivity: 0.0025,
    };
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);

    const canvas = engine.renderer.canvas;
    const onWheel = (event: WheelEvent) => {
      if (!this.hitClientPoint(event.clientX, event.clientY)) return;

      event.preventDefault();
      const ratio = this.focusRatioFromClientX(event.clientX);
      const windowSize = this.options.getWindowSize();
      const focusValue = this.valueAtRatio(ratio);

      if (!this.options.wheelZoomRequiresCtrl || event.ctrlKey) {
        const nextWindow = windowSize * Math.exp(event.deltaY * (this.options.wheelZoomSensitivity ?? 0.0025));
        this.options.zoomAround(nextWindow, ratio, focusValue);
        return;
      }

      const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
      const delta = (dominantDelta / chartRect.w) * windowSize;
      this.options.panBy(delta);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!this.hitClientPoint(event.clientX, event.clientY)) return;
      this.isMouseDragging = true;
      this.lastMouseX = event.clientX;
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!this.isMouseDragging) return;
      const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
      const windowSize = this.options.getWindowSize();
      const delta = ((event.clientX - this.lastMouseX) / chartRect.w) * windowSize;
      this.lastMouseX = event.clientX;
      this.options.panBy(-delta);
      event.preventDefault();
    };

    const onMouseUp = () => {
      this.isMouseDragging = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        if (!this.hitClientPoint(touch.clientX, touch.clientY)) return;
        this.touchMode = 'pan';
        this.lastTouchX = touch.clientX;
        event.preventDefault();
        return;
      }

      if (event.touches.length === 2) {
        const midpoint = this.touchMidpoint(event.touches);
        if (!this.hitClientPoint(midpoint.x, midpoint.y)) return;
        this.touchMode = 'pinch';
        this.lastPinchDistance = this.touchDistance(event.touches);
        event.preventDefault();
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (this.touchMode === 'pan' && event.touches.length === 1) {
        const touch = event.touches[0];
        const chartRect = this.options.chartFrame.getScreenRect(engine.renderer);
        const windowSize = this.options.getWindowSize();
        const delta = ((touch.clientX - this.lastTouchX) / chartRect.w) * windowSize;
        this.lastTouchX = touch.clientX;
        this.options.panBy(-delta);
        event.preventDefault();
        return;
      }

      if (this.touchMode === 'pinch' && event.touches.length === 2) {
        const midpoint = this.touchMidpoint(event.touches);
        const ratio = this.focusRatioFromClientX(midpoint.x);
        const focusValue = this.valueAtRatio(ratio);
        const nextDistance = this.touchDistance(event.touches);
        const currentWindow = this.options.getWindowSize();
        const nextWindow = currentWindow * (this.lastPinchDistance / nextDistance);
        this.lastPinchDistance = nextDistance;
        this.options.zoomAround(nextWindow, ratio, focusValue);
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      this.touchMode = 'none';
      this.lastPinchDistance = 0;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    this.removeListeners = [
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd),
      () => canvas.removeEventListener('touchcancel', onTouchEnd),
    ];
  }

  override destroy(): void {
    for (const remove of this.removeListeners) remove();
    this.removeListeners = [];
  }

  private hitClientPoint(clientX: number, clientY: number): boolean {
    const renderer = this.engine?.renderer;
    if (!renderer) return false;

    const chartRect = this.options.chartFrame.getScreenRect(renderer);
    const bounds = renderer.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    return x >= chartRect.x && x <= chartRect.x + chartRect.w && y >= chartRect.y && y <= chartRect.y + chartRect.h;
  }

  private focusRatioFromClientX(clientX: number): number {
    const renderer = this.engine?.renderer;
    if (!renderer) return 0.5;

    const chartRect = this.options.chartFrame.getScreenRect(renderer);
    const bounds = renderer.canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    return clamp((x - chartRect.x) / chartRect.w, 0, 1);
  }

  private valueAtRatio(ratio: number): number {
    return this.options.valueAtRatio?.(ratio)
      ?? this.options.getVisibleCenter() + (ratio - 0.5) * this.options.getWindowSize();
  }

  private touchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  private touchMidpoint(touches: TouchList): { x: number; y: number } {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}