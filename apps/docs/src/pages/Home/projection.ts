/**
 * Side-view projection for the orrery.
 *
 * We look at the Earth-Moon system from slightly above the ecliptic plane.
 * The circular orbit becomes an ellipse; objects closer to the viewer appear
 * larger, farther ones smaller.
 *
 * All inputs/outputs are in world-space units (engine's normalised 0–1-ish space).
 */

export interface ProjectionConfig {
  /** Elevation angle above the ecliptic plane, radians (default ~15°). */
  elevation: number;
  /** Base orbital distance in world units (Moon centre to Earth centre at r=1). */
  orbitRadius: number;
  /** Earth centre in world space. */
  center: { x: number; y: number };
}

export interface Projected {
  /** 2D position in world space. */
  x: number;
  y: number;
  /** Depth factor: >1 = closer to viewer (render larger), <1 = farther. */
  depth: number;
}

export const DEFAULT_PROJECTION: ProjectionConfig = {
  elevation: 30 * (Math.PI / 180),
  orbitRadius: 0.3,
  center: { x: 0.5, y: 0.5 },
};

/**
 * Project a Moon 3D position (normalised: semi-major = 1) into the 2D
 * world-space used by the engine.
 *
 * Coordinate mapping (ecliptic → screen):
 *  - ecliptic X → screen X  (left/right)
 *  - ecliptic Z → screen depth axis (foreshortened by cos(elevation))
 *  - ecliptic Y → nudges screen Y (perpendicular to ecliptic, small)
 *
 * "Screen Y" in the engine is inverted (positive = down in many canvas systems),
 * but the engine's transform makes positive-Y go *up* in world space.
 * We apply the projection so that the "far" side of the orbit goes up
 * (behind Earth) and the "near" side goes down (in front).
 */
export function projectMoon(
  moon: { x: number; y: number; z: number; r: number },
  cfg: ProjectionConfig = DEFAULT_PROJECTION,
): Projected {
  const cosEl = Math.cos(cfg.elevation);
  const sinEl = Math.sin(cfg.elevation);

  // Scale by orbital radius
  const wx = moon.x * cfg.orbitRadius;
  const wy = moon.y * cfg.orbitRadius; // perpendicular to ecliptic (inclination)
  const wz = moon.z * cfg.orbitRadius;

  // Project: foreshorten Z by cos(elevation), Y contributes to screen-Y
  const screenX = wx;
  const screenY = wz * sinEl + wy * cosEl;

  // Depth: objects with larger wz (going "into" the screen from top-down)
  // are farther away.  We invert so that positive depth = closer to viewer.
  // The depth range for a roughly circular orbit ≈ [-orbitRadius, +orbitRadius].
  // Map to a factor centred on 1, with ±depthAmplitude variation.
  const depthAmplitude = 0.18; // ±18% size change
  const rawDepth = -(wz * cosEl - wy * sinEl); // positive = closer
  const depth = 1 + (rawDepth / cfg.orbitRadius) * depthAmplitude;

  return {
    x: cfg.center.x + screenX,
    y: cfg.center.y + screenY,
    depth,
  };
}

/**
 * Compute the projected orbit ellipse semi-axes in world units.
 *
 * The circular orbit (radius = orbitRadius) viewed from `elevation` angle
 * becomes an ellipse:
 *   semi-major axis (horizontal) = orbitRadius  (X is not foreshortened)
 *   semi-minor axis (vertical)   = orbitRadius × sin(elevation)
 */
export function projectedOrbitEllipse(
  cfg: ProjectionConfig = DEFAULT_PROJECTION,
): { cx: number; cy: number; a: number; b: number } {
  return {
    cx: cfg.center.x,
    cy: cfg.center.y,
    a: cfg.orbitRadius,
    b: cfg.orbitRadius * Math.sin(cfg.elevation),
  };
}
