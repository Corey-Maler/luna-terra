import { type M3, Rect2D, V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';

// NOTE: this is a shared drawing context, not a native canvas batch primitive.

// export interface LL {
//   moveTo(v: V2): void;

//   lineTo(v: V2): void;
//   arc(v: V2, radius: number, startAngle?: number, endAngle?: number, clk?: boolean): void;

//   updateViewMatrix(vm: M3): void;

//   beginPath(): void;
//   stroke(): void;

//   fill(): void;
//   fillText(text: string, p: V2, color?: string, fontSize?: number): void;

//   set fillStyle(color: string);

//   set strokeStyle(color: string);

//   p(points: number[]): void;
// }

export class LLSoftware {
  protected viewMatrix: M3;
  protected readonly ctx: CanvasRenderingContext2D;
  protected currentPoint: V2 | null = null;

  constructor(viewMatrix: M3, ctx: CanvasRenderingContext2D) {
    this.viewMatrix = viewMatrix;
    this.ctx = ctx;
  }

  public p() {
    throw new Error('not implemented');
  }

  updateViewMatrix(vm: M3) {
    this.viewMatrix = vm;
  }

  protected toPixels(p: V2) {
    const pp = this.viewMatrix.multiplyV2(p);
    return pp;
  }

  /** Convert a world-space V2 to canvas-pixel V2 using the current view matrix. */
  public toPixelsPub(p: V2) {
    return this.viewMatrix.multiplyV2(p);
  }

  public moveTo(v: V2) {
    this.currentPoint = v;
    const p = this.viewMatrix.multiplyV2(v);
    this.ctx.moveTo(p.x, p.y);
  }

  public lineTo(v: V2) {
    this.currentPoint = v;
    const p = this.viewMatrix.multiplyV2(v);
    this.ctx.lineTo(p.x, p.y);
  }

  public beginPath() {
    this.currentPoint = null;
    this.ctx.beginPath();
  }

  public stroke() {
    this.ctx.stroke();
  }

  public fill() {
    this.ctx.fill();
  }

  public set fillStyle(color: string) {
    this.ctx.fillStyle = color;
  }

  public set strokeStyle(color: string) {
    this.ctx.strokeStyle = color;
  }

  public fillText(
    text: string,
    p: V2,
    color = 'black',
    fontSize = 14,
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'alphabetic'
  ) {
    const pp = this.viewMatrix.multiplyV2(p);

    const prevAlign = this.ctx.textAlign;
    const prevBaseline = this.ctx.textBaseline;
    this.ctx.fillStyle = color;
    const hdpi = window.devicePixelRatio || 1;
    this.ctx.font = `${fontSize * hdpi}px Arial`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, pp.x, pp.y);
    this.ctx.textAlign = prevAlign;
    this.ctx.textBaseline = prevBaseline;
  }

  public quadraticCurveTo(control: V2, end: V2) {
    const cp = this.viewMatrix.multiplyV2(control);
    const ep = this.viewMatrix.multiplyV2(end);
    this.ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
    this.currentPoint = end;
  }

  public bezierCurveTo(cp1: V2, cp2: V2, end: V2) {
    const c1 = this.viewMatrix.multiplyV2(cp1);
    const c2 = this.viewMatrix.multiplyV2(cp2);
    const ep = this.viewMatrix.multiplyV2(end);
    this.ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, ep.x, ep.y);
    this.currentPoint = end;
  }

  public arcTo(through: V2, end: V2, radius: number) {
    const tp = this.viewMatrix.multiplyV2(through);
    const ep = this.viewMatrix.multiplyV2(end);
    // Transform radius from world to screen space
    const o = this.viewMatrix.multiplyV2(new V2(0, 0));
    const r = this.viewMatrix.multiplyV2(new V2(radius, 0));
    const screenRadius = Math.abs(r.x - o.x);
    this.ctx.arcTo(tp.x, tp.y, ep.x, ep.y, screenRadius);
    this.currentPoint = end;
  }

  public arc = (
    v: V2,
    radius: number,
    startAngle = 0,
    endAngle = Math.PI * 2,
    clk = false
  ) => {
    const p = this.viewMatrix.multiplyV2(v);
    const v1 = this.viewMatrix.multiplyV2(new V2(0, 0));
    const v2 = this.viewMatrix.multiplyV2(new V2(radius, 0));
    this.ctx.arc(p.x, p.y, Math.abs(v2.x - v1.x), startAngle, endAngle, clk);
  };

  /**
   * Ellipse in world space.
   * @param center  Centre of the ellipse (world coords).
   * @param rx      Semi-axis along the local X direction (world units).
   * @param ry      Semi-axis along the local Y direction (world units).
   * @param rotation   Rotation of the ellipse in radians (default 0).
   * @param startAngle Start angle in radians (default 0).
   * @param endAngle   End angle in radians (default 2π).
   * @param anticlockwise  Direction (default false).
   */
  public ellipse = (
    center: V2,
    rx: number,
    ry: number,
    rotation = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
    anticlockwise = false,
  ) => {
    const p = this.viewMatrix.multiplyV2(center);
    const o = this.viewMatrix.multiplyV2(new V2(0, 0));
    const ex = this.viewMatrix.multiplyV2(new V2(rx, 0));
    const ey = this.viewMatrix.multiplyV2(new V2(0, ry));
    const sRx = Math.abs(ex.x - o.x);
    const sRy = Math.abs(ey.y - o.y);
    this.ctx.ellipse(p.x, p.y, sRx, sRy, rotation, startAngle, endAngle, anticlockwise);
  };

  public closePath() {
    this.ctx.closePath();
  }
  // }

  /* for native if needed
protected transformToViewSpace() {
  if (NATIVE_TRANSFORM) {
    const transform = true;

    if (transform) {
      this.ctx.setTransform(
        this.zoom,
        0,
        0,
        this.zoom,
        this.center.x,
        this.center.y
      );
    }

    this.ctx.transform(
      this.worldSpaceMatrix.matrix[0],
      this.worldSpaceMatrix.matrix[1],
      this.worldSpaceMatrix.matrix[3],
      this.worldSpaceMatrix.matrix[4],
      this.worldSpaceMatrix.matrix[6],
      this.worldSpaceMatrix.matrix[7]
    );
  }
}
*/
}

export class DrawContext extends LLSoftware {
  private color: string | Color = '#000000';
  private preservePath = false;

  /** Direct access to the underlying canvas 2D context. */
  public get ctx2d(): CanvasRenderingContext2D { return this.ctx; }

  /** Save the underlying canvas context state (for clip regions, etc.). */
  save() { this.ctx.save(); }

  /** Restore the underlying canvas context state. */
  restore() { this.ctx.restore(); }

  /** Apply the current path as a clip region. */
  clip() { this.ctx.clip(); }

  /** Set globalAlpha (0–1). Remember to call resetAlpha() when done. */
  setAlpha(a: number) { this.ctx.globalAlpha = a; }

  /** Reset globalAlpha to 1. */
  resetAlpha() { this.ctx.globalAlpha = 1; }
  // constructor(
  //   private readonly ll: LL,
  //   color: string | Color,
  //   private lineWidth = 1,
  // ) {
  //   this.color = color;

  //   this.begin();
  // }

  pss = () => {
    const grad = this.ctx.createLinearGradient(50, 50, 150, 150);
    grad.addColorStop(0, 'red');
    grad.addColorStop(1, 'black');

    this.ctx.strokeStyle = grad;
  };

  begin = (
    newColor?: string | Color,
    width?: number,
    opts: { preservePath?: boolean; dashPattern?: number[] } = {}
  ) => {
    this.preservePath = opts.preservePath ?? false;
    if (newColor) {
      this.color = newColor;
    }
    //this.ctx.beginPath();
    this.ctx.lineWidth = width ?? 1;
    if (opts.dashPattern) {
      this.ctx.setLineDash(opts.dashPattern);
    } else {
      this.ctx.setLineDash([]);
    }
    this.ctx.strokeStyle = this.color.toString();
    if (!this.preservePath) {
      this.beginPath();
    }
  };

  line = (start: V2, end: V2) => {
    this.moveTo(start);
    this.lineTo(end);
  };

  linePath = (start: V2, end: V2) => {
    if (this.currentPoint && this.currentPoint.closeEnough(start, 1e-9)) {
      // already there
    } else {
      this.moveTo(start);
    }
    this.lineTo(end);
  };

  // p = (points: number[]) => {
  //   this.p(points);
  // };

  path = (points: V2[]) => {
    if (points.length < 2) {
      return;
    }

    const p0 = points[0];
    this.moveTo(p0);

    for (let i = 1; i < points.length; i++) {
      this.lineTo(points[i]);
    }
  };

  rect = (p1: V2 | Rect2D, p2?: V2) => {
    if (p1 instanceof Rect2D) {
      this.rect(p1.v1, p1.v2);
      return;
    }

    if (!p2) {
      throw new Error('rect overload not implemented');
    }

    this.moveTo(p1);
    this.lineTo(new V2(p1.x, p2.y));
    this.lineTo(p2);
    this.lineTo(new V2(p2.x, p1.y));
    this.lineTo(p1);
  };

  override stroke = () => {
    if (this.preservePath) {
      return;
    }
    // this.strokeStyle = this.color.toString();
    super.stroke();
  };

  override fill = (color?: Color) => {
    this.fillStyle = color?.toString() ?? this.color.toString();
    super.fill();
  };

  renderText = (
    text: string,
    p: V2,
    size?: number,
    align?: CanvasTextAlign,
    baseline?: CanvasTextBaseline
  ) => {
    this.fillText(text, p, this.color.toString(), size, align, baseline);
  };

  fillGradientBelow = (points: V2[], yFillTo: number, color: Color, opacity: number) => {
    if (points.length < 2) return;

    // Build screen-space gradient extent
    let maxY = points[0].y;
    for (const pt of points) {
      if (pt.y > maxY) maxY = pt.y;
    }
    const screenTop = this.toPixels(new V2(0, maxY)).y;
    const screenBottom = this.toPixels(new V2(0, yFillTo)).y;
    const edgeBleedPx = (window.devicePixelRatio || 1) * 2;
    const screenBottomBleed = screenBottom + (screenBottom >= screenTop ? edgeBleedPx : -edgeBleedPx);
    const fillTop = Math.min(screenTop, screenBottomBleed);
    const fillHeight = Math.abs(screenBottomBleed - screenTop);

    const grad = this.ctx.createLinearGradient(0, screenTop, 0, screenBottomBleed);
    grad.addColorStop(0, new Color(color.r, color.g, color.b, opacity).toString());
    grad.addColorStop(1, new Color(color.r, color.g, color.b, 0).toString());

    this.ctx.save();
    this.ctx.beginPath();
    const p0 = this.toPixels(points[0]);
    this.ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i++) {
      const pp = this.toPixels(points[i]);
      this.ctx.lineTo(pp.x, pp.y);
    }
    const pLast = this.toPixels(new V2(points[points.length - 1].x, yFillTo));
    const pFirst = this.toPixels(new V2(points[0].x, yFillTo));
    this.ctx.lineTo(pLast.x, pLast.y);
    this.ctx.lineTo(pFirst.x, pFirst.y);
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(pFirst.x, fillTop, pLast.x - pFirst.x, fillHeight);
    this.ctx.restore();
  };

  point = (p: V2, r = 5) => {
    /*
    if (halo && this.color instanceof Color) {
      this.fillStyle = this.color.opaque(0.5).toString();
      // console.log('fill fillStyle', this.color.opaque(0.5).toString());
      this.arcInPx(p, r * 2);
      this.fill();
      this.beginPath();
      this.fillStyle = this.color.toString();
    }
      */
    this.arcInPx(p, r);

    // this.ll.rect()
    return this;
  };

  public arc3P = (p0: V2, p1: V2, p2: V2) => {
    const pl0 = this.toPixels(p0);
    const pl1 = this.toPixels(p1);
    const pl2 = this.toPixels(p2);

    const a = pl1;
    const b = pl0;
    const c = pl2;

    const ab = b.sub(a);
    const ac = c.sub(a);

    const n1 = new V2(-ab.y, ab.x);
    const n2 = new V2(-ac.y, ac.x);

    const rhs = c.sub(b);
    const [a1, a2] = [n1.x, n1.y];
    const [b1, b2] = [n2.x, n2.y];
    const [r1, r2] = [rhs.x, rhs.y];

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-10) {
      // throw new Error("Lines are parallel");
      return;
    }

    const t = (r1 * b2 - r2 * b1) / det;
    // const E = add(B, scale(n1, t));
    const E = b.add(n1.scale(t));
    const radius = E.sub(b).length();
    // const radius = length(sub(E, B));
    // return d;

    // const radius = pl0.distanceTo(pl1);

    this.moveTo(p0);

    this.ctx.arcTo(pl1.x, pl1.y, pl2.x, pl2.y, radius);
  };

  private arcInPx = (p: V2, radius: number) => {
    const pp = this.toPixels(p);
    this.ctx.arc(pp.x, pp.y, radius, 0, Math.PI * 2);
  };

  public arc3PPath = (p0: V2, p1: V2, p2: V2) => {
    const pl0 = this.toPixels(p0);
    const pl1 = this.toPixels(p1);
    const pl2 = this.toPixels(p2);

    const a = pl1;
    const b = pl0;
    const c = pl2;

    const ab = b.sub(a);
    const ac = c.sub(a);

    const n1 = new V2(-ab.y, ab.x);
    const n2 = new V2(-ac.y, ac.x);

    const rhs = c.sub(b);
    const [a1, a2] = [n1.x, n1.y];
    const [b1, b2] = [n2.x, n2.y];
    const [r1, r2] = [rhs.x, rhs.y];

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-10) {
      return;
    }

    const t = (r1 * b2 - r2 * b1) / det;
    const E = b.add(n1.scale(t));
    const radius = E.sub(b).length();

    if (this.currentPoint && this.currentPoint.closeEnough(p0, 1e-9)) {
      // already there
    } else {
      this.moveTo(p0);
    }

    this.ctx.arcTo(pl1.x, pl1.y, pl2.x, pl2.y, radius);
    // arcTo updates current point to the end of the arc?
    // Canvas API says: "The current point is then set to the end point of the arc."
    // But we need to update LLSoftware.currentPoint.
    // The end point of the arc is not necessarily p2.
    // It is the point where the arc touches the tangent P1-P2.
    // Calculating that point is hard.
    // However, for MpRoundedCorner, p2 IS the exit point of the arc (or close to it).
    // Actually, in MpRoundedCorner, p0 is entry, p1 is corner, p2 is exit.
    // And the arc is tangent to p0-p1 and p1-p2.
    // So the arc starts at p0 and ends at p2.
    // So we can assume currentPoint becomes p2.
    this.currentPoint = p2;
  };

  public magicArc = (
    p: V2,
    _radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise = false
  ) => {
    const dashCount = 60;
    const ctx = this.ctx;
    const center = this.toPixels(p);
    const cx = center.x;
    const cy = center.y;
    const fullCircle = 2 * Math.PI;
    const segmentAngle = fullCircle / (dashCount * 2); // dash + gap per cycle

    const radius = this.toPixels(p).sub(
      this.toPixels(p.add(new V2(_radius, 0)))
    ).x;

    for (let i = 0; i < dashCount; i++) {
      const angle1 = i * 2 * segmentAngle;
      const angle2 = angle1 + segmentAngle;

      const mid = (angle1 + angle2) / 2;
      let alpha = 0;

      // Normalize angles
      const norm = (a: number) => (a + fullCircle) % fullCircle;
      const normStart = norm(startAngle);
      const normEnd = norm(endAngle);
      const normMid = norm(mid);

      const inArc = anticlockwise
        ? normMid <= normStart && normMid >= normEnd
        : normStart < normEnd
        ? normMid >= normStart && normMid <= normEnd
        : normMid >= normStart || normMid <= normEnd;

      if (inArc) {
        alpha = 1;
      } else {
        const fadeZone = fullCircle * 0.05;
        const dStart = Math.min(
          Math.abs(normMid - normStart),
          fullCircle - Math.abs(normMid - normStart)
        );
        const dEnd = Math.min(
          Math.abs(normMid - normEnd),
          fullCircle - Math.abs(normMid - normEnd)
        );
        const d = Math.min(dStart, dEnd);
        alpha = Math.max(0, 1 - d / fadeZone);
      }

      const x1 = cx + radius * Math.cos(angle1);
      const y1 = cy + radius * Math.sin(angle1);
      const x2 = cx + radius * Math.cos(angle2);
      const y2 = cy + radius * Math.sin(angle2);

      ctx.strokeStyle = Color.from(this.color).opaque(alpha).toString();//`rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };
}

//   arc = (center: V2, radius: number, start: number, end: number, clk?: boolean) => {
//     // this.ll.moveTo(center);
//     this.ll.arc(center, radius, start, end, clk);
//   };
// }
