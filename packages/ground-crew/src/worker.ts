import { parentPort } from 'node:worker_threads';
import { renderChart, registerGroundCrewFonts, type RenderOptions } from './index';
import type { ChartSpec } from '@lunaterra/declarative';

registerGroundCrewFonts();
parentPort?.postMessage({ ready: true });
parentPort?.on('message', async (job: { id: number; chart: ChartSpec; output: RenderOptions }) => {
  try {
    const image = await renderChart(job.chart, job.output);
    parentPort?.postMessage({ id: job.id, bytes: image.bytes, width: image.width, height: image.height });
  } catch (error) {
    parentPort?.postMessage({ id: job.id, error: error instanceof Error ? error.message : 'Render failed' });
  }
});
