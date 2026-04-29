/**
 * OrbitPath — draws the Moon's projected orbit as a dashed ellipse.
 *
 * Uses the batch API with world-space coordinates; the renderer handles
 * all transform / pixel mapping.
 */

import { V2 } from '@lunaterra/math';
import { LTElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import { projectedOrbitEllipse, DEFAULT_PROJECTION } from './projection';
import type { ProjectionConfig } from './projection';

export interface OrbitPathOptions {
  projectionConfig: ProjectionConfig;
}

export class OrbitPath extends LTElement<OrbitPathOptions> {
  /** Set to true to show the orbit; false to hide. */
  public visible = false;

  /** Accent colour set by parent each frame. */
  public accentColor = '#3c2a1a';

  /** Live projection config — updated by OrreryScene each frame. */
  public liveProjection: ProjectionConfig | null = null;

  protected defaultOptions(): OrbitPathOptions {
    return { projectionConfig: DEFAULT_PROJECTION };
  }

  render(renderer: CanvasRenderer) {
    if (!this.visible) return;

    const cfg = this.liveProjection ?? this.options.projectionConfig;
    const ellipse = projectedOrbitEllipse(cfg);
    const center = new V2(ellipse.cx, ellipse.cy);

    const batch = renderer.draw(this.accentColor, 1.5);
    batch.begin(this.accentColor, 1.5, { dashPattern: [4, 4] });
    batch.setAlpha(0.45);
    batch.ellipse(center, ellipse.a, ellipse.b);
    batch.stroke();
    batch.resetAlpha();
  }
}
