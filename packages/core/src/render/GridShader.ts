import { M3, type Rect2D } from '@lunaterra/math';
import { ColorCache } from './ColorCache';

// Vertex shader that covers the full screen with a single quad
const gridVertexShaderSource = `#version 300 es
// Vertex positions for a full-screen quad
in vec2 a_position;

// Texture coordinates
out vec2 v_texCoord;

void main() {
  // Pass the texture coordinates directly to the fragment shader
  v_texCoord = a_position * 0.5 + 0.5;
  
  // Output clip coordinates
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Fragment shader that calculates grid dots
const gridFragmentShaderSource = `#version 300 es
precision highp float;

// Texture coordinates from vertex shader
in vec2 v_texCoord;

// View area in world coordinates
uniform vec4 u_viewArea; // x, y, width, height
uniform vec4 u_gridColor; // Major grid color
uniform vec4 u_subgridColor; // Subgrid color with opacity
uniform float u_gridSize; // Size of major grid steps
uniform float u_dotSize; // Size of dots in pixels
uniform vec2 u_resolution; // Canvas resolution

out vec4 outColor;

float getMajorGrid(float coord, float gridSize) {
  // Check if this is a major grid point
  return mod(coord, gridSize) < 0.001 ? 1.0 : 0.0;
}

float getMinorGrid(float coord, float gridSize) {
  // Check if this is a minor grid point but not a major one
  float minorGridSize = gridSize / 10.0;
  return mod(coord, minorGridSize) < 0.001 && mod(coord, gridSize) >= 0.001 ? 1.0 : 0.0;
}

void main() {
  // Convert texture coordinates to world coordinates
  float worldX = u_viewArea.x + v_texCoord.x * u_viewArea.z;
  float worldY = u_viewArea.y + v_texCoord.y * u_viewArea.w;
  
  // Get pixel size in world coordinates
  float pixelSizeX = u_viewArea.z / u_resolution.x;
  float pixelSizeY = u_viewArea.w / u_resolution.y;
  
  // Calculate grid positions
  float gridX = floor(worldX / u_gridSize) * u_gridSize;
  float gridY = floor(worldY / u_gridSize) * u_gridSize;
  
  // Distance to the nearest grid line points in world units
  float distX = mod(worldX, u_gridSize);
  float distY = mod(worldY, u_gridSize);
  
  // Distance to the nearest minor grid line points
  float minorGridSize = u_gridSize / 10.0;
  float minorDistX = mod(worldX, minorGridSize);
  float minorDistY = mod(worldY, minorGridSize);
  
  // Threshold for dots in world units based on dot size in pixels
  float thresholdX = (u_dotSize / 2.0) * pixelSizeX;
  float thresholdY = (u_dotSize / 2.0) * pixelSizeY;
  
  // Check if we're at a major grid point
  bool isMajorX = distX < thresholdX || (u_gridSize - distX) < thresholdX;
  bool isMajorY = distY < thresholdY || (u_gridSize - distY) < thresholdY;
  
  // Check if we're at a minor grid point
  bool isMinorX = minorDistX < thresholdX || (minorGridSize - minorDistX) < thresholdX;
  bool isMinorY = minorDistY < thresholdY || (minorGridSize - minorDistY) < thresholdY;
  
  // Render major grid intersections
  if ((isMajorX && isMajorY)) {
    outColor = u_gridColor;
    return;
  }
  
  // Render minor grid intersections (if not already a major point)
  if ((isMinorX && isMinorY) || 
      (isMinorX && isMajorY) || 
      (isMajorX && isMinorY)) {
      
    // Check that we're not too close to a major grid line
    if (!(distX < thresholdX && distY < thresholdY)) {
      outColor = u_subgridColor;
      return;
    }
  }
  
  // Default transparent
  outColor = vec4(0.0, 0.0, 0.0, 0.0);
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

export class GridShader {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private positionBuffer: WebGLBuffer;

  // Uniform locations
  private viewAreaLocation: WebGLUniformLocation;
  private gridColorLocation: WebGLUniformLocation;
  private subgridColorLocation: WebGLUniformLocation;
  private gridSizeLocation: WebGLUniformLocation;
  private dotSizeLocation: WebGLUniformLocation;
  private resolutionLocation: WebGLUniformLocation;

  private colorCache: ColorCache;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.colorCache = ColorCache.getInstance();

    // Create shaders
    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      gridVertexShaderSource,
    );
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      gridFragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create grid shaders');
    }

    // Create and link program
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      throw new Error('Failed to create grid shader program');
    }

    this.program = program;

    // Create a VAO and set up attributes
    const vao = gl.createVertexArray();
    if (!vao) {
      throw new Error('Failed to create VAO for grid shader');
    }
    this.vao = vao;

    gl.bindVertexArray(vao);

    // Create a position buffer for a full-screen quad
    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      throw new Error('Failed to create position buffer for grid shader');
    }
    this.positionBuffer = positionBuffer;

    // Full-screen quad vertices (2 triangles)
    const positions = new Float32Array([
      -1,
      -1, // bottom-left
      1,
      -1, // bottom-right
      -1,
      1, // top-left
      1,
      1, // top-right
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Set up attribute
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    this.viewAreaLocation = gl.getUniformLocation(program, 'u_viewArea')!;
    this.gridColorLocation = gl.getUniformLocation(program, 'u_gridColor')!;
    this.subgridColorLocation = gl.getUniformLocation(
      program,
      'u_subgridColor',
    )!;
    this.gridSizeLocation = gl.getUniformLocation(program, 'u_gridSize')!;
    this.dotSizeLocation = gl.getUniformLocation(program, 'u_dotSize')!;
    this.resolutionLocation = gl.getUniformLocation(program, 'u_resolution')!;
  }

  render(
    viewArea: Rect2D,
    gridSize: number,
    density = 0,
    gridColor = '#dddddd',
    subgridColor = 'rgba(221, 221, 221, 0.5)',
    dotSize = 2,
  ) {
    const gl = this.gl;

    // Use the grid shader program
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Calculate the magnitude based on grid density
    const magnitudeOffset = density > 0 ? 1 : 0;
    const magnitude =
      Math.floor(Math.log10(Math.min(viewArea.width, viewArea.height))) -
      magnitudeOffset;
    const majorStep = Math.pow(10, magnitude);

    // Set uniforms
    gl.uniform4f(
      this.viewAreaLocation,
      viewArea.bottomLeft.x,
      viewArea.bottomLeft.y,
      viewArea.width,
      viewArea.height,
    );

    // Set colors
    const parsedGridColor = this.colorCache.getColor(gridColor);
    const parsedSubgridColor = this.colorCache.getColor(subgridColor);

    gl.uniform4f(
      this.gridColorLocation,
      parsedGridColor[0],
      parsedGridColor[1],
      parsedGridColor[2],
      parsedGridColor[3],
    );

    gl.uniform4f(
      this.subgridColorLocation,
      parsedSubgridColor[0],
      parsedSubgridColor[1],
      parsedSubgridColor[2],
      parsedSubgridColor[3],
    );

    // Set grid size (based on adaptive grid calculations)
    gl.uniform1f(this.gridSizeLocation, majorStep);

    // Set dot size
    gl.uniform1f(this.dotSizeLocation, dotSize);

    // Set resolution
    gl.uniform2f(this.resolutionLocation, gl.canvas.width, gl.canvas.height);

    // Draw the quad as two triangles
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
