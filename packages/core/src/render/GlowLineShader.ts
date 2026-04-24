import type { M3 } from '@lunaterra/math';
import { ColorCache } from './ColorCache';

// ── Options interface ──────────────────────────────────────────────────────

export interface GlowLineOptions {
  /** CSS colour string for the glow / track. */
  color: string;
  /** World-space glow radius (falloff distance from line centre). */
  radius: number;
  /** Current elapsed time in seconds (drives particle animation). */
  time: number;
  /** Particle travel speed in world-units/sec. 0 = no flow. */
  flowSpeed: number;
  /** @deprecated No longer used; kept for call-site compatibility. */
  flowFrequency: number;
  /** Optional separate colour for particles. Defaults to track colour. */
  flowColor?: string;
  /** Number of particles on the path simultaneously. Default: 25. */
  flowParticleCount?: number;
  /** ±Fraction of speed variation per particle. Default: 0.2. */
  flowSpeedVariation?: number;
  /** Parametric half-length of each particle (0..1). Default: 0.015. */
  flowParticleHalfLen?: number;
  /**
   * Half-width of the flat full-opacity plateau in world space.
   * Defaults to radius × 0.55.
   */
  glowPlateauWidth?: number;
  /**
   * Width of each softening ramp at the track edges in world space.
   * Defaults to radius × 0.45.
   */
  glowFalloff?: number;
}

// ── Shaders ────────────────────────────────────────────────────────────────

const glowVertexSource = `#version 300 es
precision highp float;

// Per-vertex attributes
in vec2 a_position;      // quad vertex in world space
in vec2 a_segA;          // segment start (world)
in vec2 a_segB;          // segment end   (world)
in float a_parametric;   // 0..1 along full path

uniform mat3 u_viewMatrix;

out vec2 v_worldPos;
out vec2 v_segA;
out vec2 v_segB;
out float v_parametric;

void main() {
  vec3 transformed = u_viewMatrix * vec3(a_position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);

  v_worldPos = a_position;
  v_segA = a_segA;
  v_segB = a_segB;
  v_parametric = a_parametric;
}
`;

const glowFragmentSource = `#version 300 es
precision highp float;

in vec2 v_worldPos;
in vec2 v_segA;
in vec2 v_segB;
in float v_parametric;

uniform vec4 u_glowColor;
uniform float u_glowRadius;
uniform float u_plateauWidth;
uniform float u_falloff;
uniform float u_time;
uniform float u_flowSpeed;
uniform vec4 u_flowColor;
uniform float u_hasFlow;
uniform int  u_particleCount;
uniform float u_speedVariation;
uniform float u_particleHalfLen;

out vec4 outColor;

// Unsigned distance from point to line segment
float segmentDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len2 = dot(ab, ab);
  if (len2 < 1e-12) return length(p - a);
  float t = clamp(dot(p - a, ab) / len2, 0.0, 1.0);
  return length(p - (a + t * ab));
}

// Signed perpendicular distance from p to the infinite line through a→b
// (positive = left of direction a→b)
float perpDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len = length(ab);
  if (len < 1e-8) return length(p - a);
  vec2 normal = vec2(-ab.y, ab.x) / len;
  return dot(p - a, normal);
}

// Deterministic hash: [0,1)
float hash1(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

void main() {
  float dist = segmentDist(v_worldPos, v_segA, v_segB);

  // Background track — plateau shape: flat top then smooth ramp down
  // 0..plateauWidth → full intensity; plateauWidth..plateauWidth+falloff → ramp to 0
  float trackAlpha = (1.0 - smoothstep(u_plateauWidth, u_plateauWidth + u_falloff, dist)) * u_glowColor.a;

  if (u_hasFlow < 0.5) {
    // Static glow, no particles
    if (trackAlpha < 0.004) discard;
    outColor = vec4(u_glowColor.rgb, trackAlpha);
    return;
  }

  // ── Particle stream ──────────────────────────────────────────────────
  float particleAlpha = 0.0;

  // Only evaluate particles for fragments that lie within this segment's
  // body (t ∈ [0,1]).  Fragments in the end-cap overlap zones at corners
  // have t outside this range in ALL adjacent quads, so they are skipped
  // by every quad → no double-evaluation → no corner sticks.
  vec2 segDir = v_segB - v_segA;
  float segLen2 = dot(segDir, segDir);
  float tSeg = (segLen2 > 1e-12) ? dot(v_worldPos - v_segA, segDir) / segLen2 : 0.5;

  if (tSeg >= 0.0 && tSeg <= 1.0) {
    // Signed perpendicular offset from the segment axis
    float perp = perpDist(v_worldPos, v_segA, v_segB);

    // Particle dimensions (small: ~1px tall, ~3px long at typical scale)
    float particleHeight = u_glowRadius * 0.07;
    float halfLen = u_particleHalfLen;

    for (int i = 0; i < 80; i++) {
      if (i >= u_particleCount) break;

      float fi = float(i);

      // Random lane uniformly distributed within track width
      float lane = (hash1(fi + 200.0) * 2.0 - 1.0) * u_glowRadius * 0.78;

      // Per-particle speed variation
      float speedMod = 1.0 + (hash1(fi + 100.0) - 0.5) * 2.0 * u_speedVariation;
      float speed = u_flowSpeed * speedMod;

      // Particle position along the path (wraps 0..1)
      float pos = fract(hash1(fi) - u_time * speed);

      // Along-path and perpendicular distances
      float dpath = abs(v_parametric - pos);
      dpath = min(dpath, 1.0 - dpath);
      float dperp = abs(perp - lane);

      // Pill SDF — both smoothstep calls have edge0 < edge1
      float alongA = 1.0 - smoothstep(0.0, halfLen, dpath);
      float perpA  = 1.0 - smoothstep(0.0, particleHeight, dperp);

      particleAlpha = max(particleAlpha, alongA * perpA);
    }
  }

  // Composite: track behind particles
  float finalAlpha = max(trackAlpha, particleAlpha * u_flowColor.a);
  if (finalAlpha < 0.004) discard;

  vec3 col = mix(u_glowColor.rgb, u_flowColor.rgb, particleAlpha);
  outColor = vec4(col, finalAlpha);
}
`;

// ── Composite shader (fullscreen-triangle FBO blit) ───────────────────────

const compositeVertexSource = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 pos = vec2(
    float((gl_VertexID & 1) << 2) - 1.0,
    float((gl_VertexID & 2) << 1) - 1.0
  );
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const compositeFragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${log}`);
  }
  return prog;
}

// ── Shader class ───────────────────────────────────────────────────────────

/**
 * SDF-based glow shader for line geometry.
 *
 * For each line **segment** we emit a screen-aligned quad that extends by
 * `glowRadius` in all directions.  The fragment shader computes distance to
 * the segment and applies an exponential glow falloff, optionally modulated
 * by an energy-flow sine wave.
 */
export class GlowLineShader {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;

  // Attribute locations
  private aPos: number;
  private aSegA: number;
  private aSegB: number;
  private aParam: number;

  // Uniform locations
  private uViewMatrix: WebGLUniformLocation;
  private uGlowColor: WebGLUniformLocation;
  private uGlowRadius: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uFlowSpeed: WebGLUniformLocation;
  private uFlowColor: WebGLUniformLocation;
  private uHasFlow: WebGLUniformLocation;
  private uParticleCount: WebGLUniformLocation;
  private uSpeedVariation: WebGLUniformLocation;
  private uParticleHalfLen: WebGLUniformLocation;
  private uPlateauWidth: WebGLUniformLocation;
  private uFalloff: WebGLUniformLocation;

  private colorCache: ColorCache;

  // FBO for per-line glow isolation (MAX within, standard blend between lines)
  private fbo: WebGLFramebuffer | null = null;
  private fboTexture: WebGLTexture | null = null;
  private fboWidth = 0;
  private fboHeight = 0;

  // Composite pass (fullscreen triangle)
  private compositeProgram: WebGLProgram;
  private compositeVao: WebGLVertexArrayObject;
  private compositeTexLoc: WebGLUniformLocation;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.colorCache = ColorCache.getInstance();

    const vs = compileShader(gl, gl.VERTEX_SHADER, glowVertexSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, glowFragmentSource);
    this.program = linkProgram(gl, vs, fs);

    // Attributes
    this.aPos = gl.getAttribLocation(this.program, 'a_position');
    this.aSegA = gl.getAttribLocation(this.program, 'a_segA');
    this.aSegB = gl.getAttribLocation(this.program, 'a_segB');
    this.aParam = gl.getAttribLocation(this.program, 'a_parametric');

    // Uniforms
    this.uViewMatrix = gl.getUniformLocation(this.program, 'u_viewMatrix')!;
    this.uGlowColor = gl.getUniformLocation(this.program, 'u_glowColor')!;
    this.uGlowRadius = gl.getUniformLocation(this.program, 'u_glowRadius')!;
    this.uTime = gl.getUniformLocation(this.program, 'u_time')!;
    this.uFlowSpeed = gl.getUniformLocation(this.program, 'u_flowSpeed')!;
    this.uFlowColor = gl.getUniformLocation(this.program, 'u_flowColor')!;
    this.uHasFlow = gl.getUniformLocation(this.program, 'u_hasFlow')!;
    this.uParticleCount = gl.getUniformLocation(this.program, 'u_particleCount')!;
    this.uSpeedVariation = gl.getUniformLocation(this.program, 'u_speedVariation')!;
    this.uParticleHalfLen = gl.getUniformLocation(this.program, 'u_particleHalfLen')!;
    this.uPlateauWidth = gl.getUniformLocation(this.program, 'u_plateauWidth')!;
    this.uFalloff = gl.getUniformLocation(this.program, 'u_falloff')!;

    // VAO + buffer
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;

    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create buffer');
    this.buf = buf;

    // Stride: 7 floats per vertex
    //   [posX, posY, segAx, segAy, segBx, segBy, parametric]
    const STRIDE = 7 * 4; // bytes

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);

    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, STRIDE, 0);

    gl.enableVertexAttribArray(this.aSegA);
    gl.vertexAttribPointer(this.aSegA, 2, gl.FLOAT, false, STRIDE, 2 * 4);

    gl.enableVertexAttribArray(this.aSegB);
    gl.vertexAttribPointer(this.aSegB, 2, gl.FLOAT, false, STRIDE, 4 * 4);

    gl.enableVertexAttribArray(this.aParam);
    gl.vertexAttribPointer(this.aParam, 1, gl.FLOAT, false, STRIDE, 6 * 4);

    gl.bindVertexArray(null);

    // Composite shader for FBO blit
    const cvs = compileShader(gl, gl.VERTEX_SHADER, compositeVertexSource);
    const cfs = compileShader(gl, gl.FRAGMENT_SHADER, compositeFragmentSource);
    this.compositeProgram = linkProgram(gl, cvs, cfs);
    this.compositeTexLoc = gl.getUniformLocation(this.compositeProgram, 'u_texture')!;

    const cVao = gl.createVertexArray();
    if (!cVao) throw new Error('Failed to create composite VAO');
    this.compositeVao = cVao;
  }

  /** Ensure the offscreen FBO matches the canvas size. */
  private ensureFBO(width: number, height: number): void {
    const gl = this.gl;
    if (this.fbo && this.fboWidth === width && this.fboHeight === height) return;

    if (!this.fbo) {
      this.fbo = gl.createFramebuffer();
      this.fboTexture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fboWidth = width;
    this.fboHeight = height;
  }

  /**
   * Render a glowing line.
   *
   * @param points  Flat Float32Array [x0,y0, x1,y1, …] in world space
   * @param parametric Per-vertex parametric coord (0…1)
   * @param viewMatrix Current accumulated view matrix
   * @param opts Glow + flow options
   */
  render(
    points: Float32Array,
    parametric: Float32Array,
    viewMatrix: M3,
    opts: GlowLineOptions,
  ): void {
    const nVerts = points.length / 2;
    if (nVerts < 2) return;

    const segments = nVerts - 1;
    const gl = this.gl;
    const r = opts.radius;

    // Build quad geometry: 6 vertices per segment (2 triangles)
    // Each vertex: [posX, posY, segAx, segAy, segBx, segBy, parametric]
    const floatsPerVert = 7;
    const data = new Float32Array(segments * 6 * floatsPerVert);
    let offset = 0;

    for (let i = 0; i < segments; i++) {
      const ax = points[i * 2];
      const ay = points[i * 2 + 1];
      const bx = points[(i + 1) * 2];
      const by = points[(i + 1) * 2 + 1];

      // Direction and perpendicular
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-10) continue;

      const nx = -dy / len * r;
      const ny = dx / len * r;
      // Extend along the segment direction by radius for end caps
      const ex = dx / len * r;
      const ey = dy / len * r;

      const pA = parametric[i];
      const pB = parametric[i + 1];
      const pMid = (pA + pB) * 0.5;

      // Quad corners (extended by r in all directions)
      //   0: A - perp - ext
      //   1: A + perp - ext
      //   2: B - perp + ext
      //   3: B + perp + ext
      const corners = [
        [ax - nx - ex, ay - ny - ey, pA],
        [ax + nx - ex, ay + ny - ey, pA],
        [bx - nx + ex, by - ny + ey, pB],
        [bx + nx + ex, by + ny + ey, pB],
      ];

      // Two triangles: 0-1-2, 1-3-2
      const indices = [0, 1, 2, 1, 3, 2];

      for (const idx of indices) {
        const c = corners[idx];
        data[offset++] = c[0]; // posX
        data[offset++] = c[1]; // posY
        data[offset++] = ax;   // segAx
        data[offset++] = ay;   // segAy
        data[offset++] = bx;   // segBx
        data[offset++] = by;   // segBy
        data[offset++] = c[2]; // parametric
      }
    }

    if (offset === 0) return;

    const canvasW = gl.canvas.width;
    const canvasH = gl.canvas.height;
    this.ensureFBO(canvasW, canvasH);

    // ── Pass 1: render glow into isolated FBO with MAX blending ───────────
    // MAX resolves self-overlap at corners without bright spots.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, offset), gl.DYNAMIC_DRAW);

    // Uniforms
    gl.uniformMatrix3fv(this.uViewMatrix, false, viewMatrix.getFloatArray());

    const glowCol = this.colorCache.getColor(opts.color);
    gl.uniform4f(this.uGlowColor, glowCol[0], glowCol[1], glowCol[2], glowCol[3]);
    gl.uniform1f(this.uGlowRadius, r);
    gl.uniform1f(this.uTime, opts.time);

    const hasFlow = opts.flowSpeed !== 0;
    gl.uniform1f(this.uFlowSpeed, opts.flowSpeed);
    gl.uniform1f(this.uHasFlow, hasFlow ? 1.0 : 0.0);
    gl.uniform1i(this.uParticleCount, opts.flowParticleCount ?? 25);
    gl.uniform1f(this.uSpeedVariation, opts.flowSpeedVariation ?? 0.2);
    gl.uniform1f(this.uParticleHalfLen, opts.flowParticleHalfLen ?? 0.006);
    gl.uniform1f(this.uPlateauWidth, opts.glowPlateauWidth ?? r * 0.55);
    gl.uniform1f(this.uFalloff, opts.glowFalloff ?? r * 0.45);

    if (opts.flowColor) {
      const fc = this.colorCache.getColor(opts.flowColor);
      gl.uniform4f(this.uFlowColor, fc[0], fc[1], fc[2], fc[3]);
    } else {
      gl.uniform4f(this.uFlowColor, glowCol[0], glowCol[1], glowCol[2], glowCol[3]);
    }

    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, offset / floatsPerVert);

    // ── Pass 2: composite FBO onto main canvas with standard blending ─────
    // Different-colored lines now blend naturally instead of per-channel MAX.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);

    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.compositeProgram);
    gl.bindVertexArray(this.compositeVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTexture);
    gl.uniform1i(this.compositeTexLoc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  }
}
