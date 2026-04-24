export const Angles = {
  toDegrees: (radians: number) => radians * (180 / Math.PI),
  toRadians: (degrees: number) => degrees * (Math.PI / 180),
  normalize: (angle: number) => angle % (2 * Math.PI),
  d30: Math.PI / 6,
  d45: Math.PI / 4,
  d60: Math.PI / 3,
  d90: Math.PI / 2,
  d120: Math.PI * 2 / 3,
  d180: Math.PI,
  prettyPrint: (radians: number) => `${Angles.toDegrees(radians).toFixed(2)}°`
}
