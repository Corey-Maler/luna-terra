import type { Color } from '@lunaterra/color';
import type { V2 } from '@lunaterra/math';

// ─── Segment model ──────────────────────────────────────────────────────────

/** A straight segment to the given point. */
export interface LineSegment {
  to: V2;
}

/** A quadratic Bézier segment. */
export interface QuadraticSegment {
  to: V2;
  quadratic: V2; // single control point
}

/** A cubic Bézier segment. */
export interface CubicSegment {
  to: V2;
  cubic: [V2, V2]; // two control points
}

/**
 * A single point in a line path.
 * - Plain `V2` → straight line to that point.
 * - Object with `quadratic` → quadratic Bézier segment.
 * - Object with `cubic` → cubic Bézier segment.
 */
export type LinePoint = V2 | QuadraticSegment | CubicSegment;

// ─── Markers ────────────────────────────────────────────────────────────────

export type MarkerShape = 'arrow' | 'triangle' | 'diamond' | 'circle' | 'square' | 'none';

export interface MarkerOptions {
  shape: MarkerShape;
  /** Size relative to world units. Defaults to 0.02. */
  size?: number;
  /** If true, marker is filled instead of stroked. Defaults to true. */
  filled?: boolean;
}

// ─── Glow / energy flow ────────────────────────────────────────────────────

export interface GlowOptions {
  /** Glow colour. Defaults to the line's computed colour. */
  color?: Color;
  /** World-space radius of the glow (controls total track width = plateauWidth + falloff). */
  radius: number;
  /** Peak intensity 0–1. Defaults to 0.6. */
  intensity?: number;
  /**
   * Half-width of the flat full-intensity plateau in world space.
   * Defaults to radius × 0.55 — override for a wider or narrower flat region.
   */
  plateauWidth?: number;
  /**
   * Width of each softening ramp at the track edges in world space.
   * Defaults to radius × 0.45 — override for sharper or softer edges.
   */
  falloff?: number;
}

export interface FlowOptions {
  /** How fast the particles travel along the line (world-units/sec). */
  speed: number;
  /**
   * @deprecated No longer used — particle count controls density instead.
   * Kept for backwards compatibility; has no effect when particleCount is set.
   */
  frequency: number;
  /** Optional override colour for the particles. Defaults to the line colour. */
  color?: Color;
  /** Particles per world-unit of path length. Default: 10. */
  particleDensity?: number;
  /** Fraction of speed variation applied randomly per particle. Default: 0.2 (±20%). */
  speedVariation?: number;
  /** Parametric half-length of each particle in 0..1 path space. Default: 0.015. */
  particleLength?: number;
}

// ─── Line options ──────────────────────────────────────────────────────────

export interface LineOptions {
  /** The sequence of points forming the line. First entry is the start. */
  points: LinePoint[];
  /**
   * Corner radius applied to straight-segment interior vertices.
   * A single number applies uniformly; an array sets per-vertex radii
   * (indexed from the first interior vertex, i.e. points[1]).
   */
  cornerRadius: number | number[];
  /** Marker drawn at the start of the line. */
  startMarker: MarkerOptions | null;
  /** Marker drawn at the end of the line. */
  endMarker: MarkerOptions | null;
  /** When true, connects the last point back to the first. */
  closed: boolean;
  /** WebGL glow layer options. */
  glow: GlowOptions | null;
  /** Energy-flow animation options (requires glow). */
  flow: FlowOptions | null;
  /** When true, shows draggable handles on each point and enables selection. */
  interactive: boolean;
}

export interface LineExtraStyles {
  lineWidth: number;
  dashPattern: number[];
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

// ─── Type guards ───────────────────────────────────────────────────────────

export function isQuadratic(p: LinePoint): p is QuadraticSegment {
  return typeof p === 'object' && 'quadratic' in p;
}

export function isCubic(p: LinePoint): p is CubicSegment {
  return typeof p === 'object' && 'cubic' in p;
}

/** Extract the destination V2 from any LinePoint. */
export function pointDestination(p: LinePoint): V2 {
  if ('x' in p && 'y' in p) return p as V2;
  return (p as QuadraticSegment | CubicSegment).to;
}
