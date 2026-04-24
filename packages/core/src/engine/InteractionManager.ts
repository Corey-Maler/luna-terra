import { V2 } from '@lunaterra/math';
import { Handle } from '../components/Handle';
import type { LTElement } from '../render/Elements/LTElement';
import type { LunaTerraEngine } from './engine';

const PROXIMITY_CSS_PX = 60;  // mouse proximity zone for handle fade (CSS pixels)
const GRAB_CSS_PX = 10;         // click/grab radius for handles (CSS pixels)

type ActiveOp =
  | { type: 'handle'; handle: Handle }
  | null;

/**
 * Engine-level interaction coordinator.
 *
 * Manages draggable Handle instances. Subscribes directly to mouse
 * observables — panning works as normal when no handle is being dragged.
 */
export class InteractionManager {
  private _handles = new Set<Handle>();
  private _activeOp: ActiveOp = null;
  private _engine?: LunaTerraEngine;
  private _unsubscribers: (() => void)[] = [];

  // ── Handle registry ───────────────────────────────────────────────────

  public registerHandle(handle: Handle): void {
    this._handles.add(handle);
  }

  public unregisterHandle(handle: Handle): void {
    this._handles.delete(handle);
  }

  // ── Activation ────────────────────────────────────────────────────────

  public activate(engine: LunaTerraEngine): void {
    this._engine = engine;

    // Scan existing tree for handles that were added before activate()
    this._scanForHandles(engine.children);

    const mh = engine.renderer.mouseHandlers;
    this._unsubscribers.push(
      mh.$mousePositionWorld.subscribe((p) => this._onMousePosition(p)),
      mh.$mouseDraggingFromWorld.subscribe((p) => this._onDragSignal(p)),
      mh.$mouseUpScreen.subscribe(() => this._onMouseUp()),
    );
  }

  public deactivate(): void {
    this._unsubscribers.forEach((u) => u());
    this._unsubscribers = [];
  }

  // ── Mouse position (routes to hover OR drag-move) ─────────────────────

  private _onMousePosition(p: V2): void {
    if (this._activeOp) {
      this._activeOp.handle.dragTo(p);
    } else {
      this._processHover(p);
    }
  }

  // ── Hover ─────────────────────────────────────────────────────────────

  private _processHover(p: V2): void {
    if (!this._engine) return;
    const renderer = this._engine.renderer;

    const hdpi = window.devicePixelRatio || 1;
    const proximityRadius = renderer.measureScreenInWorld(PROXIMITY_CSS_PX * hdpi);
    let needsRedraw = false;

    const handles = Array.from(this._handles);
    for (const handle of handles) {
      const prev = handle.proximityOpacity;
      handle.updateHover(p, proximityRadius);
      if (Math.abs(handle.proximityOpacity - prev) > 0.001) {
        needsRedraw = true;
      }
    }

    if (needsRedraw) {
      this._engine.requestUpdate();
    }
  }

  // ── Drag signal ───────────────────────────────────────────────────────

  private _onDragSignal(p: V2): void {
    if (!this._engine || this._activeOp) return;

    const renderer = this._engine.renderer;
    const hdpi = window.devicePixelRatio || 1;
    const grabRadius = renderer.measureScreenInWorld(GRAB_CSS_PX * hdpi);

    const handle = this._findClosestHandle(p, grabRadius);
    if (handle) {
      handle.active = true;
      this._activeOp = { type: 'handle', handle };
      renderer.mouseHandlers.cancelPan();
      this._engine.requestUpdate();
    }
  }

  // ── Mouse up ──────────────────────────────────────────────────────────

  private _onMouseUp(): void {
    if (this._activeOp) {
      this._activeOp.handle.active = false;
      this._activeOp = null;
      this._engine?.requestUpdate();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private _findClosestHandle(p: V2, maxDist: number): Handle | null {
    let closest: Handle | null = null;
    let closestDist = maxDist;

    const handles = Array.from(this._handles);
    for (const handle of handles) {
      const dist = handle.position.distanceTo(p);
      if (dist < closestDist) {
        closestDist = dist;
        closest = handle;
      }
    }

    return closest;
  }

  /** Walk element tree and register any Handle instances found. */
  private _scanForHandles(elements: LTElement[]): void {
    for (const el of elements) {
      if (el instanceof Handle) {
        this._handles.add(el);
      }
      const children = (el as any).children as LTElement[] | undefined;
      if (children) this._scanForHandles(children);
      const helpers = (el as any).helpers as LTElement[] | undefined;
      if (helpers) this._scanForHandles(helpers);
    }
  }
}
