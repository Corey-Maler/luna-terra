import { V2 } from '@lunaterra/math';

export interface LabelEntry {
  worldPos: V2;
  tag: string;
}

/**
 * Per-frame registry for label avoidance.
 *
 * Double-buffered: elements *write* to the current-frame buffer during render,
 * and *read* from the previous-frame buffer to compute fade factors.
 * This one-frame lag is imperceptible but avoids requiring a separate pre-render pass.
 *
 * Usage
 * ─────
 * 1. Call `swap()` once at the beginning of each render cycle (engine does this).
 * 2. Elements that dominate screen space call `register(worldPos, tag)` as they draw.
 * 3. Elements that want to fade call `avoidanceOpacity(worldPos, tag, fadeRadius, hideRadius)`.
 *
 * Fade curve: linear 0 → 1 from `hideRadius` to `fadeRadius`.
 * When `distance < hideRadius` → 0 (fully hidden).
 * When `distance > fadeRadius` → 1 (fully visible).
 */
export class LabelRegistry {
  private _read: LabelEntry[] = [];
  private _write: LabelEntry[] = [];

  /** Swap buffers — call once at the start of each frame. */
  swap(): void {
    this._read = this._write;
    this._write = [];
  }

  /**
   * Register a world-space position as occupied by a dominant label with `tag`.
   * Call this *after* drawing the label so the next frame knows where it is.
   */
  register(worldPos: V2, tag: string): void {
    this._write.push({ worldPos, tag });
  }

  /**
   * Returns 0–1 opacity for an element at `worldPos` that wants to fade
   * when another label with `tag` is within `fadeRadius` world units.
   *
   * Uses the *previous* frame's registrations so order-of-render doesn't matter.
   */
  avoidanceOpacity(
    worldPos: V2,
    tag: string,
    fadeRadius: number,
    hideRadius: number,
  ): number {
    let minDist = Infinity;
    for (const entry of this._read) {
      if (entry.tag !== tag) continue;
      const d = worldPos.distanceTo(entry.worldPos);
      if (d < minDist) minDist = d;
    }

    if (minDist >= fadeRadius) return 1;
    if (minDist <= hideRadius) return 0;
    // Linear interpolation between hideRadius and fadeRadius
    return (minDist - hideRadius) / (fadeRadius - hideRadius);
  }
}
