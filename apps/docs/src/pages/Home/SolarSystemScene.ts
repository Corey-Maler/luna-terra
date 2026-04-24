import { LTElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import type { LunaTerraEngine } from '@lunaterra/core';
import { V2 } from '@lunaterra/math';
import { computeMoonPosition } from './orbitalMechanics';

interface PlanetDef {
  key: PlanetKey;
  label: string;
  colorLight: string;
  colorDark: string;
  orbitColorLight: string;
  orbitColorDark: string;
  /** Pixel radius in full solar-system view (level 2). */
  radiusPxSolar: number;
  /** Pixel radius in inner-planets view (level 1). */
  radiusPxInner: number;
  /** Pixel radius in Luna-Terra view (level 0). */
  radiusPxLuna: number;
  orbit: OrbitalElements;
}

type PlanetKey =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

interface OrbitalElements {
  a: number; // AU
  e: number;
  i: number; // radians
  Omega: number; // longitude ascending node
  omega: number; // argument of perihelion
  M0: number; // mean anomaly at J2000
  periodDays: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface CameraBasis {
  position: Vec3;
  target: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  focal: number;
  worldScale: number;
  center: V2;
}

interface BodyRender {
  label: string;
  pos3: Vec3;
  pos2: V2;
  depth: number;
  radiusWorld: number;
  stroke: string;
  fill: string;
  darkFill: string;
  lightAngle: number;
  phaseAngle: number;
}

interface HoverTarget {
  label: string;
  center: V2;
  radiusWorld: number;
}

interface NearbyStarDef {
  label: string;
  /** 3D position in light-years from Sol. X toward galactic center, Y = up, Z toward Cygnus. */
  pos: Vec3;
  colorLight: string;
  colorDark: string;
  radiusPx: number;
}

interface GalaxyDot {
  x: number; // kly, centered on galactic center
  y: number; // kly
  colorKey: 'warm' | 'cool' | 'neutral';
}

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const AU_PER_LUNAR_DISTANCE = 384_400 / 149_597_870.7;
const MOON_SIDEREAL_PERIOD_DAYS = 27.321661;

// Camera distances for AU-space levels (0 = Luna, 1 = Inner, 2 = Solar)
const LUNA_CAMERA_DISTANCE_AU = 0.16;
const INNER_CAMERA_DISTANCE_AU = 5.5;
const SOLAR_CAMERA_DISTANCE_AU = 72;
const LUNA_VIEW_MOON_DISTANCE_SCALE = 5.1;

// Engine zoom factors per level
const LUNA_ZOOM = 9.5;
const INNER_ZOOM = 2.8;
const SOLAR_ZOOM = 1.05;
const STARS_ZOOM = 0.88;
const GALAXY_ZOOM = 0.82;

// Log-space zoom breakpoints for level↔zoom conversion (level 0 = Luna, 4 = Galaxy).
const LOG_ZOOM_LEVELS = [
  Math.log(LUNA_ZOOM),   // 0 → Luna-Terra
  Math.log(INNER_ZOOM),  // 1 → Inner Planets
  Math.log(SOLAR_ZOOM),  // 2 → Solar System
  Math.log(STARS_ZOOM),  // 3 → Nearby Stars
  Math.log(GALAXY_ZOOM), // 4 → Milky Way
];

/** Map viewport zoom factor → continuous scene level [0, 4]. Log-space interpolation. */
function zoomToLevel(zoom: number): number {
  const lz = Math.log(Math.max(1e-9, zoom));
  if (lz >= LOG_ZOOM_LEVELS[0]) return 0;
  if (lz <= LOG_ZOOM_LEVELS[4]) return 4;
  for (let i = 0; i < 4; i++) {
    if (lz >= LOG_ZOOM_LEVELS[i + 1]) {
      return i + (lz - LOG_ZOOM_LEVELS[i]) / (LOG_ZOOM_LEVELS[i + 1] - LOG_ZOOM_LEVELS[i]);
    }
  }
  return 4;
}

// Stars-view projection: world-units per light-year
const STARS_WORLD_SCALE = 0.19;
const STARS_CAMERA_DISTANCE_LY = 22;

// Galaxy scale: world-units per kilo-light-year; Sol ~27.7 kly from center
const GALAXY_KLY_SCALE = 0.006;
const SOL_GALACTIC_KLY = 27.7;

const PLANETS: PlanetDef[] = [
  {
    key: 'mercury',
    label: 'Mercury',
    colorLight: '#7f7569',
    colorDark: '#a99c8e',
    orbitColorLight: '#8d7964',
    orbitColorDark: '#9f8e7d',
    radiusPxSolar: 3,
    radiusPxInner: 4,
    radiusPxLuna: 2,
    orbit: {
      a: 0.387098,
      e: 0.205635,
      i: 7.005 * DEG,
      Omega: 48.331 * DEG,
      omega: 29.124 * DEG,
      M0: 174.796 * DEG,
      periodDays: 87.969,
    },
  },
  {
    key: 'venus',
    label: 'Venus',
    colorLight: '#c8aa74',
    colorDark: '#e0c99d',
    orbitColorLight: '#9b8054',
    orbitColorDark: '#b4976a',
    radiusPxSolar: 4,
    radiusPxInner: 5,
    radiusPxLuna: 2,
    orbit: {
      a: 0.723332,
      e: 0.006772,
      i: 3.39458 * DEG,
      Omega: 76.68 * DEG,
      omega: 54.884 * DEG,
      M0: 50.115 * DEG,
      periodDays: 224.701,
    },
  },
  {
    key: 'earth',
    label: 'Terra',
    colorLight: '#d8c4a0',
    colorDark: '#c2ac86',
    orbitColorLight: '#8a7b68',
    orbitColorDark: '#9f8f7d',
    radiusPxSolar: 5,
    radiusPxInner: 7,
    radiusPxLuna: 110,
    orbit: {
      a: 1.0,
      e: 0.0167086,
      i: 0.00005 * DEG,
      Omega: -11.26064 * DEG,
      omega: 102.94719 * DEG,
      M0: 357.529 * DEG,
      periodDays: 365.256,
    },
  },
  {
    key: 'mars',
    label: 'Mars',
    colorLight: '#b06f52',
    colorDark: '#c78b70',
    orbitColorLight: '#927262',
    orbitColorDark: '#a88a79',
    radiusPxSolar: 4,
    radiusPxInner: 5,
    radiusPxLuna: 2,
    orbit: {
      a: 1.523679,
      e: 0.0934,
      i: 1.8497 * DEG,
      Omega: 49.558 * DEG,
      omega: 286.502 * DEG,
      M0: 19.373 * DEG,
      periodDays: 686.98,
    },
  },
  {
    key: 'jupiter',
    label: 'Jupiter',
    colorLight: '#b7936d',
    colorDark: '#d1b392',
    orbitColorLight: '#8f735d',
    orbitColorDark: '#a18771',
    radiusPxSolar: 8,
    radiusPxInner: 4,
    radiusPxLuna: 3,
    orbit: {
      a: 5.2026,
      e: 0.04849,
      i: 1.303 * DEG,
      Omega: 100.464 * DEG,
      omega: 273.867 * DEG,
      M0: 20.02 * DEG,
      periodDays: 4332.59,
    },
  },
  {
    key: 'saturn',
    label: 'Saturn',
    colorLight: '#b79d74',
    colorDark: '#ccb994',
    orbitColorLight: '#8f7d60',
    orbitColorDark: '#a39475',
    radiusPxSolar: 7,
    radiusPxInner: 3,
    radiusPxLuna: 3,
    orbit: {
      a: 9.5549,
      e: 0.05555,
      i: 2.489 * DEG,
      Omega: 113.665 * DEG,
      omega: 339.392 * DEG,
      M0: 317.02 * DEG,
      periodDays: 10759.22,
    },
  },
  {
    key: 'uranus',
    label: 'Uranus',
    colorLight: '#6a9ca8',
    colorDark: '#8eb6c0',
    orbitColorLight: '#6f8791',
    orbitColorDark: '#7f98a1',
    radiusPxSolar: 6,
    radiusPxInner: 2,
    radiusPxLuna: 2,
    orbit: {
      a: 19.2184,
      e: 0.0463,
      i: 0.773 * DEG,
      Omega: 74.006 * DEG,
      omega: 96.998857 * DEG,
      M0: 142.2386 * DEG,
      periodDays: 30688.5,
    },
  },
  {
    key: 'neptune',
    label: 'Neptune',
    colorLight: '#4f79ba',
    colorDark: '#6f94cb',
    orbitColorLight: '#627ea5',
    orbitColorDark: '#7492ba',
    radiusPxSolar: 6,
    radiusPxInner: 2,
    radiusPxLuna: 2,
    orbit: {
      a: 30.11,
      e: 0.009,
      i: 1.77 * DEG,
      Omega: 131.784 * DEG,
      omega: 272.846 * DEG,
      M0: 256.228 * DEG,
      periodDays: 60195,
    },
  },
];

// ── Nearby stars: ~16 real stars with approximate Cartesian positions in ly ──
// Coordinate frame: X toward galactic center, Y = galactic north, Z toward Cygnus.
// All positions relative to Sol at origin.
const NEARBY_STARS: NearbyStarDef[] = [
  { label: 'Proxima Cen',   pos: { x: -1.29, y: -1.06, z:  3.83 }, colorLight: '#c97b5e', colorDark: '#e09070', radiusPx: 3 },
  { label: '\u03b1 Centauri',    pos: { x: -1.25, y: -1.02, z:  3.70 }, colorLight: '#f0d890', colorDark: '#f5e4a8', radiusPx: 4 },
  { label: "Barnard's",     pos: { x:  0.13, y:  1.50, z: -5.81 }, colorLight: '#bf6040', colorDark: '#d87858', radiusPx: 3 },
  { label: 'Wolf 359',      pos: { x: -7.08, y:  1.20, z:  2.91 }, colorLight: '#c06040', colorDark: '#d87050', radiusPx: 3 },
  { label: 'Lalande 21185', pos: { x: -3.53, y:  6.96, z:  3.29 }, colorLight: '#c87050', colorDark: '#dd8870', radiusPx: 3 },
  { label: 'Sirius',        pos: { x: -1.48, y: -5.91, z:  5.34 }, colorLight: '#b8cce8', colorDark: '#d0dff5', radiusPx: 5 },
  { label: 'Luyten 726',   pos: { x: -3.44, y: -5.49, z:  6.46 }, colorLight: '#c06040', colorDark: '#d87050', radiusPx: 3 },
  { label: 'Ross 154',      pos: { x:  5.61, y: -5.44, z: -4.19 }, colorLight: '#c57050', colorDark: '#dc8868', radiusPx: 3 },
  { label: '\u03b5 Eridani',    pos: { x: -3.16, y: -6.60, z: -6.95 }, colorLight: '#e8a060', colorDark: '#f0bc80', radiusPx: 4 },
  { label: 'Procyon',       pos: { x: -2.36, y:  2.25, z: 10.77 }, colorLight: '#f5ead0', colorDark: '#fff5e8', radiusPx: 4 },
  { label: '61 Cygni',      pos: { x:  7.67, y:  3.17, z: -8.02 }, colorLight: '#de9060', colorDark: '#f0a878', radiusPx: 4 },
  { label: '\u03c4 Ceti',       pos: { x: -5.22, y: -9.14, z:  4.94 }, colorLight: '#f0d070', colorDark: '#f8e298', radiusPx: 4 },
  { label: 'GJ 1061',       pos: { x:  1.61, y: -9.86, z: -4.73 }, colorLight: '#c07050', colorDark: '#d88870', radiusPx: 3 },
  { label: 'YZ Ceti',       pos: { x: -3.00, y: -9.85, z:  4.46 }, colorLight: '#bf6040', colorDark: '#d87860', radiusPx: 3 },
  { label: "Kapteyn's",     pos: { x: -1.30, y: -11.4, z:  0.98 }, colorLight: '#c86040', colorDark: '#dc7860', radiusPx: 3 },
  { label: 'Vega',          pos: { x:  7.80, y: 18.6,  z: -6.00 }, colorLight: '#c8d8f8', colorDark: '#dce8ff', radiusPx: 4 },
];

function mod2pi(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

function solveKepler(M: number, e: number, iterations = 10): number {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function darkenHex(hex: string, factor: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;

  const v = m[1];
  const r = Math.max(0, Math.min(255, Math.round(parseInt(v.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(v.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(v.slice(4, 6), 16) * factor)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

function julianDays(date: Date): number {
  return (date.getTime() - J2000_MS) / 86_400_000;
}

function planetPositionFromMeanAnomaly(orbit: OrbitalElements, M: number): Vec3 {
  const E = solveKepler(M, orbit.e);
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + orbit.e) * Math.sin(E / 2),
    Math.sqrt(1 - orbit.e) * Math.cos(E / 2),
  );
  const r = orbit.a * (1 - orbit.e * Math.cos(E));

  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);

  const cosO = Math.cos(orbit.Omega);
  const sinO = Math.sin(orbit.Omega);
  const cosI = Math.cos(orbit.i);
  const sinI = Math.sin(orbit.i);
  const cosW = Math.cos(orbit.omega);
  const sinW = Math.sin(orbit.omega);

  // Orbital plane -> ecliptic coordinates, using XZ as the ecliptic plane.
  const x = (cosO * cosW - sinO * sinW * cosI) * xOrb
    + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
  const z = (sinO * cosW + cosO * sinW * cosI) * xOrb
    + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
  const y = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

  return { x, y, z };
}

function computePlanetPosition(orbit: OrbitalElements, date: Date): Vec3 {
  const d = julianDays(date);
  const n = TWO_PI / orbit.periodDays;
  const M = mod2pi(orbit.M0 + n * d);
  return planetPositionFromMeanAnomaly(orbit, M);
}

/**
 * Build a camera basis for AU-space levels 0–2.
 *
 * cameraBlend:
 *   0 = Luna-Terra view  (target: Earth, distance: 0.16 AU)
 *   1 = Inner Planets view (target: Sun, distance: 5.5 AU)
 *   2 = Full Solar System view (target: Sun, distance: 72 AU)
 *
 * Interpolation is piecewise between adjacent integer levels.
 */
function makeCamera(cameraBlend: number, center: V2, earth: Vec3): CameraBasis {
  const azimuth = 32 * DEG;

  // Per-level camera parameters
  const elevations  = [18 * DEG, 24 * DEG, 26 * DEG];
  const distances   = [LUNA_CAMERA_DISTANCE_AU, INNER_CAMERA_DISTANCE_AU, SOLAR_CAMERA_DISTANCE_AU];
  const targets: Vec3[] = [earth, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
  const focals      = [0.95, 1.05, 1.15];
  const worldScales = [0.88, 0.90, 0.92];

  const b  = clamp(cameraBlend, 0, 2);
  const lo = Math.min(Math.floor(b), 1);
  const hi = lo + 1;
  const t  = b - lo;

  const elevation = lerp(elevations[lo], elevations[hi], t);
  const distance  = lerp(distances[lo],  distances[hi],  t);
  const target    = lerpVec3(targets[lo], targets[hi], t);
  const focal     = lerp(focals[lo],      focals[hi],      t);
  const worldScale = lerp(worldScales[lo], worldScales[hi], t);

  const forwardFromTarget = normalize({
    x: Math.cos(elevation) * Math.cos(azimuth),
    y: Math.sin(elevation),
    z: Math.cos(elevation) * Math.sin(azimuth),
  });

  const position = add(target, scale(forwardFromTarget, distance));
  const forward  = normalize(sub(target, position));
  const worldUp  = { x: 0, y: 1, z: 0 };
  const right    = normalize(cross(forward, worldUp));
  const up       = normalize(cross(right, forward));

  return { position, target, right, up, forward, focal, worldScale, center };
}

function projectPoint(p: Vec3, camera: CameraBasis): { pos: V2; depth: number } {
  const rel = sub(p, camera.position);
  const cx = dot(rel, camera.right);
  const cy = dot(rel, camera.up);
  const cz = Math.max(1e-6, dot(rel, camera.forward));

  const sx = (camera.focal * cx) / cz;
  const sy = (camera.focal * cy) / cz;

  return {
    pos: new V2(
      camera.center.x + sx * camera.worldScale,
      camera.center.y + sy * camera.worldScale,
    ),
    depth: cz,
  };
}

function lightDirectionAngle(body: Vec3, camera: CameraBasis): number {
  const toSun = normalize(scale(body, -1));
  const lx = dot(toSun, camera.right);
  const ly = dot(toSun, camera.up);
  return Math.atan2(ly, lx);
}

function phaseAngle(body: Vec3, camera: CameraBasis): number {
  const toSun = normalize(scale(body, -1));
  const toViewer = normalize(sub(camera.position, body));
  const fullAngle = Math.acos(clamp(dot(toSun, toViewer), -1, 1)); // 0=full, π=new
  return Math.PI - fullAngle; // 0=new, π=full
}

function drawBody(renderer: CanvasRenderer, body: BodyRender, showLabel: boolean) {
  const origin = body.pos2;

  const bg = renderer.batch(body.fill, 1);
  bg.arc(origin, body.radiusWorld);
  bg.fill();

  const cosPhase = Math.cos(body.phaseAngle);
  const terminatorRx = body.radiusWorld * Math.abs(cosPhase);
  const shadowOnRight = body.phaseAngle > Math.PI;

  if (Math.abs(body.phaseAngle - Math.PI) > 0.02) {
    const theta = body.lightAngle;
    const shadow = renderer.batch(body.darkFill, 1);

    shadow.save();
    shadow.arc(origin, body.radiusWorld);
    shadow.clip();

    shadow.beginPath();

    if (shadowOnRight) {
      // Right-side shadow hemisphere in the rotated light frame.
      shadow.arc(origin, body.radiusWorld, theta - Math.PI / 2, theta + Math.PI / 2, false);
      shadow.ellipse(origin, terminatorRx, body.radiusWorld, theta, Math.PI / 2, -Math.PI / 2, cosPhase > 0);
    } else {
      // Left-side shadow hemisphere in the rotated light frame.
      shadow.arc(origin, body.radiusWorld, theta + Math.PI / 2, theta - Math.PI / 2, false);
      shadow.ellipse(origin, terminatorRx, body.radiusWorld, theta, -Math.PI / 2, Math.PI / 2, cosPhase > 0);
    }

    shadow.closePath();
    shadow.fill();
    shadow.restore();
  }

  // Keep a high-contrast contour so bodies remain visible on dark backgrounds.
  const outline = renderer.batch(body.stroke, 2.1);
  outline.arc(origin, body.radiusWorld);
  outline.stroke();

  if (showLabel) {
    const lbl = renderer.batch(body.stroke, 1);
    lbl.save();
    lbl.setAlpha(0.7);
    lbl.renderText(body.label.toUpperCase(), new V2(origin.x, origin.y - body.radiusWorld - renderer.measureScreenInWorld(16)), 10, 'center', 'alphabetic');
    lbl.restore();
  }
}

function drawOrbitPath(
  renderer: CanvasRenderer,
  camera: CameraBasis,
  orbit: OrbitalElements,
  color: string,
  alpha = 1,
) {
  const segments = 160;
  const path = renderer.batch(color, 1.1);
  path.renew(color, 1.1, { dashPattern: [4, 5] });
  path.setAlpha(0.38 * alpha);

  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * TWO_PI;
    const p = planetPositionFromMeanAnomaly(orbit, M);
    const projected = projectPoint(p, camera).pos;
    if (i === 0) path.moveTo(projected);
    else path.lineTo(projected);
  }

  path.stroke();
  path.resetAlpha();
}

function drawMoonOrbitPath(
  renderer: CanvasRenderer,
  camera: CameraBasis,
  earth: Vec3,
  date: Date,
  color: string,
  distanceScale: number,
  alpha = 1,
) {
  const segments = 180;
  const path = renderer.batch(color, 1.15);
  path.renew(color, 1.15, { dashPattern: [3, 4] });
  path.setAlpha(0.48 * alpha);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sampleDate = new Date(date.getTime() + t * MOON_SIDEREAL_PERIOD_DAYS * 86_400_000);
    const moonGeo = computeMoonPosition(sampleDate);
    const moonOffset = scale(
      {
        x: moonGeo.x * AU_PER_LUNAR_DISTANCE,
        y: moonGeo.y * AU_PER_LUNAR_DISTANCE,
        z: moonGeo.z * AU_PER_LUNAR_DISTANCE,
      },
      distanceScale,
    );
    const moonPoint = add(earth, moonOffset);
    const projected = projectPoint(moonPoint, camera).pos;

    if (i === 0) path.moveTo(projected);
    else path.lineTo(projected);
  }

  path.stroke();
  path.resetAlpha();
}

// ── Nearby Stars view ────────────────────────────────────────────────────────────────────────────

/**
 * Draw Sol's stellar neighborhood with a simple elevated-perspective camera.
 * Units: light-years, Sol at origin.
 */
function drawStarsView(
  renderer: CanvasRenderer,
  center: V2,
  dark: boolean,
  alpha: number,
) {
  const azimuth   = 30 * DEG;
  const elevation = 28 * DEG;

  const fwdFromCam = normalize({
    x: Math.cos(elevation) * Math.cos(azimuth),
    y: Math.sin(elevation),
    z: Math.cos(elevation) * Math.sin(azimuth),
  });

  const camTarget: Vec3 = { x: 0, y: 0, z: 0 };
  const camPos = add(camTarget, scale(fwdFromCam, STARS_CAMERA_DISTANCE_LY));
  const forward = normalize(sub(camTarget, camPos));
  const worldUp = { x: 0, y: 1, z: 0 };
  const right   = normalize(cross(forward, worldUp));
  const up      = normalize(cross(right, forward));

  const camera: CameraBasis = {
    position: camPos, target: camTarget,
    right, up, forward,
    focal: 1.0, worldScale: STARS_WORLD_SCALE,
    center,
  };

  const accent     = dark ? '#c8b8a8' : '#3c2a1a';
  const solFill    = dark ? '#f5c97a' : '#f2c47b';
  const solStroke  = dark ? '#efe2cd' : '#5a3512';
  const solRadius  = renderer.measureScreenInWorld(5);

  // Sol
  const solProj = projectPoint({ x: 0, y: 0, z: 0 }, camera);
  const sBg = renderer.batch(solFill, 1);
  sBg.save(); sBg.setAlpha(alpha);
  sBg.arc(solProj.pos, solRadius);
  sBg.fill();
  sBg.restore();

  const sOut = renderer.batch(solStroke, 1.5);
  sOut.save(); sOut.setAlpha(alpha);
  sOut.arc(solProj.pos, solRadius);
  sOut.stroke();
  sOut.restore();

  const sLbl = renderer.batch(accent, 1);
  sLbl.save(); sLbl.setAlpha(0.75 * alpha);
  sLbl.renderText('SOL', new V2(solProj.pos.x, solProj.pos.y - solRadius - renderer.measureScreenInWorld(14)), 9, 'center', 'alphabetic');
  sLbl.restore();

  // Nearby stars
  for (const star of NEARBY_STARS) {
    const proj = projectPoint(star.pos, camera);
    const r    = renderer.measureScreenInWorld(star.radiusPx);
    const fill = dark ? star.colorDark : star.colorLight;

    const bg = renderer.batch(fill, 1);
    bg.save(); bg.setAlpha(alpha);
    bg.arc(proj.pos, r);
    bg.fill();
    bg.restore();

    const out = renderer.batch(accent, 1.2);
    out.save(); out.setAlpha(0.4 * alpha);
    out.arc(proj.pos, r);
    out.stroke();
    out.restore();

    const lbl = renderer.batch(accent, 1);
    lbl.save(); lbl.setAlpha(0.6 * alpha);
    lbl.renderText(
      star.label.toUpperCase(),
      new V2(proj.pos.x, proj.pos.y - r - renderer.measureScreenInWorld(13)),
      8, 'center', 'alphabetic',
    );
    lbl.restore();
  }

  // Scale bar: 10 ly
  const b0: Vec3 = { x: -8, y: -12, z:  8 };
  const b1: Vec3 = { x:  2, y: -12, z:  8 };
  const bp0 = projectPoint(b0, camera).pos;
  const bp1 = projectPoint(b1, camera).pos;
  const barB = renderer.batch(accent, 1.2);
  barB.save(); barB.setAlpha(0.4 * alpha);
  barB.moveTo(bp0);
  barB.lineTo(bp1);
  barB.stroke();
  barB.restore();
  const mid = new V2((bp0.x + bp1.x) / 2, (bp0.y + bp1.y) / 2);
  const barLbl = renderer.batch(accent, 1);
  barLbl.save(); barLbl.setAlpha(0.4 * alpha);
  barLbl.renderText('10 LY', new V2(mid.x, mid.y - renderer.measureScreenInWorld(10)), 8, 'center', 'alphabetic');
  barLbl.restore();
}

// ── Galaxy dotfield ─────────────────────────────────────────────────────────────────────────────────

/**
 * Render the Milky Way as a pre-generated top-down dotfield.
 * Origin = galactic center; Sol at (-SOL_GALACTIC_KLY, 0) kly.
 */
function drawGalaxyView(
  renderer: CanvasRenderer,
  center: V2,
  dark: boolean,
  alpha: number,
  dots: GalaxyDot[],
) {
  const accent     = dark ? '#c8b8a8' : '#3c2a1a';
  const warmFill   = dark ? '#8c6a3a' : '#c49a60';
  const coolFill   = dark ? '#5a7a9a' : '#7090b0';
  const neutralFill = dark ? '#7a7068' : '#9a9080';
  const dotRadius  = renderer.measureScreenInWorld(1.3);

  // Batch draws: group by color to minimize renew() calls
  const warm: V2[]    = [];
  const cool: V2[]    = [];
  const neutral: V2[] = [];

  for (const dot of dots) {
    const p = new V2(center.x + dot.x * GALAXY_KLY_SCALE, center.y + dot.y * GALAXY_KLY_SCALE);
    if (dot.colorKey === 'warm')    warm.push(p);
    else if (dot.colorKey === 'cool') cool.push(p);
    else                            neutral.push(p);
  }

  for (const [color, group] of [[warmFill, warm], [coolFill, cool], [neutralFill, neutral]] as [string, V2[]][]) {
    const b = renderer.batch(color, 1);
    b.save(); b.setAlpha(0.55 * alpha);
    for (const p of group) {
      b.moveTo(new V2(p.x + dotRadius, p.y)); // start fresh subpath; prevents connecting lines between arcs
      b.arc(p, dotRadius);
    }
    b.fill();
    b.restore();
  }

  // Galactic center marker
  const gcPos    = new V2(center.x, center.y);
  const gcRadius = renderer.measureScreenInWorld(3.5);
  const gcFill   = dark ? '#c09040' : '#e0b060';
  const gcBg = renderer.batch(gcFill, 1);
  gcBg.save(); gcBg.setAlpha(0.55 * alpha);
  gcBg.arc(gcPos, gcRadius);
  gcBg.fill();
  gcBg.restore();

  const gcLbl = renderer.batch(accent, 1);
  gcLbl.save(); gcLbl.setAlpha(0.55 * alpha);
  gcLbl.renderText('GALACTIC CENTER', new V2(gcPos.x, gcPos.y - gcRadius - renderer.measureScreenInWorld(13)), 8, 'center', 'alphabetic');
  gcLbl.restore();

  // Sol marker
  const solWX    = center.x + (-SOL_GALACTIC_KLY) * GALAXY_KLY_SCALE;
  const solWY    = center.y;
  const solPos   = new V2(solWX, solWY);
  const solRadius = renderer.measureScreenInWorld(3);
  const solFill   = dark ? '#f5c97a' : '#f2c47b';
  const solStroke = dark ? '#efe2cd' : '#5a3512';

  const solBg = renderer.batch(solFill, 1);
  solBg.save(); solBg.setAlpha(alpha);
  solBg.arc(solPos, solRadius);
  solBg.fill();
  solBg.restore();

  const solOut = renderer.batch(solStroke, 1.5);
  solOut.save(); solOut.setAlpha(alpha);
  solOut.arc(solPos, solRadius);
  solOut.stroke();
  solOut.restore();

  const solLbl = renderer.batch(accent, 1);
  solLbl.save(); solLbl.setAlpha(0.8 * alpha);
  solLbl.renderText('SOL', new V2(solWX, solWY - solRadius - renderer.measureScreenInWorld(13)), 8, 'center', 'alphabetic');
  solLbl.restore();

  // Scale bar: 10 kly
  const barLen = 10 * GALAXY_KLY_SCALE;
  const barY   = center.y + 35 * GALAXY_KLY_SCALE;
  const barX0  = center.x - barLen / 2;
  const barX1  = center.x + barLen / 2;
  const barB = renderer.batch(accent, 1.2);
  barB.save(); barB.setAlpha(0.4 * alpha);
  barB.moveTo(new V2(barX0, barY));
  barB.lineTo(new V2(barX1, barY));
  barB.stroke();
  barB.restore();

  const barLbl = renderer.batch(accent, 1);
  barLbl.save(); barLbl.setAlpha(0.4 * alpha);
  barLbl.renderText('10 KLY', new V2((barX0 + barX1) / 2, barY - renderer.measureScreenInWorld(10)), 8, 'center', 'alphabetic');
  barLbl.restore();
}

// ── Galaxy dot pre-generation ─────────────────────────────────────────────────────────────────────────

/**
 * Generate galaxy dots in kly units (top-down, galactic center at origin).
 * Uses a deterministic LCG so the galaxy shape is reproducible across re-renders.
 */
function generateGalaxyDots(count: number): GalaxyDot[] {
  const dots: GalaxyDot[] = [];

  // Simple LCG for reproducible galaxy shape
  let seed = 0x5A3C9F;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const diskScale  = 16;   // kly exponential scale length
  const bulgeR     = 3;    // kly central bulge radius
  const numArms    = 4;
  const armWind    = 0.28; // radians per kly
  const armScatter = 2.8;  // Gaussian scatter in kly

  let i = 0;
  while (i < count) {
    const u = rng();
    let x: number, y: number;
    let colorKey: GalaxyDot['colorKey'];

    if (u < 0.28) {
      // Central bulge
      const r     = bulgeR * Math.pow(rng(), 0.5);
      const angle = rng() * TWO_PI;
      x = r * Math.cos(angle);
      y = r * Math.sin(angle) * 0.6; // slight z-flatten
      colorKey = 'warm';
    } else {
      // Disk + spiral arm overdensity
      const r = -diskScale * Math.log(Math.max(1e-9, rng()));
      if (r > 55) continue; // discard far outliers

      let angle = rng() * TWO_PI;

      if (rng() < 0.6) {
        const arm      = Math.floor(rng() * numArms);
        const armAngle = (TWO_PI / numArms) * arm + armWind * r;
        // Box-Muller for Gaussian scatter
        const scatter  = armScatter * Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(rng() * TWO_PI);
        angle = armAngle + scatter / (r + 1);
      }

      x = r * Math.cos(angle);
      y = r * Math.sin(angle) * 0.35; // flatten to thin disk

      if      (r < 8)  colorKey = 'warm';
      else if (r < 22) colorKey = 'neutral';
      else             colorKey = 'cool';
    }

    dots.push({ x, y, colorKey });
    i++;
  }
  return dots;
}

// ── Scene class ────────────────────────────────────────────────────────────────────────────────────

/**
 * Zoom level definitions:
 *   0 = Luna-Terra       (geocentric close-up)
 *   1 = Inner Planets    (rocky-planet zone)
 *   2 = Solar System     (full heliocentric view)
 *   3 = Nearby Stars     (Sol’s stellar neighborhood, ~20 ly)
 *   4 = Milky Way        (galactic-scale dotfield)
 */
export class SolarSystemScene extends LTElement<{}> {
  private _date = new Date();
  private _dark = false;

  // Continuous float 0–4, derived from engine.renderer.zoom each frame
  // unless the ruler is actively dragging (_viewportControlled = false).
  private _zoomLevel = 2;
  // When true (default), _zoomLevel is derived from the viewport zoom each frame.
  // Set to false by setZoomLevelDirect() while the ruler caret is being dragged.
  private _viewportControlled = true;
  // Simulation time (ms), advances at 100 000× real time inside update().
  private _simMs = Date.now();

  /**
   * Fired every frame while the zoom level changes (viewport scroll, button click,
   * or zoom animation). External UI such as ScaleRuler subscribes to stay in sync.
   */
  public onZoomLevelChange: ((level: number) => void) | null = null;

  private _hoveredLabel: string | null = null;
  private _hoverTargets: HoverTarget[] = [];
  private _hoverUnsub?: () => void;

  private _galaxyDots: GalaxyDot[] = [];

  protected defaultOptions() {
    return {};
  }

  set date(v: Date) {
    this._date = v;
    this.engine?.requestUpdate();
  }

  set dark(v: boolean) {
    this._dark = v;
    this.engine?.requestUpdate();
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    this._galaxyDots = generateGalaxyDots(4000);
    this._hoverUnsub = engine.renderer.$mousePosition.subscribe((mouse: V2) => {
      let nextHovered: string | null = null;

      // Check nearest/front-most first.
      for (let i = this._hoverTargets.length - 1; i >= 0; i--) {
        const t = this._hoverTargets[i];
        if (mouse.distanceTo(t.center) <= t.radiusWorld * 1.25) {
          nextHovered = t.label;
          break;
        }
      }

      if (nextHovered !== this._hoveredLabel) {
        this._hoveredLabel = nextHovered;
        engine.requestUpdate();
      }
    });
  }

  override destroy(): void {
    this._hoverUnsub?.();
    this._hoverUnsub = undefined;
    this._hoverTargets = [];
    this._hoveredLabel = null;
  }

  override update(dt: number): void {
    // ── Continuous 100 000× time simulation ──────────────────────────────
    this._simMs += dt * 100_000;
    this._date = new Date(this._simMs);
    this.engine?.requestUpdate(); // keep the loop running

    // ── Derive scene level from viewport zoom ─────────────────────────────
    // Skip when the ruler is actively dragging (viewport not yet synced).
    if (this._viewportControlled && this.engine) {
      const newLevel = zoomToLevel(this.engine.renderer.zoom);
      if (Math.abs(newLevel - this._zoomLevel) > 1e-4) {
        this._zoomLevel = newLevel;
        this.onZoomLevelChange?.(this._zoomLevel);
      }
    }
  }

  /**
   * Directly set the zoom level for live ruler-drag feedback.
   * The scene content updates immediately; the viewport zoom is updated by the
   * nav method that fires on drag release.
   */
  public setZoomLevelDirect(v: number): void {
    this._viewportControlled = false;
    this._zoomLevel = clamp(v, 0, 4);
    this.engine?.requestUpdate();
  }

  private _screenCenter(): V2 {
    if (!this.engine) return new V2(0, 0);
    const r = this.engine.renderer;
    return r.screenToWorld(new V2(r.canvas.width / 2, r.canvas.height / 2));
  }

  // ── Public navigation API ──────────────────────────────────────────────────

  /**
   * Sync the viewport zoom to match a level without re-deriving _zoomLevel from it.
   * Used by the ruler on snap-complete so the scene content stays put while the
   * viewport quietly animates to the correct zoom.
   * Call resumeViewportControl() once the viewport animation finishes.
   */
  public syncViewportToLevel(level: 0 | 1 | 2 | 3 | 4): void {
    if (!this.engine) return;
    const ZOOMS: Record<0 | 1 | 2 | 3 | 4, number> = {
      0: LUNA_ZOOM, 1: INNER_ZOOM, 2: SOLAR_ZOOM, 3: STARS_ZOOM, 4: GALAXY_ZOOM,
    };
    this.engine.zoomToPoint(this._screenCenter(), ZOOMS[level]);
    this.engine.requestUpdate();
  }

  /** Re-enable viewport-zoom → scene-level derivation (call after syncViewportToLevel settles). */
  public resumeViewportControl(): void {
    this._viewportControlled = true;
  }

  public zoomToLunaTerra() {
    this._viewportControlled = true;
    if (!this.engine) return;
    this.engine.zoomToPoint(this._screenCenter(), LUNA_ZOOM);
    this.engine.requestUpdate();
  }

  public goToInnerPlanets() {
    this._viewportControlled = true;
    if (!this.engine) return;
    this.engine.zoomToPoint(this._screenCenter(), INNER_ZOOM);
    this.engine.requestUpdate();
  }

  public goToSolarSystem() {
    this._viewportControlled = true;
    if (!this.engine) return;
    this.engine.zoomToPoint(this._screenCenter(), SOLAR_ZOOM);
    this.engine.requestUpdate();
  }

  public goToNearbyStars() {
    this._viewportControlled = true;
    if (!this.engine) return;
    this.engine.zoomToPoint(this._screenCenter(), STARS_ZOOM);
    this.engine.requestUpdate();
  }

  public goToMilkyWay() {
    this._viewportControlled = true;
    if (!this.engine) return;
    this.engine.zoomToPoint(this._screenCenter(), GALAXY_ZOOM);
    this.engine.requestUpdate();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  override render(renderer: CanvasRenderer) {
    const center = renderer.screenToWorld(
      new V2(renderer.canvas.width / 2, renderer.canvas.height / 2),
    );

    const z = this._zoomLevel;

    // Alpha weights — triangle functions, each peaks at its integer level.
    const lunaWeight   = clamp(1 - z, 0, 1);               // peaks at 0
    const innerWeight  = clamp(1 - Math.abs(z - 1), 0, 1); // peaks at 1
    const solarWeight  = clamp(1 - Math.abs(z - 2), 0, 1); // peaks at 2
    const starsWeight  = clamp(1 - Math.abs(z - 3), 0, 1); // peaks at 3
    const galaxyWeight = clamp(z - 3, 0, 1);               // peaks at 4

    // auWeight controls fade-out of the solar-system view as we zoom to stars
    const auWeight = clamp(3 - z, 0, 1);

    // ── AU-space rendering (levels 0–2) ──────────────────────────────────
    if (auWeight > 0.01) {
      const earthDef = PLANETS.find((p) => p.key === 'earth')!;
      const earth = computePlanetPosition(earthDef.orbit, this._date);
      const cameraBlend = clamp(z, 0, 2);
      const camera = makeCamera(cameraBlend, center, earth);

      // Orbit paths
      if (solarWeight > 0.01) {
        for (const planet of PLANETS) {
          drawOrbitPath(renderer, camera, planet.orbit,
            this._dark ? planet.orbitColorDark : planet.orbitColorLight,
            solarWeight * auWeight);
        }
      }
      if (innerWeight > 0.01) {
        for (const planet of PLANETS.filter((p) => ['mercury', 'venus', 'earth', 'mars'].includes(p.key))) {
          drawOrbitPath(renderer, camera, planet.orbit,
            this._dark ? planet.orbitColorDark : planet.orbitColorLight,
            innerWeight * auWeight);
        }
      }
      if (lunaWeight > 0.01) {
        const moonDistScale = lerp(1, LUNA_VIEW_MOON_DISTANCE_SCALE, lunaWeight);
        drawOrbitPath(renderer, camera, earthDef.orbit,
          this._dark ? earthDef.orbitColorDark : earthDef.orbitColorLight,
          lunaWeight * auWeight);
        drawMoonOrbitPath(renderer, camera, earth, this._date,
          this._dark ? '#b8aa99' : '#7c6754', moonDistScale, lunaWeight * auWeight);
      }

      // Bodies
      const bodies: BodyRender[] = [];

      // Sun — tri-lerp radius across levels
      let sunPx: number;
      if (z <= 1) sunPx = lerp(7, 13, z);
      else        sunPx = lerp(13, 11, z - 1);

      const sunProj = projectPoint({ x: 0, y: 0, z: 0 }, camera);
      bodies.push({
        label: 'Sol', pos3: { x: 0, y: 0, z: 0 },
        pos2: sunProj.pos, depth: sunProj.depth,
        radiusWorld: renderer.measureScreenInWorld(sunPx),
        stroke: this._dark ? '#efe2cd' : '#5a3512',
        fill:   this._dark ? '#7a5a2f' : '#f2c47b',
        darkFill: this._dark ? '#3e2d17' : '#9d6e31',
        lightAngle: 0, phaseAngle: Math.PI,
      });

      for (const planet of PLANETS) {
        const p3 = computePlanetPosition(planet.orbit, this._date);
        const pp = projectPoint(p3, camera);
        let radiusPx: number;
        if (z <= 1) radiusPx = lerp(planet.radiusPxLuna, planet.radiusPxInner, z);
        else        radiusPx = lerp(planet.radiusPxInner, planet.radiusPxSolar, z - 1);

        bodies.push({
          label: planet.label, pos3: p3,
          pos2: pp.pos, depth: pp.depth,
          radiusWorld: renderer.measureScreenInWorld(radiusPx),
          stroke:   this._dark ? '#ead8c8' : '#3c2a1a',
          fill:     this._dark ? planet.colorDark   : planet.colorLight,
          darkFill: darkenHex(this._dark ? planet.colorDark : planet.colorLight, this._dark ? 0.38 : 0.48),
          lightAngle: lightDirectionAngle(p3, camera),
          phaseAngle: phaseAngle(p3, camera),
        });
      }

      // Luna
      const moonDistScale = lerp(1, LUNA_VIEW_MOON_DISTANCE_SCALE, lunaWeight);
      const moonGeo = computeMoonPosition(this._date);
      const moonOffset = scale(
        { x: moonGeo.x * AU_PER_LUNAR_DISTANCE, y: moonGeo.y * AU_PER_LUNAR_DISTANCE, z: moonGeo.z * AU_PER_LUNAR_DISTANCE },
        moonDistScale,
      );
      const moon3 = add(earth, moonOffset);
      const moonProj = projectPoint(moon3, camera);
      const moonPx = z <= 1 ? lerp(60, 2, z) : 2;

      bodies.push({
        label: 'Luna', pos3: moon3,
        pos2: moonProj.pos, depth: moonProj.depth,
        radiusWorld: renderer.measureScreenInWorld(moonPx),
        stroke: this._dark ? '#f1e5d7' : '#3c2a1a',
        fill:   this._dark ? '#978d86' : '#d1c6bd',
        darkFill: this._dark ? '#5f5751' : '#7f746b',
        lightAngle: lightDirectionAngle(moon3, camera),
        phaseAngle: phaseAngle(moon3, camera),
      });

      bodies.sort((a, b) => b.depth - a.depth);

      this._hoverTargets = bodies.map((b) => ({
        label: b.label, center: b.pos2, radiusWorld: b.radiusWorld,
      }));

      // Fade bodies out as we zoom to stars view
      const fade = renderer.batch('#000', 1);
      fade.save();
      fade.setAlpha(auWeight);
      for (const body of bodies) {
        drawBody(renderer, body, this._hoveredLabel === body.label);
      }
      fade.restore();
    }

    // ── Nearby Stars rendering (levels 2–4) ───────────────────────────────
    if (starsWeight > 0.01) {
      drawStarsView(renderer, center, this._dark, starsWeight);
    }

    // ── Galaxy rendering (levels 3–4) ────────────────────────────────────
    if (galaxyWeight > 0.01) {
      drawGalaxyView(renderer, center, this._dark, galaxyWeight, this._galaxyDots);
    }
  }
}
