import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ChartSpec } from '@lunaterra/declarative';
import { renderChart, type RenderOptions } from './index';

export interface ChartHandlerOptions<Request extends IncomingMessage> {
  /** Read or load chart data using your application's request, auth, and storage. */
  getChart: (request: Request) => ChartSpec | Promise<ChartSpec>;
  output?: RenderOptions | ((request: Request) => RenderOptions);
}

/** An Express-compatible route handler. Importing it opens no ports or workers. */
export function createChartHandler<Request extends IncomingMessage = IncomingMessage>(options: ChartHandlerOptions<Request>) {
  return async (request: Request, response: ServerResponse, next: (error?: unknown) => void): Promise<void> => {
    try {
      const chart = await options.getChart(request);
      const output = typeof options.output === 'function' ? options.output(request) : options.output;
      const image = await renderChart(chart, output);
      if (response.destroyed) return;
      response.setHeader('Content-Type', image.mimeType);
      response.setHeader('Content-Length', image.bytes.length);
      response.end(image.bytes);
    } catch (error) {
      next(error);
    }
  };
}
