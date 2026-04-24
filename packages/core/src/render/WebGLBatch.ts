import { M3, type Rect2D, type V2 } from '@lunaterra/math';
import { ColorCache } from './ColorCache';
import { GridShader } from './GridShader';
import { GlowLineShader, type GlowLineOptions } from './GlowLineShader';

const vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec2 a_position;

// Add uniform for view matrix
uniform mat3 u_viewMatrix;

// Add uniform for line width
uniform float u_lineWidth;

// all shaders have a main function
void main() {
  // Transform the position using the view matrix
  vec3 transformed = u_viewMatrix * vec3(a_position, 1.0);
  // Convert to NDC coordinates (-1 to 1)
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  gl_PointSize = u_lineWidth;
}
`;

const fragmentShaderSource = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

// Add uniform for color
uniform vec4 u_color;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  outColor = u_color;
}
`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

export class WebGLBatchLL {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private pointsBuffer: WebGLBuffer | null = null;
  private positionAttributeLocation: number;
  private viewMatrixLocation: WebGLUniformLocation | null;
  private colorLocation: WebGLUniformLocation | null;
  private lineWidthLocation: WebGLUniformLocation | null;
  private viewMatrix: M3 = new M3();
  private colorCache: ColorCache;

  // Grid shader instance
  private gridShader: GridShader;

  // Glow line shader instance
  private glowShader: GlowLineShader;

  public prepareRender() {
    const gl = this.gl;
    // Clear with fully transparent background (r,g,b,alpha)
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Set the view matrix uniform once for the entire render
    gl.uniformMatrix3fv(
      this.viewMatrixLocation,
      false,
      this.viewMatrix.getFloatArray(),
    );
  }

  public finishRender() {
    // Nothing to do here for now
  }

  constructor(canvas: HTMLCanvasElement) {
    console.log('WebGLBatch.constructor');

    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      alpha: true,
    });
    if (!gl) {
      // no webgl2 for you!
      throw new Error('NO WEBGL2');
    }
    this.gl = gl;

    // Enable transparency with proper blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      throw new Error('Failed to create program');
    }

    this.program = program;
    this.positionAttributeLocation = gl.getAttribLocation(
      program,
      'a_position',
    );
    this.viewMatrixLocation = gl.getUniformLocation(program, 'u_viewMatrix');
    this.colorLocation = gl.getUniformLocation(program, 'u_color');
    this.lineWidthLocation = gl.getUniformLocation(program, 'u_lineWidth');

    // Create a single buffer for points that we'll reuse
    this.pointsBuffer = gl.createBuffer();
    if (!this.pointsBuffer) {
      throw new Error('Failed to create buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO');
    }

    this.vao = vao;
    gl.bindVertexArray(vao);

    gl.enableVertexAttribArray(this.positionAttributeLocation);

    const size = 2; // 2 components per iteration
    const type = gl.FLOAT; // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration
    const offset = 0; // start at the beginning of the buffer
    gl.vertexAttribPointer(
      this.positionAttributeLocation,
      size,
      type,
      normalize,
      stride,
      offset,
    );

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    this.colorCache = ColorCache.getInstance();

    // Initialize the grid shader
    this.gridShader = new GridShader(gl);

    // Initialize the glow line shader
    this.glowShader = new GlowLineShader(gl);
  }

  p3(
    points: Float32Array,
    offsets: number[],
    sizes: number[],
    colors: string[],
    lineWidth = 1,
  ) {
    const gl = this.gl;

    // Bind the VAO
    gl.bindVertexArray(this.vao);

    // Bind our points buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

    // Get color from cache
    const color = this.colorCache.getColor(colors[0]);
    gl.uniform4f(this.colorLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(this.lineWidthLocation, lineWidth);

    let offset = 0;
    for (let i = 0; i < offsets.length; i++) {
      const size = sizes[i];
      gl.drawArrays(gl.LINE_STRIP, offset, size);
      offset += size;
    }
  }

  p3Fill(points: Float32Array, triangles: Uint16Array, _color: string) {
    const gl = this.gl;

    // Bind the VAO
    gl.bindVertexArray(this.vao);

    // Bind our points buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

    // Create and bind element buffer for triangle indices
    const elementBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangles, gl.STATIC_DRAW);

    // Get color from cache
    const color = this.colorCache.getColor(_color);
    gl.uniform4f(this.colorLocation, color[0], color[1], color[2], color[3]);

    // Use TRIANGLES for triangulated data
    gl.drawElements(gl.TRIANGLES, triangles.length, gl.UNSIGNED_SHORT, 0);

    // Clean up
    gl.deleteBuffer(elementBuffer);
  }

  /**
   * Implements the 'p' method required by the LL interface
   */
  public p(points: number[]): void {
    // Convert the number array to Float32Array
    const float32Points = new Float32Array(points);

    // Reuse the existing renderPoints method
    const defaultColor = 'black';
    const defaultSize = 1;
    this.renderPoints(float32Points, defaultColor, defaultSize);
  }

  /**
   * Renders an array of points using WebGL's GL_POINTS primitive
   *
   * @param points - Float32Array containing x,y pairs for each point
   * @param color - Color to use for the points
   * @param pointSize - Size of each point in pixels
   */
  public renderPoints(points: Float32Array, color: string, pointSize = 1) {
    const gl = this.gl;

    // Ensure the blend function is properly set for transparency
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Bind the VAO
    gl.bindVertexArray(this.vao);

    // Bind our points buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);

    // Send the point data to WebGL
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

    // Get color from cache
    const parsedColor = this.colorCache.getColor(color);
    gl.uniform4f(
      this.colorLocation,
      parsedColor[0],
      parsedColor[1],
      parsedColor[2],
      parsedColor[3],
    );

    // Set point size
    gl.uniform1f(this.lineWidthLocation, pointSize);

    // Draw the points
    gl.drawArrays(gl.POINTS, 0, points.length / 2);
  }

  resize(w: number, h: number) {
    this.gl.viewport(0, 0, w, h);
  }

  moveTo(v: V2) {
    console.log('WebGLBatch.moveTo');
    // TODO: Implement moveTo
  }

  lineTo(v: V2): void {
    // TODO: Implement lineTo
  }

  arc(v: V2, radius: number, startAngle?: number, endAngle?: number): void {
    // TODO: Implement arc
  }

  updateViewMatrix(vm: M3): void {
    this.viewMatrix = vm;
    // TODO: Apply view matrix to shader uniforms
  }

  beginPath(): void {
    // TODO: Implement beginPath
  }

  stroke(): void {
    // TODO: Implement stroke
  }

  fill(): void {
    // TODO: Implement fill
  }

  fillText(text: string, p: V2, color?: string, fontSize?: number): void {
    // TODO: Implement fillText
  }

  set fillStyle(color: string) {
    // TODO: Implement fillStyle
  }

  set strokeStyle(color: string) {
    // TODO: Implement strokeStyle
  }

  /**
   * Renders grid dots directly using a dedicated shader
   *
   * @param viewArea - The visible area in world coordinates
   * @param density - Grid density factor
   * @param gridColor - Color for major grid points
   * @param subgridColor - Color for minor grid points with opacity
   * @param dotSize - Size of dots in pixels
   */
  public renderGridDots(
    viewArea: Rect2D,
    density = 0,
    gridColor = '#dddddd',
    subgridColor = 'rgba(221, 221, 221, 0.5)',
    subgridOpacity = 0.5,
    dotSize = 2,
  ) {
    const parsedSubgridColor = this.colorCache.getColor(subgridColor);
    const effectiveAlpha = parsedSubgridColor[3] * Math.max(0, Math.min(1, subgridOpacity));
    const effectiveSubgridColor =
      effectiveAlpha < 0.01
        ? 'rgba(0, 0, 0, 0)'
        : `rgba(${Math.round(parsedSubgridColor[0] * 255)}, ${Math.round(parsedSubgridColor[1] * 255)}, ${Math.round(parsedSubgridColor[2] * 255)}, ${effectiveAlpha})`;

    this.gridShader.render(
      viewArea,
      0,
      density,
      gridColor,
      effectiveSubgridColor,
      dotSize,
    );
  }

  /**
   * Render a glowing line using an SDF-based fragment shader.
   *
   * @param points - Flat Float32Array of [x0, y0, x1, y1, …] in world space.
   * @param parametric - Float32Array of per-vertex parametric coords (0…1 along path).
   * @param options - Glow colour, radius, flow animation params.
   */
  public renderGlowLine(
    points: Float32Array,
    parametric: Float32Array,
    options: GlowLineOptions,
  ): void {
    this.glowShader.render(
      points,
      parametric,
      this.viewMatrix,
      options,
    );
  }
}
