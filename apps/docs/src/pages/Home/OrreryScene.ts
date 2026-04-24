/**
 * OrreryScene — root LTElement that composes the Earth, Moon, and orbit path.
 *
 * Owns the simulation state (current date, play/pause, speed) and each frame
 * recomputes orbital positions, phase angles, and depth-based sizing.
 */

import { V2 } from '@lunaterra/math';
import { LTElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import type { LunaTerraEngine } from '@lunaterra/core';
import { CelestialBody } from './CelestialBody';
import { OrbitPath } from './OrbitPath';
import {
  computeMoonPosition,
  computeSunLongitude,
  computePhaseAngle,
  computeEarthPhaseAngle,
} from './orbitalMechanics';
import { projectMoon, DEFAULT_PROJECTION } from './projection';
import type { ProjectionConfig } from './projection';

export interface OrrerySceneOptions {
  /** World-space radius for Earth. */
  earthRadius: number;
  /** World-space radius for Moon (at average distance, before depth scaling). */
  moonRadius: number;
  /** Projection configuration. */
  projection: ProjectionConfig;
  /** Accent colour for light theme. */
  accentLight: string;
  /** Accent colour for dark theme. */
  accentDark: string;
  /** Background colour for light theme. */
  bgLight: string;
  /** Background colour for dark theme. */
  bgDark: string;
}

export class OrreryScene extends LTElement<OrrerySceneOptions> {
  // ── Simulation state ───────────────────────────────────────────────────
  private _date = new Date();
  private _dark = false;

  // ── Children ───────────────────────────────────────────────────────────
  private _earth!: CelestialBody;
  private _moon!: CelestialBody;
  private _orbitPath!: OrbitPath;

  // ── Mouse hover subscription ──────────────────────────────────────────
  private _hoverUnsub?: () => void;

  protected defaultOptions(): OrrerySceneOptions {
    return {
      earthRadius: 0.12,
      moonRadius: 0.065,
      projection: DEFAULT_PROJECTION,
      accentLight: '#3c2a1a',
      accentDark: '#c8b8a8',
      bgLight: '#fcf9f2',
      bgDark: '#0e0e0f',
    };
  }

  // ── Public API (called from React / TimeControl) ───────────────────────

  get date(): Date {
    return this._date;
  }

  set date(d: Date) {
    this._date = d;
    this.engine?.requestUpdate();
  }

  get dark(): boolean {
    return this._dark;
  }

  set dark(v: boolean) {
    this._dark = v;
    this.engine?.requestUpdate();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  setup(engine: LunaTerraEngine) {
    super.setup(engine);
    // Subscribe to mouse position to drive Moon hover (LTElement.testHover is not
    // wired into the InteractionManager — only Handle instances are).
    this._hoverUnsub = engine.renderer.$mousePosition.subscribe((p: V2) => {
      if (!this._moon) return;
      const dist = p.distanceTo(this._moon.position);
      const hit = dist <= this._moon.options.radius * 1.4;
      const wasVisible = this._orbitPath.visible;
      this._orbitPath.visible = hit;
      if (this._orbitPath.visible !== wasVisible) {
        engine.requestUpdate();
      }
    });
  }

  destroy() {
    this._hoverUnsub?.();
  }

  compose(): LTElement[] {
    const opts = this.options;

    this._earth = new CelestialBody({
      radius: opts.earthRadius,
      label: 'terra',
      labelPosition: 'above',
      strokePx: 3,
    });

    this._moon = new CelestialBody({
      radius: opts.moonRadius,
      label: 'luna',
      labelPosition: 'below',
      strokePx: 3,
    });

    this._orbitPath = new OrbitPath({
      projectionConfig: opts.projection,
    });

    return [this._orbitPath, this._earth, this._moon];
  }

  override update(_dt: number) {
    // Time is driven externally by TimeControl via the `date` setter.
    // Nothing to do here.
  }

  override render(renderer: CanvasRenderer) {
    // Dynamically compute the viewport centre in world space so the scene
    // is always centred regardless of canvas aspect ratio / zoom.
    const canvas = renderer.canvas;
    const midScreen = new V2(canvas.width / 2, canvas.height / 2);
    const worldCenter = renderer.screenToWorld(midScreen);

    // Build a projection config centred on the current viewport middle
    const proj: ProjectionConfig = {
      ...this.options.projection,
      center: { x: worldCenter.x, y: worldCenter.y },
    };

    this._recompute(proj);
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private _recompute(proj: ProjectionConfig) {
    const opts = this.options;
    const date = this._date;

    // Theme colours
    const accent = this._dark ? opts.accentDark : opts.accentLight;
    const bg = this._dark ? opts.bgDark : opts.bgLight;

    // ── Moon position ────────────────────────────────────────────────────
    const moonPos3D = computeMoonPosition(date);
    const projected = projectMoon(moonPos3D, proj);

    this._moon.position = new V2(projected.x, projected.y);
    this._moon.options.radius = opts.moonRadius * projected.depth;

    // ── Lighting ─────────────────────────────────────────────────────────
    // Both bodies are lit by the same Sun. We project the Sun direction onto
    // our side-view X axis: sunLon ∈ [0,π) → Sun on right (+X) → shadow left;
    // sunLon ∈ [π,2π) → Sun on left → shadow right.
    // Encode as phaseAngle: 0 = new (fully shadowed), π = full (fully lit).
    // Moon phase is a real astronomical quantity; Earth uses the same sun angle
    // so both bodies always show shadow on the same side.
    const sunLon = computeSunLongitude(date);
    const moonPhase = computePhaseAngle(date);
    // Earth phase: continuously varying shadow based on Sun's ecliptic longitude
    // as projected onto our side-view (viewLongitude = π/2 = our viewing direction).
    // This gives mod2pi(sunLon + π/2): shadow rotates continuously with the Sun,
    // always on the same side as the Moon's shadow.
    const earthPhase = computeEarthPhaseAngle(date, Math.PI / 2);

    // ── Update body states ───────────────────────────────────────────────
    this._moon.state = {
      phaseAngle: moonPhase,
      lightAngle: sunLon,
      accentColor: accent,
      bgColor: bg,
    };

    this._earth.state = {
      phaseAngle: earthPhase,
      lightAngle: sunLon,
      accentColor: accent,
      bgColor: bg,
    };

    this._orbitPath.accentColor = accent;
    this._orbitPath.liveProjection = proj;

    // Earth sits at the projection centre
    this._earth.position = new V2(proj.center.x, proj.center.y);

    // ── Z-ordering: if Moon is behind Earth, draw Earth on top ───────────
    // We swap children order based on depth.
    // projected.depth < 1 means Moon is farther from viewer → behind Earth.
    if (this.children) {
      // Always: [orbitPath, back body, front body]
      const moonBehind = projected.depth < 1;
      if (moonBehind) {
        this.children[0] = this._orbitPath;
        this.children[1] = this._moon;
        this.children[2] = this._earth;
      } else {
        this.children[0] = this._orbitPath;
        this.children[1] = this._earth;
        this.children[2] = this._moon;
      }
    }
  }
}
