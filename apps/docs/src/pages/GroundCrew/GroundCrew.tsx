import { Link } from 'react-router-dom';
import { ServerPreview } from './ServerPreview';
import { DocPage } from '../../components/DocPage/DocPage';

export default function GroundCrewPage() {
  return (
    <DocPage title="Server rendering" section="@lunaterra/ground-crew">
      <p>Ground Crew is a Node.js package that renders Luna-Terra scenes on a native Canvas2D surface. Import it into an existing application, an Express route, or a background job. It returns PNG bytes; your application owns routing and storage.</p>
      <DocPage.Section id="preview" title="Try the server renderer">
        <p>Adjust the chart below, then generate a PNG from the same data on the Node server. The image includes the complete selected history and forecast; browser zoom and cursor movements do not change the exported range.</p>
        <ServerPreview />
      </DocPage.Section>
      <DocPage.Section id="install" title="Render a PNG">
        <DocPage.Pre>{`pnpm add @lunaterra/ground-crew @lunaterra/declarative`}</DocPage.Pre>
        <p>Requires Node.js 22 or later. Save the <Link to="/charts/weather-forecast#source">complete chart specification</Link> as <code>chart.json</code>, then run this as <code>render.mjs</code>.</p>
        <DocPage.Pre>{`import { readFile, writeFile } from 'node:fs/promises';
import { validateChartSpec } from '@lunaterra/declarative';
import { renderChart } from '@lunaterra/ground-crew';

const { chart } = JSON.parse(await readFile('chart.json', 'utf8'));
const spec = validateChartSpec(chart);
const image = await renderChart(spec, {
  width: 900, height: 360, pixelRatio: 2,
});
await writeFile('chart.png', image.bytes);
// image: { bytes: Buffer, mimeType: 'image/png',
//          width: 1800, height: 720, metadata: { summary: ... } }`}</DocPage.Pre>
        <p>The same <code>ChartView</code>, <code>LineSeries</code>, annotations, and data are used in the browser and on the server. A PNG is a static snapshot: the browser view adds the configured Luna-Terra timeline controls. No browser process is required for image rendering.</p>
      </DocPage.Section>
      <DocPage.Section id="express" title="Use in Express">
        <p>Mount the package handler on a route you choose. Your app supplies data through <code>getChart</code>, so authentication, data providers, caching, and error handling stay in the app. Importing Ground Crew starts no listener or worker pool.</p>
        <DocPage.Pre>{`import express from 'express';
import { validateChartSpec, ChartValidationError } from '@lunaterra/declarative';
import { createChartHandler } from '@lunaterra/ground-crew';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/chart.png', createChartHandler({
  getChart: (req) => validateChartSpec(req.body.chart),
  output: { width: 900, height: 360, pixelRatio: 2 },
}));

// Rejected input and render failures flow to your Express error handler.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof ChartValidationError ? 422 : 500;
  res.status(status).json({ error: error.message });
});
app.listen(3000);`}</DocPage.Pre>
        <DocPage.Pre>{`curl http://localhost:3000/chart.png \\
  -H 'Content-Type: application/json' \\
  --data-binary @chart.json -o chart.png`}</DocPage.Pre>
        <p>For TypeScript, use <code>createChartHandler&lt;Request&gt;</code> with <code>Request</code> imported from Express to access typed body, params, and user fields. <code>getChart</code> may return a promise. <code>output</code> may also be a function of the request.</p>
        <p>You can also call <code>await renderChart(spec, options)</code> inside any existing route and send <code>image.bytes</code> with its <code>image.mimeType</code>. The handler forwards failures with <code>next(error)</code>, following <a href="https://expressjs.com/en/guide/error-handling/">Express error handling</a>.</p>
      </DocPage.Section>
      <DocPage.Section id="surface" title="Use the Node canvas surface">
        <p>For trusted custom scenes, <code>createNodeSurface</code> exposes a native canvas, its 2D context, and the adapter for <code>LunaTerraEngine</code>. Reuse the existing chart and element packages for drawing.</p>
        <DocPage.Pre>{`import { LunaTerraEngine } from '@lunaterra/core';
import { compileChart } from '@lunaterra/declarative';
import { createNodeSurface } from '@lunaterra/ground-crew';

const surface = createNodeSurface({ width: 900, height: 360 });
const engine = new LunaTerraEngine(surface.surface);
try {
  engine.add(compileChart(spec,
    { width: 900, height: 360, pixelRatio: 1 },
    { interactive: false },
  ));
  engine.renderFrame();
  const png = await surface.encode();
} finally {
  engine.destroy();
}`}</DocPage.Pre>
        <p><code>surface.context</code> provides Canvas2D operations for trusted application code; its coordinates are physical pixels. Static surfaces support Canvas2D scenes and <code>renderFrame()</code>. Interactive UI and animation require a browser engine.</p>
      </DocPage.Section>
      <DocPage.Section id="options" title="Output and execution">
        <p><code>renderChart</code> defaults to 1200 × 480 logical pixels, pixel ratio 1, PNG format. Width and height must be integers, at least 320 × 240. Pixel ratio ranges from 0.5 to 4, with integer physical dimensions, at most 4096 pixels per side and 8 million pixels total. It returns a buffer, MIME type, physical dimensions, and a plain-text summary.</p>
        <p>Ground Crew bundles Liberation Sans for predictable server text. The default image background is warm white; set <code>spec.theme</code> to choose explicit image colors. A browser may use different font metrics.</p>
        <p>Native drawing runs in the calling Node process; the promise includes PNG encoding. For sustained concurrent rendering, call the library from your own worker queue, or use the optional CLI with its bounded worker pool.</p>
      </DocPage.Section>
      <DocPage.Section id="standalone" title="Optional standalone command">
        <p>The package also includes a convenience service for scripts and local previews.</p>
        <DocPage.Pre>{`pnpm exec ground-crew
# In this repository, after pnpm build:
pnpm --filter @lunaterra/ground-crew start`}</DocPage.Pre>
        <p>It listens on <code>127.0.0.1:4201</code>. Set <code>GROUND_CREW_HOST</code> and <code>GROUND_CREW_PORT</code> to change the bind address. Post <code>{'{ chart, output }'}</code> to <code>/v1/render</code> to receive PNG bytes. The service bounds requests to 1 MiB and uses a worker pool with a queue and deadlines.</p>
        <p>For programmatic standalone use, import <code>createGroundCrewServer</code> from <code>@lunaterra/ground-crew/server</code>, then call <code>listen()</code> and <code>close()</code>. The main package entry exports the library and Express handler.</p>
      </DocPage.Section>
    </DocPage>
  );
}
