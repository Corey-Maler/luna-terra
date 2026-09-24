import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'node:path';
import { LunaTerraEngine, type StaticCanvasSurface } from '@lunaterra/core';
import { compileChart, validateChartSpec, type ChartSpec } from '@lunaterra/declarative';

export interface RenderOptions { width?: number; height?: number; pixelRatio?: number; format?: 'png' }
export interface RenderedImage { bytes: Buffer; mimeType: 'image/png'; width: number; height: number; metadata: { summary: string } }

export function validateRenderOptions(options: RenderOptions = {}): Required<RenderOptions> {
  const width = options.width ?? 1200;
  const height = options.height ?? 480;
  const pixelRatio = options.pixelRatio ?? 1;
  if (options.format !== undefined && options.format !== 'png') throw new TypeError('Only PNG output is supported');
  if (!Number.isInteger(width) || !Number.isInteger(height) || typeof pixelRatio !== 'number' || !Number.isFinite(pixelRatio)) {
    throw new TypeError('Width and height must be integers; pixel ratio must be a finite number');
  }
  if (width < 320 || height < 240 || pixelRatio < 0.5 || pixelRatio > 4) {
    throw new TypeError('Expected at least 320×240 logical pixels and pixel ratio 0.5–4');
  }
  const physicalWidth = width * pixelRatio;
  const physicalHeight = height * pixelRatio;
  if (!Number.isInteger(physicalWidth) || !Number.isInteger(physicalHeight)) {
    throw new TypeError('Physical image dimensions must be integers');
  }
  if (physicalWidth > 4096 || physicalHeight > 4096 || physicalWidth * physicalHeight > 8_000_000) {
    throw new RangeError('Image dimensions exceed the server limit');
  }
  return { width, height, pixelRatio, format: 'png' };
}

let fontsReady = false;
export function registerGroundCrewFonts(): void {
  if (fontsReady) return;
  const directory = join(__dirname, '..', 'assets', 'fonts');
  const regular = GlobalFonts.registerFromPath(join(directory, 'LiberationSans-Regular.ttf'), 'Ground Crew Sans');
  const bold = GlobalFonts.registerFromPath(join(directory, 'LiberationSans-Bold.ttf'), 'Ground Crew Sans');
  if (!regular || !bold) throw new Error('Ground Crew fonts could not be registered');
  fontsReady = true;
}

export function createNodeSurface(options: RenderOptions = {}) {
  const { width, height, pixelRatio } = validateRenderOptions(options);
  const physicalWidth = width * pixelRatio;
  const physicalHeight = height * pixelRatio;
  registerGroundCrewFonts();
  const canvas = createCanvas(physicalWidth, physicalHeight);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D is unavailable');
  // Native canvas conforms to the Canvas2D operations used by the static renderer.
  // The browser-specific canvas type is isolated to this adapter.
  const surface: StaticCanvasSurface = { canvas: canvas as unknown as HTMLCanvasElement, pixelRatio, fontFamily: 'Ground Crew Sans' };
  return { canvas, context, surface, width, height, pixelRatio, encode: () => canvas.encode('png') };
}

export async function renderChart(input: ChartSpec, options: RenderOptions = {}): Promise<RenderedImage> {
  const spec = validateChartSpec(input);
  const nodeSurface = createNodeSurface(options);
  const engine = new LunaTerraEngine(nodeSurface.surface);
  engine.background = spec.theme?.background ?? '#fcf9f2';
  try {
    engine.add(compileChart(spec, { width: nodeSurface.width, height: nodeSurface.height, pixelRatio: nodeSurface.pixelRatio, fontFamily: 'Ground Crew Sans' }, { interactive: false }));
    engine.renderFrame();
    const bytes = await nodeSurface.encode();
    return {
      bytes: Buffer.from(bytes), mimeType: 'image/png',
      width: nodeSurface.canvas.width, height: nodeSurface.canvas.height,
      metadata: { summary: `${spec.title}: ${spec.series.map((series) => series.label).join(', ')}.` },
    };
  } finally {
    engine.destroy();
  }
}

export { createChartHandler } from './handler';
export type { ChartHandlerOptions } from './handler';
