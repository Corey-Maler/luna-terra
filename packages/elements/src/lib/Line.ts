import { Rect2D, V2 } from '@lunaterra/math';
import { Handle, LTStyledElement, type CanvasRenderer, type LTElement, type LunaTerraEngine } from '@lunaterra/core';
import {
  type LineOptions,
  type LineExtraStyles,
  type LinePoint,
  isQuadratic,
  isCubic,
  pointDestination,
} from './line-types';
import {
  computeRoundedPath,
  startTangent,
  endTangent,
  tessellateFullPath,
  pathToFloat32,
  cumulativeLengths,
} from './line-geometry';
import { renderMarker } from './markers';

export class Line extends LTStyledElement<LineOptions, LineExtraStyles> {
  private _elapsedTime = 0;

  protected override defaultOptions(): LineOptions {
    return {
      points: [],
      cornerRadius: 0,
      startMarker: null,
      endMarker: null,
      closed: false,
      glow: null,
      flow: null,
      interactive: false,
    };
  }

  constructor(options?: Partial<LineOptions>, styles?: Partial<LineExtraStyles>) {
    super(options, {
      opacity: 1,
      color: null,
      lineWidth: 1,
      dashPattern: [],
      lineCap: 'butt',
      lineJoin: 'miter',
      ...styles,
    });
  }

  private _isFlowActive(): boolean {
    return !!(this.options.flow?.speed);
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    if (this._isFlowActive()) {
      engine.requestContinuousLoop();
    }
  }

  override destroy(): void {
    if (this._isFlowActive()) {
      this.engine?.releaseContinuousLoop();
    }
  }

  private _handles: Handle[] = [];

  override composeHelpers(): LTElement[] {
    if (!this.options.interactive) return [];

    this._handles = this.options.points.map((pt, i) => {
      const pos = pointDestination(pt);
      return new Handle(pos, {
        onDrag: (newPos: V2) => {
          // Replace the point in the array, preserving Bézier structure
          const original = this.options.points[i];
          if (isQuadratic(original)) {
            const delta = newPos.sub(original.to);
            this.options.points[i] = {
              to: newPos,
              quadratic: original.quadratic.add(delta),
            };
          } else if (isCubic(original)) {
            const delta = newPos.sub(original.to);
            this.options.points[i] = {
              to: newPos,
              cubic: [original.cubic[0].add(delta), original.cubic[1].add(delta)],
            };
          } else {
            this.options.points[i] = newPos;
          }
          this.engine?.requestUpdate();
        },
      });
    });

    return this._handles;
  }

  override getBounds(): Rect2D {
    const pts = this.options.points;
    if (pts.length === 0) return new Rect2D(new V2(0, 0), new V2(0, 0));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of pts) {
      const p = pointDestination(pt);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return new Rect2D(new V2(minX, minY), new V2(maxX, maxY));
  }

  override update(dt: number): void {
    if (this._isFlowActive()) {
      this._elapsedTime += dt / 1000;
      // No requestUpdate() needed — the continuous loop handles rendering
    }
  }

  override render(renderer: CanvasRenderer): void {
    const { points, cornerRadius, startMarker, endMarker, closed, glow, flow } = this.options;
    if (points.length < 2) return;

    const { color, opacity } = this.computedStyles;
    const { lineWidth, dashPattern, lineCap, lineJoin } = this.styles;
    const colorStr = color.opaque(opacity).toString();

    // ── WebGL glow layer (renders behind Canvas2D) ──────────────────────
    if (glow) {
      this._renderGlow(renderer, colorStr);
    }

    // ── Canvas2D crisp line ─────────────────────────────────────────────
    const batch = renderer.draw(colorStr, lineWidth);
    batch.begin(colorStr, lineWidth, { dashPattern });

    // Apply lineCap and lineJoin directly on the context
    const ctx = (renderer as unknown as { ctx: CanvasRenderingContext2D }).ctx;
    if (ctx) {
      ctx.lineCap = lineCap;
      ctx.lineJoin = lineJoin;
    }

    // Check if all segments are straight (needed for corner rounding)
    const allStraight = points.every((p, i) => i === 0 || !isQuadratic(p) && !isCubic(p));

    if (allStraight && cornerRadius && (typeof cornerRadius === 'number' ? cornerRadius > 0 : cornerRadius.some(r => r > 0))) {
      // Rounded-corner path for straight segments
      const verts = points.map(pointDestination);
      const ops = computeRoundedPath(verts, cornerRadius, closed);

      for (const op of ops) {
        switch (op.type) {
          case 'moveTo': batch.moveTo(op.p); break;
          case 'lineTo': batch.lineTo(op.p); break;
          case 'arcTo': batch.arcTo(op.through, op.end, op.radius); break;
        }
      }
    } else {
      // General path with potential Bézier segments
      batch.moveTo(pointDestination(points[0]));

      for (let i = 1; i < points.length; i++) {
        const seg = points[i];
        this._drawSegment(batch, points[i - 1], seg);
      }

      if (closed) {
        const firstPt = pointDestination(points[0]);
        const lastSeg = points[0];
        // Close back to start
        if (isQuadratic(lastSeg) || isCubic(lastSeg)) {
          this._drawSegment(batch, points[points.length - 1], lastSeg);
        } else {
          batch.lineTo(firstPt);
        }
      }
    }

    batch.stroke();

    // ── Markers ─────────────────────────────────────────────────────────
    if (startMarker) {
      const tangent = startTangent(points);
      renderMarker(batch, pointDestination(points[0]), tangent, startMarker, colorStr);
    }

    if (endMarker) {
      const tangent = endTangent(points);
      renderMarker(batch, pointDestination(points[points.length - 1]), tangent, endMarker, colorStr);
    }
  }

  private _drawSegment(batch: ReturnType<CanvasRenderer['draw']>, prev: LinePoint, seg: LinePoint): void {
    const dest = pointDestination(seg);

    if (isQuadratic(seg)) {
      batch.quadraticCurveTo(seg.quadratic, dest);
    } else if (isCubic(seg)) {
      batch.bezierCurveTo(seg.cubic[0], seg.cubic[1], dest);
    } else {
      batch.lineTo(dest);
    }
  }

  private _renderGlow(renderer: CanvasRenderer, _lineColorStr: string): void {
    const { points, glow, flow } = this.options;
    if (!glow || points.length < 2) return;

    const { color: glowColor, radius, intensity = 0.6 } = glow;
    const { color: computedColor, opacity } = this.computedStyles;
    const actualColor = glowColor ?? computedColor;

    // Tessellate the path for WebGL — follow corner rounding, not raw segments
    const { cornerRadius, closed } = this.options;
    const tessellated = tessellateFullPath(points, cornerRadius, closed);
    const flatPoints = pathToFloat32(tessellated);
    const totalLength = cumulativeLengths(tessellated);
    const pathLen = totalLength[totalLength.length - 1];

    // Build parametric coords (0..1 along path)
    const parametric = new Float32Array(tessellated.length);
    for (let i = 0; i < tessellated.length; i++) {
      parametric[i] = pathLen > 0 ? totalLength[i] / pathLen : 0;
    }

    try {
      renderer.webgl.renderGlowLine(
        flatPoints,
        parametric,
        {
          color: actualColor.opaque(opacity * intensity).toString(),
          radius,
          time: this._elapsedTime,
          flowSpeed: flow?.speed ?? 0,
          flowFrequency: 0,
          // Particles at full opacity so they stand out against the dim track
          flowColor: (flow?.color ?? computedColor).opaque(opacity).toString(),
          flowParticleCount: Math.min(80, Math.max(1, Math.ceil(pathLen * (flow?.particleDensity ?? 10)))),
          flowSpeedVariation: flow?.speedVariation,
          flowParticleHalfLen: flow?.particleLength,
          glowPlateauWidth: glow.plateauWidth,
          glowFalloff: glow.falloff,
        },
      );
    } catch {
      // WebGL glow not available — graceful fallback, just skip
    }
  }
}
