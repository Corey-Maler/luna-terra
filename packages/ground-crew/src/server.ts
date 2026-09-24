import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { validateChartSpec, ChartValidationError, type ChartSpec } from '@lunaterra/declarative';
import { registerGroundCrewFonts, validateRenderOptions, type RenderOptions } from './index';

interface Job {
  id: number;
  chart: ChartSpec;
  output: RenderOptions;
  resolve: (bytes: Buffer) => void;
  reject: (error: Error) => void;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
  cancelled?: boolean;
}

export interface GroundCrewServiceOptions { workers?: number; queueSize?: number; deadlineMs?: number }
export interface GroundCrewServerOptions extends GroundCrewServiceOptions { host?: string; port?: number }

class CapacityError extends Error {
  constructor(message: string) { super(message); Object.setPrototypeOf(this, new.target.prototype); }
}
class DeadlineError extends Error {
  constructor(message: string) { super(message); Object.setPrototypeOf(this, new.target.prototype); }
}

class RenderPool {
  private readonly workers: Array<{ worker: Worker; ready: boolean; job?: Job }> = [];
  private readonly queue: Job[] = [];
  private nextId = 0;
  private closing = false;

  constructor(private readonly size: number, private readonly queueSize: number, private readonly deadlineMs: number) {
    for (let i = 0; i < size; i++) this.workers.push(this.makeWorker());
  }

  get ready(): boolean { return this.workers.length === this.size && this.workers.every((slot) => slot.ready); }

  private makeWorker(): { worker: Worker; ready: boolean; job?: Job } {
    const slot: { worker: Worker; ready: boolean; job?: Job } = { worker: new Worker(join(__dirname, 'worker.js')), ready: false };
    slot.worker.on('message', (result: { id: number; ready?: boolean; bytes?: Uint8Array; error?: string }) => {
      if (result.ready) { slot.ready = true; this.dispatch(); return; }
      const job = slot.job;
      if (!job || result.id !== job.id) return;
      if (result.error) job.reject(new Error(result.error));
      else if (result.bytes) job.resolve(Buffer.from(result.bytes));
      else job.reject(new Error('Worker returned no image'));
      this.finish(slot);
    });
    slot.worker.on('error', (error) => this.replace(slot, error));
    slot.worker.on('exit', (code) => { if (!this.closing && code !== 0) this.replace(slot, new Error(`Render worker exited: ${code}`)); });
    return slot;
  }

  private finish(slot: { worker: Worker; ready: boolean; job?: Job }): void {
    if (slot.job?.timer) clearTimeout(slot.job.timer);
    slot.job = undefined;
    this.dispatch();
  }

  private replace(slot: { worker: Worker; ready: boolean; job?: Job }, error: Error): void {
    const index = this.workers.indexOf(slot);
    if (index < 0) return;
    if (slot.job) {
      if (slot.job.timer) clearTimeout(slot.job.timer);
      slot.job.reject(error);
      slot.job = undefined;
    }
    void slot.worker.terminate();
    if (!this.closing) this.workers[index] = this.makeWorker();
    this.dispatch();
  }

  private dispatch(): void {
    if (this.closing) return;
    for (const slot of this.workers) {
      if (!slot.ready || slot.job) continue;
      let job = this.queue.shift();
      while (job?.cancelled) job = this.queue.shift();
      if (!job) return;
      if (Date.now() >= job.deadline) {
        if (job.timer) clearTimeout(job.timer);
        job.reject(new DeadlineError('Render deadline exceeded'));
        continue;
      }
      slot.job = job;
      slot.worker.postMessage({ id: job.id, chart: job.chart, output: job.output });
    }
  }

  render(chart: ChartSpec, output: RenderOptions, request: IncomingMessage): Promise<Buffer> {
    if (this.closing || this.queue.length >= this.queueSize) return Promise.reject(new CapacityError('Render capacity exhausted'));
    return new Promise<Buffer>((resolve, reject) => {
      const cleanup = () => request.off('aborted', cancel);
      const job: Job = { id: ++this.nextId, chart, output,
        resolve: (bytes) => { cleanup(); resolve(bytes); },
        reject: (error) => { cleanup(); reject(error); },
        deadline: Date.now() + this.deadlineMs };
      job.timer = setTimeout(() => {
        job.cancelled = true;
        const active = this.workers.find((slot) => slot.job === job);
        if (active) this.replace(active, new DeadlineError('Render deadline exceeded'));
        else job.reject(new DeadlineError('Render deadline exceeded'));
      }, this.deadlineMs);
      const cancel = () => {
        job.cancelled = true;
        if (job.timer) clearTimeout(job.timer);
        job.reject(new Error('Request aborted'));
      };
      request.once('aborted', cancel);
      this.queue.push(job);
      this.dispatch();
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    for (const job of this.queue.splice(0)) {
      if (job.timer) clearTimeout(job.timer);
      job.reject(new CapacityError('Server is closing'));
    }
    for (const slot of this.workers) {
      if (slot.job?.timer) clearTimeout(slot.job.timer);
      slot.job?.reject(new CapacityError('Service is closing'));
      slot.job = undefined;
    }
    await Promise.all(this.workers.map((slot) => slot.worker.terminate()));
  }
}

function json(response: ServerResponse, status: number, code: string, message: string, requestId: string): void {
  const body = Buffer.from(JSON.stringify({ error: { code, message, requestId } }));
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > 1_048_576) throw new RangeError('JSON body exceeds 1 MiB');
    chunks.push(data);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new SyntaxError('Malformed JSON'); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ChartValidationError('request', 'expected an object');
  return value as Record<string, unknown>;
}

/** A bounded rendering service that can be mounted in an existing HTTP application. */
export function createGroundCrewService(options: GroundCrewServiceOptions = {}) {
  registerGroundCrewFonts();
  const workerCount = options.workers ?? Math.min(2, cpus().length);
  const queueSize = options.queueSize ?? 32;
  const deadlineMs = options.deadlineMs ?? 10_000;
  if (![workerCount, queueSize, deadlineMs].every((v) => Number.isInteger(v) && v > 0)) throw new RangeError('Invalid server limits');
  const pool = new RenderPool(workerCount, queueSize, deadlineMs);
  let nextRequest = 0;
  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const requestId = String(++nextRequest);
    if (request.method === 'GET' && (request.url === '/healthz' || request.url === '/readyz')) {
      const ready = request.url === '/healthz' || pool.ready;
      const body = Buffer.from(JSON.stringify({ status: ready ? 'ok' : 'initializing' }));
      response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json', 'content-length': body.length });
      response.end(body);
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/render') {
      json(response, 404, 'NOT_FOUND', 'Endpoint not found', requestId);
      return;
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      json(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json', requestId);
      return;
    }
    try {
      const body = object(await readBody(request));
      for (const key of Object.keys(body)) if (!['chart', 'output'].includes(key)) throw new ChartValidationError(`request.${key}`, 'unsupported field');
      const chart = validateChartSpec(body['chart']);
      const output = body['output'] === undefined ? {} : object(body['output']);
      for (const key of Object.keys(output)) if (!['width', 'height', 'pixelRatio', 'format'].includes(key)) throw new ChartValidationError(`output.${key}`, 'unsupported field');
      const renderOptions = validateRenderOptions(output as RenderOptions);
      const bytes = await pool.render(chart, renderOptions, request);
      if (!response.destroyed) {
        response.writeHead(200, { 'content-type': 'image/png', 'content-length': bytes.length });
        response.end(bytes);
      }
    } catch (error) {
      if (response.destroyed) return;
      const message = error instanceof Error ? error.message : 'Render failed';
      if (error instanceof RangeError) json(response, 413, 'LIMIT_EXCEEDED', message, requestId);
      else if (error instanceof TypeError) json(response, 422, 'INVALID_OUTPUT', message, requestId);
      else if (error instanceof SyntaxError) json(response, 400, 'MALFORMED_JSON', message, requestId);
      else if (error instanceof ChartValidationError) json(response, 422, 'INVALID_CHART', message, requestId);
      else if (error instanceof CapacityError || error instanceof DeadlineError) json(response, 503, error instanceof DeadlineError ? 'RENDER_TIMEOUT' : 'CAPACITY_EXHAUSTED', message, requestId);
      else json(response, 500, 'RENDER_FAILED', message, requestId);
    }
  };
  return { handle, isReady: () => pool.ready, close: () => pool.close() };
}

export function createGroundCrewServer(options: GroundCrewServerOptions = {}) {
  const service = createGroundCrewService(options);
  const server = createServer(service.handle);
  return {
    server,
    listen: (port = options.port ?? 4201, host = options.host ?? '127.0.0.1') => new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(); });
    }),
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await service.close();
    },
  };
}
