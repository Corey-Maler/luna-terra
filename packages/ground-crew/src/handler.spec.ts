import express, { type Request, type ErrorRequestHandler } from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChartHandler } from './handler';
import { validateChartSpec, ChartValidationError } from '@lunaterra/declarative';

const app = express();
app.use(express.json());
app.post('/custom/chart.png', createChartHandler<Request>({
  getChart: async (request) => validateChartSpec(request.body.chart),
  output: (request) => ({ width: Number(request.query['width'] ?? 600), height: 300 }),
}));
app.get('/failed', createChartHandler({ getChart: async () => { throw new Error('Provider unavailable'); } }));
const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  if (response.headersSent) return _next(error);
  response.status(error instanceof ChartValidationError ? 422 : error instanceof RangeError ? 413 : 500).json({ message: error.message });
};
app.use(errors);
const server = createServer(app);
let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

const chart = { schemaVersion: 1, title: 'Sample', x: { type: 'number', min: 0, max: 1 }, y: { label: 'V' }, series: [{ id: 'v', label: 'Voltage', color: '#639b80', data: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }] };
const post = (body: unknown, query = '') => fetch(`${base}/custom/chart.png${query}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('Express integration', () => {
  it('renders on an application-owned route using parsed JSON and request output options', async () => {
    const response = await post({ chart }, '?width=700');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(700);
    expect(png.readUInt32BE(20)).toBe(300);
  });
  it('forwards validation, rendering limits, and async provider errors to application middleware', async () => {
    expect((await post({ chart: {} })).status).toBe(422);
    expect((await post({ chart }, '?width=9999')).status).toBe(413);
    const response = await fetch(`${base}/failed`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'Provider unavailable' });
  });
});
