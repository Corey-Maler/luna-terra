/**
 * Simplified Keplerian orbital mechanics for the Luna-Terra orrery.
 *
 * All angles in radians.  Positions returned in a geocentric ecliptic frame
 * where Earth sits at the origin and the ecliptic plane is XZ (Y = up).
 *
 * Reference epoch: J2000.0  (2000-01-01T12:00:00 UTC)
 */

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/** J2000.0 epoch in milliseconds (Date.UTC(2000, 0, 1, 12, 0, 0)). */
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** Convert a Date to fractional Julian centuries since J2000. */
function julianCenturies(date: Date): number {
  return (date.getTime() - J2000_MS) / (36525 * 86_400_000);
}

/** Normalise an angle into [0, 2π). */
function mod2pi(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Solve Kepler's equation M = E − e·sin(E) via Newton–Raphson.
 * Returns eccentric anomaly E (radians).
 */
function solveKepler(M: number, e: number, iterations = 10): number {
  let E = M; // initial guess
  for (let i = 0; i < iterations; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * True anomaly from eccentric anomaly and eccentricity.
 */
function trueAnomaly(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}

// ── Moon orbital elements (mean, J2000-referenced) ───────────────────────

const MOON = {
  /** Sidereal period in days. */
  period: 27.321661,
  /** Eccentricity. */
  e: 0.0549,
  /** Inclination to the ecliptic (rad). */
  i: 5.145 * DEG,
  /** Mean longitude at J2000 (rad). */
  L0: 218.3165 * DEG,
  /** Mean anomaly at J2000 (rad). */
  M0: 134.9634 * DEG,
  /** Longitude of ascending node at J2000 (rad). */
  Omega0: 125.0446 * DEG,
  /** Argument of perigee at J2000 (rad). */
  omega0: 318.0634 * DEG,
  /** Rates per Julian century. */
  rates: {
    L: 481267.8813 * DEG,
    M: 477198.8676 * DEG,
    Omega: -1934.1362 * DEG,
    omega: 6003.1510 * DEG,
  },
} as const;

// ── Sun (really Earth's orbit) ───────────────────────────────────────────

const SUN = {
  /** Mean longitude at J2000 (rad). */
  L0: 280.46646 * DEG,
  /** Mean anomaly at J2000 (rad). */
  M0: 357.52911 * DEG,
  /** Rates per Julian century. */
  rates: {
    L: 36000.76983 * DEG,
    M: 35999.05029 * DEG,
  },
  /** Eccentricity (nearly circular). */
  e: 0.0167086,
} as const;

// ── Public API ───────────────────────────────────────────────────────────

export interface MoonPosition3D {
  /** Position on the ecliptic X axis (normalised, 1 = mean orbital distance). */
  x: number;
  /** Position perpendicular to the ecliptic plane (up). */
  y: number;
  /** Position on the ecliptic Z axis. */
  z: number;
  /** True anomaly (radians). */
  trueAnomaly: number;
  /** Orbital distance normalised to semi-major = 1. */
  r: number;
}

/**
 * Compute the Moon's 3D position relative to Earth, normalised so that
 * the semi-major axis distance = 1.
 */
export function computeMoonPosition(date: Date): MoonPosition3D {
  const T = julianCenturies(date);

  const M = mod2pi(MOON.M0 + MOON.rates.M * T);
  const Omega = mod2pi(MOON.Omega0 + MOON.rates.Omega * T);
  const omega = mod2pi(MOON.omega0 + MOON.rates.omega * T);

  const E = solveKepler(M, MOON.e);
  const nu = trueAnomaly(E, MOON.e);

  // Distance (normalised: a = 1)
  const r = (1 - MOON.e * MOON.e) / (1 + MOON.e * Math.cos(nu));

  // Position in the orbital plane
  const xOrb = r * Math.cos(nu);
  const yOrb = r * Math.sin(nu);

  // Rotate by argument of perigee
  const xPeri = xOrb * Math.cos(omega) - yOrb * Math.sin(omega);
  const yPeri = xOrb * Math.sin(omega) + yOrb * Math.cos(omega);

  // Apply inclination (rotate around the line of nodes)
  const cosI = Math.cos(MOON.i);
  const sinI = Math.sin(MOON.i);
  const xIncl = xPeri;
  const yIncl = yPeri * cosI;
  const zIncl = yPeri * sinI;

  // Rotate by longitude of ascending node into ecliptic frame
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const x = xIncl * cosO - yIncl * sinO;
  const z = xIncl * sinO + yIncl * cosO;
  const y = zIncl; // perpendicular to ecliptic

  return { x, y, z, trueAnomaly: nu, r };
}

/**
 * Compute the Sun's ecliptic longitude as seen from Earth (radians).
 * The Sun direction is the *opposite* of Earth's heliocentric position,
 * so we return the geocentric ecliptic longitude of the Sun.
 */
export function computeSunLongitude(date: Date): number {
  const T = julianCenturies(date);

  const M = mod2pi(SUN.M0 + SUN.rates.M * T);
  const E = solveKepler(M, SUN.e);
  const nu = trueAnomaly(E, SUN.e);

  // True longitude ≈ longitude of perihelion + true anomaly
  // Longitude of perihelion at J2000 ≈ 102.9373°
  const lonPeri = 102.9373 * DEG + 0.3225 * DEG * T;
  return mod2pi(lonPeri + nu);
}

/**
 * Moon phase angle (0 = new moon, π = full moon).
 *
 * This is the elongation: the angle Sun–Earth–Moon projected onto
 * the ecliptic, which directly determines the illumination fraction.
 */
export function computePhaseAngle(date: Date): number {
  const moon = computeMoonPosition(date);
  const sunLon = computeSunLongitude(date);

  // Moon's ecliptic longitude (ignoring latitude for phase computation)
  const moonLon = Math.atan2(moon.z, moon.x);

  return mod2pi(moonLon - sunLon);
}

/**
 * Earth's phase angle as seen from a distant viewpoint aligned with the
 * Sun direction.  For the orrery visualisation the Sun illuminates
 * the Earth from the sunLongitude direction on the ecliptic.
 *
 * Returns the angle in [0, 2π) describing which half of Earth is lit
 * relative to our viewing direction.
 */
export function computeEarthPhaseAngle(date: Date, viewLongitude: number): number {
  const sunLon = computeSunLongitude(date);
  return mod2pi(sunLon - viewLongitude + Math.PI);
}
