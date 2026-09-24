#!/usr/bin/env node
import { createGroundCrewServer } from './server';

const port = Number(process.env['GROUND_CREW_PORT'] ?? 4201);
const host = process.env['GROUND_CREW_HOST'] ?? '127.0.0.1';
const app = createGroundCrewServer({ port, host });
void app.listen().then(() => {
  process.stdout.write(`Ground Crew listening on http://${host}:${port}\n`);
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().then(() => { process.exitCode = 0; }); });
}
