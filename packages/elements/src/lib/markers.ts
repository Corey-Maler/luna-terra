import { V2 } from '@lunaterra/math';
import type { DrawContext } from '@lunaterra/core';
import type { MarkerOptions } from './line-types';

/**
 * Render a line marker (arrowhead, diamond, circle, etc.) at `position`,
 * oriented along `tangent` (pointing away from the line).
 *
 * `batch` should already have its stroke/fill style configured.
 */
export function renderMarker(
  batch: DrawContext,
  position: V2,
  tangent: V2,
  marker: MarkerOptions,
  lineColor: string,
): void {
  if (marker.shape === 'none') return;

  const size = marker.size ?? 0.02;
  const filled = marker.filled ?? true;
  const angle = Math.atan2(tangent.y, tangent.x);

  // Helper: rotate a local-space offset by the tangent angle
  const rot = (lx: number, ly: number): V2 => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new V2(
      position.x + lx * cos - ly * sin,
      position.y + lx * sin + ly * cos,
    );
  };

  switch (marker.shape) {
    case 'arrow': {
      const tip = rot(0, 0);
      const left = rot(-size, size * 0.5);
      const right = rot(-size, -size * 0.5);

      if (filled) {
        batch.begin(lineColor, 1);
        batch.path([tip, left, right, tip]);
        batch.fill();
      } else {
        batch.begin(lineColor, 1);
        batch.path([left, tip, right]);
        batch.stroke();
      }
      break;
    }

    case 'triangle': {
      const tip = rot(0, 0);
      const left = rot(-size, size * 0.5);
      const right = rot(-size, -size * 0.5);

      batch.begin(lineColor, 1);
      batch.path([tip, left, right, tip]);
      if (filled) batch.fill();
      else batch.stroke();
      break;
    }

    case 'diamond': {
      const half = size * 0.5;
      const front = rot(half, 0);
      const top = rot(0, half);
      const back = rot(-half, 0);
      const bottom = rot(0, -half);

      batch.begin(lineColor, 1);
      batch.path([front, top, back, bottom, front]);
      if (filled) batch.fill();
      else batch.stroke();
      break;
    }

    case 'circle': {
      const radius = size * 0.4;
      batch.begin(lineColor, 1);
      batch.point(position, radius);
      if (filled) batch.fill();
      else batch.stroke();
      break;
    }

    case 'square': {
      const half = size * 0.4;
      const tl = rot(-half, half);
      const tr = rot(half, half);
      const br = rot(half, -half);
      const bl = rot(-half, -half);

      batch.begin(lineColor, 1);
      batch.path([tl, tr, br, bl, tl]);
      if (filled) batch.fill();
      else batch.stroke();
      break;
    }
  }
}
