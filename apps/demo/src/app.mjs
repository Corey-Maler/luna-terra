import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { resolve } from 'node:path';

/** Compose static docs and a worker-backed render service on one origin. */
export function createDemoApp({ config, renderService, store, isStoreReady = () => true, docsDirectory }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }));
  app.get('/readyz', (_request, response) => {
    const ready = renderService.isReady() && isStoreReady();
    response.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'initializing' });
  });
  app.get('/api/config', (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json({ renderLimit: config.rateLimit, windowSeconds: Math.ceil(config.windowMs / 1000) });
  });
  const limiter = rateLimit({
    windowMs: config.windowMs,
    limit: config.rateLimit,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    ipv6Subnet: 56,
    store,
    passOnStoreError: false,
    handler: (request, response) => {
      const retryAfter = Math.max(1, Math.ceil((request.rateLimit.resetTime.getTime() - Date.now()) / 1000));
      response.setHeader('Retry-After', retryAfter);
      response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Preview limit reached. Please wait before rendering another image.', retryAfter } });
    },
  });
  // Shared quota for both routes; applied before body parsing or worker allocation.
  // Attempts count even if validation fails, preventing unbounded invalid render traffic.
  app.use('/api', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    const path = request.path;
    if (request.method !== 'POST' || path !== '/v1/render') {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
      return;
    }
    if (!isStoreReady()) {
      response.status(503).json({ error: { code: 'LIMITER_UNAVAILABLE', message: 'Image previews are temporarily unavailable.' } });
      return;
    }
    // Canonicalize query strings for the raw HTTP handler.
    request.url = path;
    limiter(request, response, error => {
      if (error) return next(error);
      void renderService.handle(request, response).catch(next);
    });
  });
  app.use(express.static(resolve(docsDirectory), { index: false, dotfiles: 'deny' }));
  app.get('/{*path}', (request, response) => {
    if (!request.accepts('html') || /\.[a-z0-9]+$/i.test(request.path)) return response.sendStatus(404);
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(resolve(docsDirectory, 'index.html'));
  });
  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    console.error('Demo request failed:', error.message);
    response.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Image previews are temporarily unavailable.' } });
  });
  return app;
}
