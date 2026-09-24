import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { createGroundCrewService } from '@lunaterra/ground-crew/server';
import { readConfig } from './config.mjs';
import { createDemoApp } from './app.mjs';

const config = readConfig();
let redis;
let store;
if (config.store === 'redis') {
  redis = createClient({ url: config.redisUrl, disableOfflineQueue: true, socket: { connectTimeout: 5000 } });
  redis.on('error', error => console.error('Redis connection:', error.message));
  await redis.connect();
  store = new RedisStore({ sendCommand: (...args) => redis.sendCommand(args), prefix: 'luna-demo:render:' });
}
const renderService = createGroundCrewService({ workers: config.workers, queueSize: config.queueSize, deadlineMs: config.deadlineMs });
const app = createDemoApp({
  config, renderService, store,
  isStoreReady: () => !redis || redis.isReady,
  docsDirectory: process.env.DEMO_DOCS_DIR ?? fileURLToPath(new URL('../../../dist/apps/docs', import.meta.url)),
});
const server = createServer(app);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.listen(config.port, config.host, () => console.log(`Luna-Terra demo listening on port ${config.port} (${config.rateLimit} renders / ${config.windowMs / 60000} min, ${config.store})`));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 15000);
  deadline.unref();
  await new Promise(resolve => server.close(resolve));
  await renderService.close();
  if (redis?.isOpen) await redis.quit();
  clearTimeout(deadline);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close(); });
