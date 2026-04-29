/**
 * CelestialBody — an LTElement that draws a circle (planet/moon) with
 * a shadow crescent showing the current phase illumination.
 *
 * Two-colour rendering: background fill + accent stroke/shadow.
 * The shadow is drawn via screen-space clipping on the raw canvas context
 * because the batch API doesn't support elliptical arcs.
 */

import { V2 } from '@lunaterra/math';
import { LTElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';

export interface CelestialBodyOptions {
  /** World-space radius of the circle. */
  radius: number;
  /** Text label displayed near the body. */
  label: string;
  /** Whether the label appears above or below. */
  labelPosition: 'above' | 'below';
  /** Stroke width in CSS pixels. */
  strokePx: number;
}

/**
 * Mutable state set by the parent OrreryScene each frame.
 */
export interface CelestialBodyState {
  /** Phase angle: 0 = new (fully shadowed facing us), π = full (fully lit). */
  phaseAngle: number;
  /** Direction the light comes from in the body's local 2D frame (radians, 0 = right). */
  lightAngle: number;
  /** Accent colour string for stroke & shadow (theme-dependent). */
  accentColor: string;
  /** Background colour string for fill (theme-dependent). */
  bgColor: string;
}

export class CelestialBody extends LTElement<CelestialBodyOptions> {
  public state: CelestialBodyState = {
    phaseAngle: Math.PI, // full by default
    lightAngle: 0,
    accentColor: '#3c2a1a',
    bgColor: '#fcf9f2',
  };

  protected defaultOptions(): CelestialBodyOptions {
    return {
      radius: 0.06,
      label: '',
      labelPosition: 'below',
      strokePx: 3,
    };
  }

  render(renderer: CanvasRenderer) {
    const { radius, label, labelPosition, strokePx } = this.options;
    const { phaseAngle, accentColor, bgColor } = this.state;

    const origin = new V2(0, 0);

    // ── 1. Filled circle (background colour) ────────────────────────────
    const bg = renderer.draw(bgColor, 1);
    bg.arc(origin, radius);
    bg.fill();

    // ── 2. Shadow crescent (phase) ───────────────────────────────────────
    // Phase angle: 0 = new (fully shadowed), π = full (fully lit).
    // Terminator is an ellipse whose horizontal semi-axis =
    //   radius × |cos(phaseAngle)|.

    const cosPhase = Math.cos(phaseAngle);
    const terminatorRx = radius * Math.abs(cosPhase);
    const shadowOnRight = phaseAngle > Math.PI;

    if (Math.abs(phaseAngle - Math.PI) > 0.02) {
      const shadow = renderer.draw(accentColor, 1);

      // Clip to body circle
      shadow.save();
      shadow.arc(origin, radius);
      shadow.clip();

      shadow.beginPath();

      if (shadowOnRight) {
        // Dark semicircle on right, terminator ellipse back
        shadow.arc(origin, radius, -Math.PI / 2, Math.PI / 2, false);
        shadow.ellipse(origin, terminatorRx, radius, 0,
          Math.PI / 2, -Math.PI / 2, cosPhase > 0);
      } else {
        // Dark semicircle on left, terminator ellipse back
        shadow.arc(origin, radius, Math.PI / 2, -Math.PI / 2, false);
        shadow.ellipse(origin, terminatorRx, radius, 0,
          -Math.PI / 2, Math.PI / 2, cosPhase > 0);
      }

      shadow.closePath();
      shadow.setAlpha(0.18);
      shadow.fill();
      shadow.resetAlpha();

      shadow.restore(); // removes clip
    }

    // ── 3. Circle outline (accent stroke) ────────────────────────────────
    const outline = renderer.draw(accentColor, strokePx);
    outline.arc(origin, radius);
    outline.stroke();

    // ── 4. Label ─────────────────────────────────────────────────────────
    if (label) {
      const fontSize = 11;
      const gap = renderer.measureScreenInWorld(14); // extra clearance below body

      const textY = labelPosition === 'above'
        ? radius + gap
        : -(radius + gap + renderer.measureScreenInWorld(fontSize * 0.8));

      const lbl = renderer.draw(accentColor, 1);
      lbl.setAlpha(0.7);
      lbl.renderText(label.toUpperCase(), new V2(0, textY), fontSize, 'center', 'alphabetic');
      lbl.resetAlpha();
    }
  }
}
