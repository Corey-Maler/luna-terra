import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from './config.mjs';
import { createDemoApp } from './app.mjs';

const cleanups = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function setup(overrides = {}, extras = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'luna-demo-test-'));
  await writeFile(join(directory, 'index.html'), '<html>Interactive Luna-Terra docs</html>');
  let renders = 0;
  const renderService = {
    isReady: () => true,
    handle: async (_request, response) => { renders++; response.type('image/png').end(Buffer.from('89504e470d0a1a0a', 'hex')); },
  };
  const app = createDemoApp({ config: { ...readConfig({}), ...overrides }, renderService, docsDirectory: directory, ...extras });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, renders: () => renders, post: (ip, path = '/api/v1/render') => fetch(`${base}${path}`, { method: 'POST', headers: { 'X-Forwarded-For': ip } }) };
}

describe('public demo', () => {
  it('allows ten renders then throttles rendering, independently per visitor', async () => {
    const demo = await setup({ trustProxy: ['loopback'] });
    const responses = await Promise.all(Array.from({ length: 12 }, () => demo.post('203.0.113.10')));
    expect(responses.filter(response => response.status === 200)).toHaveLength(10);
    expect(responses.filter(response => response.status === 429)).toHaveLength(2);
    const blocked = responses.find(response => response.status === 429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(blocked.headers.get('RateLimit-Remaining')).toBe('0');
    expect((await blocked.json()).error.code).toBe('RATE_LIMITED');
    expect((await demo.post('203.0.113.11')).status).toBe(200);
    expect(demo.renders()).toBe(11);
  });

  it('ignores spoofed forwarding headers from untrusted connections', async () => {
    const demo = await setup({ rateLimit: 1 });
    expect((await demo.post('203.0.113.1')).status).toBe(200);
    expect((await demo.post('203.0.113.2')).status).toBe(429);
  });

  it('walks forwarding headers from the trusted proxy, ignoring spoofed leftmost addresses', async () => {
    const demo = await setup({ rateLimit: 1, trustProxy: ['loopback'] });
    expect((await demo.post('198.51.100.10, 203.0.113.7')).status).toBe(200);
    expect((await demo.post('198.51.100.99, 203.0.113.7')).status).toBe(429);
  });

  it('uses the nearest forwarded IP behind a single Coolify proxy hop', async () => {
    const config = readConfig({ DEMO_TRUST_PROXY: '1' });
    expect(config.trustProxy).toBe(1);
    const demo = await setup({ ...config, rateLimit: 1 });
    expect((await demo.post('198.51.100.10, 203.0.113.7')).status).toBe(200);
    expect((await demo.post('198.51.100.99, 203.0.113.7')).status).toBe(429);
    expect((await demo.post('203.0.113.8')).status).toBe(200);
  });

  it('groups IPv6 addresses in one visitor subnet', async () => {
    const demo = await setup({ rateLimit: 1, trustProxy: ['loopback'] });
    expect((await demo.post('2001:db8:1234:5600::1')).status).toBe(200);
    expect((await demo.post('2001:db8:1234:5600::2')).status).toBe(429);
    expect((await demo.post('2001:db8:9999::1')).status).toBe(200);
  });

  it('resets quotas after the configured interval and keeps docs outside the quota', async () => {
    const demo = await setup({ rateLimit: 1, windowMs: 150, trustProxy: ['loopback'] });
    expect((await demo.post('203.0.113.1')).status).toBe(200);
    expect((await demo.post('203.0.113.1')).status).toBe(429);
    expect(await (await fetch(`${demo.base}/ground-crew/overview`)).text()).toContain('Interactive Luna-Terra docs');
    expect(await (await fetch(`${demo.base}/api/config`)).json()).toEqual({ renderLimit: 1, windowSeconds: 1 });
    expect((await fetch(`${demo.base}/api/unknown`)).status).toBe(404);
    await new Promise(resolve => setTimeout(resolve, 180));
    expect((await demo.post('203.0.113.1')).status).toBe(200);
  });

  it('fails closed if Redis is unavailable without taking the docs offline', async () => {
    const demo = await setup({}, { isStoreReady: () => false });
    expect((await demo.post('203.0.113.1')).status).toBe(503);
    expect((await fetch(`${demo.base}/readyz`)).status).toBe(503);
    expect((await fetch(`${demo.base}/`)).status).toBe(200);
    expect(demo.renders()).toBe(0);
  });

  it('validates configuration and defaults to ten images in ten minutes', () => {
    expect(readConfig({})).toMatchObject({ rateLimit: 10, windowMs: 600000, store: 'redis', trustProxy: [] });
    expect(readConfig({ DEMO_RATE_LIMIT: '1000' }).rateLimit).toBe(1000);
    expect(() => readConfig({ DEMO_RATE_LIMIT: 'NaN' })).toThrow();
    expect(() => readConfig({ DEMO_RATE_WINDOW_MS: '0' })).toThrow();
  });
});
