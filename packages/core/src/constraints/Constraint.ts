import { V2 } from '@lunaterra/math';
import type { LTElement } from '../render/Elements/LTElement';

/**
 * Abstract base for movement constraints on a {@link Handle}.
 *
 * Constraints do two things:
 *  1. **Snap** — `resolve(p)` maps an unconstrained drag position to the
 *     nearest allowed position (e.g. closest point on a circle or line).
 *  2. **Visualise** — `createVisual()` returns an {@link LTElement} that
 *     renders a decorative guide (arc, dashed line, …). The Handle adds it
 *     as a helper child and drives its opacity via `setOpacity()`.
 *
 * Lifecycle hooks (`onDragStart`, `onDragEnd`, `onMove`) are optional.
 * The Handle calls them at the appropriate moments so subclasses can update
 * internal state (e.g. recompute reference angles) without needing reactive
 * cells.
 */
export abstract class Constraint {
  /**
   * Map a raw drag position to the nearest allowed position.
   * Called on every pointer move event, before the Handle updates its position.
   */
  abstract resolve(p: V2): V2;

  /**
   * Return an element that visualises this constraint.
   * Called once when the Handle sets up its helpers.
   * The returned element is appended as a helper child of the Handle.
   */
  abstract createVisual(): LTElement;

  /**
   * Set the opacity of the constraint visual (0 = hidden, 1 = fully visible).
   * Called by the Handle every frame as it animates the constraint opacity.
   */
  abstract setOpacity(opacity: number): void;

  /**
   * Called from Handle.setup() with the handle's initial position so the
   * visual can show the correct state before the first drag.
   */
  init?(pos: V2): void;

  /** Called when the user starts dragging the Handle. */
  onDragStart?(): void;

  /** Called when the user releases the Handle. */
  onDragEnd?(): void;

  /**
   * Called after each resolved drag move, with the snapped position.
   * Subclasses use this to update internal state that affects the visual
   * (e.g. the current angle for a radius arc).
   */
  onMove?(pos: V2): void;
}

/** Resolve a `V2 | (() => V2)` endpoint to a plain `V2`. */
export type V2Source = V2 | (() => V2);

export function resolveV2(src: V2Source): V2 {
  return typeof src === 'function' ? src() : src;
}
