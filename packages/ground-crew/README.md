# @lunaterra/ground-crew

A Node.js package for rendering Luna-Terra charts as PNGs. Import it into your application, Express route, or background job. Requires Node.js 22 or later. Importing the main entry does not start a server or worker pool.

```sh
pnpm add @lunaterra/ground-crew @lunaterra/declarative
```

## Render an image

```js
import { readFile, writeFile } from 'node:fs/promises';
import { renderChart } from '@lunaterra/ground-crew';
import { validateChartSpec } from '@lunaterra/declarative';

// examples/chart.json contains a complete 48h history + 24h forecast.
const { chart } = JSON.parse(await readFile('chart.json', 'utf8'));
const spec = validateChartSpec(chart);
const image = await renderChart(spec, { width: 900, height: 360, pixelRatio: 2 });
await writeFile('chart.png', image.bytes);
```

`renderChart(spec, options)` returns `{ bytes: Buffer, mimeType: 'image/png', width, height, metadata: { summary } }`. Width and height in the result are physical pixels. It uses the same `ChartView`, `LineSeries`, annotations, and data as the browser, with interactive controls disabled for the PNG.

## Express

```js
import express from 'express';
import { createChartHandler } from '@lunaterra/ground-crew';
import { validateChartSpec, ChartValidationError } from '@lunaterra/declarative';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.post('/chart.png', createChartHandler({
  getChart: (req) => validateChartSpec(req.body.chart),
  output: { width: 900, height: 360 },
}));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error instanceof ChartValidationError ? 422 : 500)
    .json({ error: error.message });
});
app.listen(3000);
```

Run the complete repository example after `pnpm build`:

```sh
node packages/ground-crew/examples/express.mjs
curl http://localhost:3000/chart.png \
  -H 'Content-Type: application/json' \
  --data-binary @packages/ground-crew/examples/chart.json -o chart.png
```

`createChartHandler({ getChart, output })` returns an Express-compatible handler. `getChart(request)` can asynchronously load data from your provider or database and return a `ChartSpec`. `output` accepts render options or a function of the request. Errors go to `next(error)`. In TypeScript, use `createChartHandler<Request>` with your application's Express request type. Express is supplied by your app; it is not a runtime dependency of Ground Crew.

For other frameworks, call `renderChart` directly and send `image.bytes` with `image.mimeType`. Your application controls routing, authentication, caching, request validation, and persistence. Native drawing runs in the calling process; for sustained concurrency, invoke it through your own worker queue.

## Canvas2D surface

`createNodeSurface(options)` returns `{ canvas, context, surface, width, height, pixelRatio, encode }`. `context` is the native Canvas2D context (physical pixel coordinates), `surface` is the adapter for `new LunaTerraEngine(surface)`, and `encode()` returns PNG bytes. When composing your own declarative scene, pass `{ interactive: false }` as the third argument to `compileChart`. Call `engine.renderFrame()`, encode, and release the engine in `finally` using `engine.destroy()`.

The static surface supports Canvas2D elements. Animation and interactive UI require a browser engine. Ground Crew bundles Liberation Sans under the SIL Open Font License; see `assets/fonts/LICENSE`. Browser and native font metrics may differ.

## Output options

| Option | Default | Meaning |
| --- | --- | --- |
| `width` | 1200 | Logical width, integer, at least 320 |
| `height` | 480 | Logical height, integer, at least 240 |
| `pixelRatio` | 1 | 0.5–4; physical dimensions must be integers |
| `format` | `png` | PNG output |

Physical images are limited to 4096 pixels per side and 8 million pixels total. Charts with many legend rows may require more height. The default image background is `#fcf9f2`; set `spec.theme` for explicit image colors.

## Optional standalone command

```sh
pnpm exec ground-crew
# From this repository after pnpm build:
pnpm --filter @lunaterra/ground-crew start
```

The optional CLI listens on `127.0.0.1:4201`. `GROUND_CREW_HOST` and `GROUND_CREW_PORT` configure it. It uses a bounded worker pool, queue, and rendering deadline.

- `POST /v1/render`: `{ chart: ChartSpec, output?: RenderOptions }` → PNG.
- `GET /healthz` and `GET /readyz`: JSON status.

Bodies are limited to 1 MiB and charts to 10,000 points. For programmatic standalone use, import `createGroundCrewServer` from `@lunaterra/ground-crew/server` and call its `listen()` and `close()` methods.

`createGroundCrewService({ workers, queueSize, deadlineMs })`, exported from `@lunaterra/ground-crew/server`, provides `{ handle, isReady, close }` for embedding the bounded worker service in an existing Node HTTP app. `handle(request, response)` accepts the standalone endpoint paths and reads the raw JSON stream; mount it before body-parsing middleware. Apply application policies such as rate limits and trusted proxy configuration before calling it. Call `close()` during application shutdown. The [Docker demo](../../docs/docker-demo.md) composes this service with the documentation app and a Redis quota.
