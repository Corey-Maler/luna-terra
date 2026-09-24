function integer(env, key, fallback, max) {
  const value = Number(env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`${key} must be an integer between 1 and ${max}`);
  return value;
}

export function readConfig(env = process.env) {
  const store = env.DEMO_RATE_STORE ?? 'redis';
  if (!['redis', 'memory'].includes(store)) throw new Error('DEMO_RATE_STORE must be redis or memory');
  const proxySetting = (env.DEMO_TRUST_PROXY ?? '').trim();
  return {
    host: env.DEMO_HOST ?? '0.0.0.0',
    port: integer(env, 'DEMO_PORT', 4200, 65535),
    rateLimit: integer(env, 'DEMO_RATE_LIMIT', 10, 100000),
    windowMs: integer(env, 'DEMO_RATE_WINDOW_MS', 600000, 86400000),
    workers: integer(env, 'DEMO_RENDER_WORKERS', 2, 16),
    queueSize: integer(env, 'DEMO_RENDER_QUEUE', 16, 1000),
    deadlineMs: integer(env, 'DEMO_RENDER_TIMEOUT_MS', 10000, 120000),
    // '1' is for a private backend reached directly through one edge proxy.
    // Other values are explicit IPs/CIDRs/named ranges. Never trust all hops.
    trustProxy: proxySetting === '1' ? 1 : proxySetting.split(',').map(value => value.trim()).filter(Boolean),
    store,
    redisUrl: env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  };
}
