import { V2 } from '@lunaterra/math';
import {
  type LinePoint,
  type CubicSegment,
  type QuadraticSegment,
  isQuadratic,
  isCubic,
  pointDestination,
} from './line-types';

// ─── Bézier evaluation ─────────────────────────────────────────────────────

/** Evaluate a quadratic Bézier B(t) = (1-t)²·p0 + 2(1-t)t·cp + t²·p1 */
function evalQuadratic(p0: V2, cp: V2, p1: V2, t: number): V2 {
  const u = 1 - t;
  return new V2(
    u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x,
    u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y,
  );
}

/** Evaluate a cubic Bézier B(t) = (1-t)³·p0 + 3(1-t)²t·c1 + 3(1-t)t²·c2 + t³·p1 */
function evalCubic(p0: V2, c1: V2, c2: V2, p1: V2, t: number): V2 {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return new V2(
    uuu * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + ttt * p1.x,
    uuu * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + ttt * p1.y,
  );
}

/** Tangent of a quadratic Bézier: B'(t) = 2(1-t)(cp-p0) + 2t(p1-cp) */
function tangentQuadratic(p0: V2, cp: V2, p1: V2, t: number): V2 {
  const u = 1 - t;
  return new V2(
    2 * u * (cp.x - p0.x) + 2 * t * (p1.x - cp.x),
    2 * u * (cp.y - p0.y) + 2 * t * (p1.y - cp.y),
  );
}

/** Tangent of a cubic Bézier */
function tangentCubic(p0: V2, c1: V2, c2: V2, p1: V2, t: number): V2 {
  const u = 1 - t;
  return new V2(
    3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p1.x - c2.x),
    3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p1.y - c2.y),
  );
}

// ─── Tessellation (for WebGL) ───────────────────────────────────────────────

/**
 * Subdivide a single segment into `steps` straight-line points.
 * Returns the list of V2s **including** `from` as the first element.
 */
export function tessellateSegment(from: V2, seg: LinePoint, steps: number): V2[] {
  const dest = pointDestination(seg);

  if (isQuadratic(seg)) {
    const pts: V2[] = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(evalQuadratic(from, seg.quadratic, dest, i / steps));
    }
    return pts;
  }

  if (isCubic(seg)) {
    const pts: V2[] = [];
    for (let i = 0; i <= steps; i++) {
      pts.push(evalCubic(from, seg.cubic[0], seg.cubic[1], dest, i / steps));
    }
    return pts;
  }

  // Straight segment — just the two endpoints.
  return [from, dest];
}

/**
 * Tessellate the full path into a flat list of V2 points suitable for WebGL rendering.
 * Bézier segments are subdivided; straight segments pass through as-is.
 * `resolution` controls how many subdivisions per Bézier segment.
 */
export function tessellatePath(points: LinePoint[], resolution = 16): V2[] {
  if (points.length < 2) return points.map(pointDestination);

  const result: V2[] = [pointDestination(points[0])];

  for (let i = 1; i < points.length; i++) {
    const from = pointDestination(points[i - 1]);
    const seg = points[i];

    if (isQuadratic(seg) || isCubic(seg)) {
      // Skip the first point (it's already in result from the previous segment)
      const sub = tessellateSegment(from, seg, resolution);
      for (let j = 1; j < sub.length; j++) {
        result.push(sub[j]);
      }
    } else {
      result.push(pointDestination(seg));
    }
  }

  return result;
}

/**
 * Convert a tessellated V2[] path into a flat Float32Array [x0, y0, x1, y1, …]
 * for WebGL consumption.
 */
export function pathToFloat32(points: V2[]): Float32Array {
  const arr = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    arr[i * 2] = points[i].x;
    arr[i * 2 + 1] = points[i].y;
  }
  return arr;
}

// ─── Tangents at endpoints ─────────────────────────────────────────────────

/**
 * Compute the tangent direction (normalised) at the start of the path.
 * Points away from the path (i.e. direction you'd draw a start-marker in).
 */
export function startTangent(points: LinePoint[]): V2 {
  if (points.length < 2) return new V2(1, 0);

  const p0 = pointDestination(points[0]);
  const seg = points[1];

  if (isQuadratic(seg)) {
    return tangentQuadratic(p0, seg.quadratic, seg.to, 0).normalize().scale(-1);
  }
  if (isCubic(seg)) {
    return tangentCubic(p0, seg.cubic[0], seg.cubic[1], seg.to, 0).normalize().scale(-1);
  }
  return p0.sub(pointDestination(seg)).normalize();
}

/**
 * Compute the tangent direction (normalised) at the end of the path.
 * Points away from the path (i.e. direction you'd draw an end-marker in).
 */
export function endTangent(points: LinePoint[]): V2 {
  if (points.length < 2) return new V2(1, 0);

  const last = points[points.length - 1];
  const prev = pointDestination(points[points.length - 2]);

  if (isQuadratic(last)) {
    return tangentQuadratic(prev, last.quadratic, last.to, 1).normalize();
  }
  if (isCubic(last)) {
    return tangentCubic(prev, last.cubic[0], last.cubic[1], last.to, 1).normalize();
  }
  return pointDestination(last).sub(prev).normalize();
}

// ─── Corner rounding ───────────────────────────────────────────────────────

/**
 * Given a straight-segment polyline and per-vertex corner radii, produce a
 * sequence of drawing commands that shorten each edge at interior vertices
 * and connect with arcs.
 *
 * Returns an array of "draw ops":
 * - `{ type: 'moveTo', p }` — start a sub-path
 * - `{ type: 'lineTo', p }` — straight line
 * - `{ type: 'arcTo', through: V2, end: V2, radius: number }` — arc corner
 */
export type DrawOp =
  | { type: 'moveTo'; p: V2 }
  | { type: 'lineTo'; p: V2 }
  | { type: 'arcTo'; through: V2; end: V2; radius: number };

export function computeRoundedPath(
  vertices: V2[],
  cornerRadius: number | number[],
  closed: boolean,
): DrawOp[] {
  const n = vertices.length;
  if (n < 2) return [];

  const getRadius = (interiorIdx: number) =>
    typeof cornerRadius === 'number'
      ? cornerRadius
      : (cornerRadius[interiorIdx] ?? 0);

  const ops: DrawOp[] = [];

  if (n === 2) {
    ops.push({ type: 'moveTo', p: vertices[0] });
    ops.push({ type: 'lineTo', p: vertices[1] });
    return ops;
  }

  // Determine which vertices are "interior" (get rounded).
  // For an open path: indices 1…n-2.  For closed: all vertices.
  const interiorStart = closed ? 0 : 1;
  const interiorEnd = closed ? n : n - 1;

  // Shortening amounts per vertex
  const shorten: number[] = new Array(n).fill(0);
  for (let i = interiorStart; i < interiorEnd; i++) {
    const r = getRadius(i - (closed ? 0 : 1));
    if (r <= 0) continue;

    const prevIdx = (i - 1 + n) % n;
    const nextIdx = (i + 1) % n;

    const toPrev = vertices[prevIdx].sub(vertices[i]);
    const toNext = vertices[nextIdx].sub(vertices[i]);
    const halfAngle = Math.acos(
      Math.max(-1, Math.min(1, toPrev.normalize().dot(toNext.normalize()))) 
    ) / 2;

    if (halfAngle < 1e-6) continue;

    // Maximum shorten is half the shorter adjacent edge
    const maxShorten = Math.min(toPrev.length(), toNext.length()) / 2;
    const desired = r / Math.tan(halfAngle);
    shorten[i] = Math.min(desired, maxShorten);
  }

  // Build draw ops
  if (!closed) {
    // Open path
    ops.push({ type: 'moveTo', p: vertices[0] });

    for (let i = 1; i < n - 1; i++) {
      const s = shorten[i];
      if (s <= 0) {
        ops.push({ type: 'lineTo', p: vertices[i] });
        continue;
      }

      const r = getRadius(i - 1);
      // Line to the entry point of the arc
      const dirIn = vertices[i].sub(vertices[i - 1]).normalize();
      const entry = vertices[i].sub(dirIn.scale(s));
      ops.push({ type: 'lineTo', p: entry });

      // Arc through the corner vertex to the exit point
      const dirOut = vertices[i + 1].sub(vertices[i]).normalize();
      const exit = vertices[i].add(dirOut.scale(s));
      ops.push({ type: 'arcTo', through: vertices[i], end: exit, radius: r });
    }

    ops.push({ type: 'lineTo', p: vertices[n - 1] });
  } else {
    // Closed path — every vertex can be rounded
    // Start at the exit of vertex 0's arc (or vertex 0 if no rounding)
    const s0 = shorten[0];
    if (s0 > 0) {
      const dirOut = vertices[1].sub(vertices[0]).normalize();
      const exitP = vertices[0].add(dirOut.scale(s0));
      ops.push({ type: 'moveTo', p: exitP });
    } else {
      ops.push({ type: 'moveTo', p: vertices[0] });
    }

    for (let idx = 1; idx <= n; idx++) {
      const i = idx % n;
      const s = shorten[i];
      if (s <= 0) {
        ops.push({ type: 'lineTo', p: vertices[i] });
        continue;
      }

      const r = getRadius(i);
      const prevIdx = (i - 1 + n) % n;
      const nextIdx = (i + 1) % n;
      const dirIn = vertices[i].sub(vertices[prevIdx]).normalize();
      const entry = vertices[i].sub(dirIn.scale(s));
      ops.push({ type: 'lineTo', p: entry });

      const dirOut = vertices[nextIdx].sub(vertices[i]).normalize();
      const exit = vertices[i].add(dirOut.scale(s));
      ops.push({ type: 'arcTo', through: vertices[i], end: exit, radius: r });
    }
  }

  return ops;
}

// ─── Cumulative path length (for glow parametric coord) ─────────────────────

/** Compute cumulative arc lengths for a tessellated V2[] path. */
export function cumulativeLengths(points: V2[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  return lengths;
}

// ─── Arc corner tessellation ───────────────────────────────────────────────

/**
 * Tessellate the arc drawn by `arcTo(corner, exit, radius)` from `entry`.
 * The arc geometry matches what `ctx.arcTo` draws, so the glow follows the
 * rounded corner exactly.
 *
 * Coordinate convention: Y-up world space (negative Y = up on screen).
 * Cross-product sign: > 0 → CCW turn, use left normal of d1.
 */
function tessellateArcCorner(
  entry: V2,
  corner: V2,
  exit: V2,
  radius: number,
  steps: number,
): V2[] {
  const dx1 = corner.x - entry.x;
  const dy1 = corner.y - entry.y;
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  if (len1 < 1e-10) return [entry, exit];

  const dx2 = exit.x - corner.x;
  const dy2 = exit.y - corner.y;
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (len2 < 1e-10) return [entry, exit];

  const d1x = dx1 / len1, d1y = dy1 / len1;
  const d2x = dx2 / len2, d2y = dy2 / len2;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-6) return [entry, exit]; // nearly straight

  // Normal pointing toward arc center (inside of the turn)
  // Y-up: cross > 0 → CCW turn → left normal of d1 is (-d1y, d1x)
  //       cross < 0 → CW turn  → right normal of d1 is ( d1y, -d1x)
  const nx = cross > 0 ? -d1y : d1y;
  const ny = cross > 0 ?  d1x : -d1x;

  const cx = entry.x + nx * radius;
  const cy = entry.y + ny * radius;

  const startAngle = Math.atan2(entry.y - cy, entry.x - cx);
  const endAngle   = Math.atan2(exit.y  - cy, exit.x  - cx);

  // Always sweep the short arc (< π), matching arcTo's behaviour
  let sweep = endAngle - startAngle;
  while (sweep >  Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;

  const pts: V2[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + sweep * (i / steps);
    pts.push(new V2(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
  }
  return pts;
}

/**
 * Tessellate the full drawn path — including rounded arc corners — into a V2[]
 * polyline for the WebGL glow shader.
 *
 * When the path has a corner radius this produces exactly the geometry that
 * `computeRoundedPath` + `Batch.arcTo` draws on Canvas2D, so the glow follows
 * the rounded shape rather than the raw straight segments.
 */
export function tessellateFullPath(
  points: LinePoint[],
  cornerRadius: number | number[],
  closed: boolean,
  resolution = 12,
): V2[] {
  if (points.length < 2) return points.map(pointDestination);

  const allStraight = points.every(
    (p, i) => i === 0 || (!isQuadratic(p) && !isCubic(p)),
  );

  const hasRadius =
    typeof cornerRadius === 'number'
      ? cornerRadius > 0
      : cornerRadius.some((r) => r > 0);

  if (!allStraight) {
    // Bézier segments — corner radius doesn't apply to them
    return tessellatePath(points, resolution);
  }

  if (!hasRadius) {
    return tessellatePath(points, resolution);
  }

  // Rounded straight path: convert DrawOps into V2 points
  const verts = points.map(pointDestination);
  const ops = computeRoundedPath(verts, cornerRadius, closed);

  const result: V2[] = [];
  let current: V2 | null = null;

  for (const op of ops) {
    switch (op.type) {
      case 'moveTo':
        result.push(op.p);
        current = op.p;
        break;
      case 'lineTo':
        result.push(op.p);
        current = op.p;
        break;
      case 'arcTo':
        if (current) {
          const arcPts = tessellateArcCorner(
            current,
            op.through,
            op.end,
            op.radius,
            resolution,
          );
          // Skip index 0 — it's the entry point already in result
          for (let j = 1; j < arcPts.length; j++) result.push(arcPts[j]);
          current = op.end;
        }
        break;
    }
  }

  return result;
}
