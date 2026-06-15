import { M4 } from '@lunaterra/math';
import { ColorCache } from './ColorCache';
import type { Camera3D } from './Camera3D';

const vertexShaderSource = `#version 300 es

in vec3 a_position;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;

void main() {
  gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es

precision highp float;

uniform vec4 u_color;

out vec4 outColor;

void main() {
  outColor = u_color;
}
`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to create WebGL shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }

  const info = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(`Failed to compile WebGL shader: ${info ?? 'unknown error'}`);
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Failed to create WebGL program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program;
  }

  const info = gl.getProgramInfoLog(program);
  gl.deleteProgram(program);
  throw new Error(`Failed to link WebGL program: ${info ?? 'unknown error'}`);
}

export class WebGL3DBackend {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private pointsBuffer: WebGLBuffer;
  private positionAttributeLocation: number;
  private modelMatrixLocation: WebGLUniformLocation | null;
  private viewMatrixLocation: WebGLUniformLocation | null;
  private projectionMatrixLocation: WebGLUniformLocation | null;
  private colorLocation: WebGLUniformLocation | null;
  private colorCache = ColorCache.getInstance();

  constructor(private readonly gl: WebGL2RenderingContext) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    this.positionAttributeLocation = gl.getAttribLocation(this.program, 'a_position');
    this.modelMatrixLocation = gl.getUniformLocation(this.program, 'u_modelMatrix');
    this.viewMatrixLocation = gl.getUniformLocation(this.program, 'u_viewMatrix');
    this.projectionMatrixLocation = gl.getUniformLocation(this.program, 'u_projectionMatrix');
    this.colorLocation = gl.getUniformLocation(this.program, 'u_color');

    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create 3D points buffer');
    }
    this.pointsBuffer = buffer;

    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create 3D VAO');
    }
    this.vao = vao;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);
    gl.enableVertexAttribArray(this.positionAttributeLocation);
    gl.vertexAttribPointer(this.positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  }

  public drawTriangles(
    points: Float32Array,
    color: string,
    camera: Camera3D,
    modelMatrix = M4.identity(),
  ) {
    const gl = this.gl;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);

    gl.uniformMatrix4fv(this.modelMatrixLocation, false, modelMatrix.getFloatArray());
    gl.uniformMatrix4fv(this.viewMatrixLocation, false, camera.viewMatrix.getFloatArray());
    gl.uniformMatrix4fv(
      this.projectionMatrixLocation,
      false,
      camera.projectionMatrix.getFloatArray(),
    );

    const parsedColor = this.colorCache.getColor(color);
    gl.uniform4f(
      this.colorLocation,
      parsedColor[0],
      parsedColor[1],
      parsedColor[2],
      parsedColor[3],
    );

    gl.drawArrays(gl.TRIANGLES, 0, points.length / 3);
    gl.disable(gl.DEPTH_TEST);
  }
}
