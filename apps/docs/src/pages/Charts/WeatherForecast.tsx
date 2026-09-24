import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { compileChart } from '@lunaterra/declarative';
import type { LunaTerraEngine } from '@lunaterra/core';
import { DocPage } from '../../components/DocPage/DocPage';
import { LiveCodeScene } from '../../components/LiveCodeScene';
import { chart } from './examples/forecastChart';
import chartSource from './examples/forecastChart.ts?raw';

const mountSource = `import { useCallback } from 'react';
import { LunaTerraCanvas } from '@lunaterra/react';
import { compileChart } from '@lunaterra/declarative';
import type { LunaTerraEngine } from '@lunaterra/core';
import { chart } from './forecastChart';

export default function Forecast() {
  const onCreate = useCallback((engine: LunaTerraEngine) => {
    engine.interactive = false;
    engine.add(compileChart(chart,
      { width: 800, height: 440, pixelRatio: 1 }, { responsive: true }));
  }, []);
  return <LunaTerraCanvas onCreate={onCreate}
    style={{ width: '100%', height: 440 }} aria-label="Temperature and cloud forecast" />;
}`;

export default function WeatherForecastPage() {
  const buildScene = useCallback((engine: LunaTerraEngine) => {
    engine.interactive = false;
    const view = compileChart(chart, { width: 800, height: 440, pixelRatio: 1 }, { responsive: true });
    engine.add(view);
    return view;
  }, []);
  return <DocPage title="Weather forecast" section="Charts">
    <DocPage.Section id="forecast" title="Two days behind, one day ahead">
      <p>Solid temperature readings cover the preceding 48 hours; the dashed line shows the next 24 hours. The strip above it shows cloud cover. This complete example generates illustrative hourly readings for 21–24 September 2026 in UTC.</p>
      <p>Drag the top ruler to zoom, the plot to pan, and the bottom caret to inspect temperatures and cloud cover. Ctrl + wheel zooms; touch supports pan and pinch.</p>
      <LiveCodeScene buildScene={buildScene} defaultConfig={{}} source={mountSource} canvasHeight={440} zoom={false} scrollBounds={null} />
    </DocPage.Section>
    <DocPage.Section id="source" title="Complete data and chart specification">
      <p>In a React + TypeScript application, install the packages below. Save the complete source in this section as <code>forecastChart.ts</code>, then save the component above as <code>Forecast.tsx</code> beside it and render <code>{'<Forecast />'}</code>. All input data is generated in the source shown here; no provider or helper package is required.</p>
      <DocPage.Pre>{`pnpm add @lunaterra/declarative @lunaterra/core @lunaterra/react`}</DocPage.Pre>
      <DocPage.Pre>{chartSource}</DocPage.Pre>
      <p>The live example imports this exact specification. It uses only generic chart concepts: line series, dash styles, an independent lane, point widths/colors, a boundary rule, and a shaded region.</p>
      <p><a download="forecastChart.ts" href={`data:text/plain;charset=utf-8,${encodeURIComponent(chartSource)}`}>Download this source</a> · <a download="chart.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ chart, output: { width: 900, height: 440 } }, null, 2))}`}>Download the complete JSON request</a></p>
      <p>The JSON download contains <code>{'{ chart, output }'}</code>, ready for <Link to="/ground-crew/overview">Ground Crew</Link> and its generic <code>/v1/render</code> endpoint.</p>
    </DocPage.Section>
    <DocPage.Section id="clouds" title="Cloud cover and sunshine">
      <p>Thickness grows from 2 px at 0% cover to 12 px at 100%. Each reading styles the interval until the next reading. Yellow means daytime with at most 20% cover; blue-gray means more cloud or nighttime. Clear nights remain thin and blue-gray.</p>
      <p>Equal lane bounds keep the strip at a constant height while preserving percentages in its tooltip. The temperature axis excludes this independent lane. The renderer interprets width and color; the example decides what they mean.</p>
      <p>For real forecasts, supply daylight from your provider or calculate it using the location’s sunrise and sunset. The example uses illustrative daylight from 06:00 to 18:00 UTC. Include a final reading to close the last interval.</p>
    </DocPage.Section>
    <DocPage.Section id="data" title="Replace the sample data">
      <p>Replace <code>observations</code> and <code>forecast</code> with sorted, unique <code>{'{ x, y }'}</code> readings. X is epoch milliseconds and Y is temperature in the unit you label. Use <code>Date.parse(isoTimestamp)</code> for timestamps with an explicit UTC offset. Keep observations inside the preceding 48 hours and forecast inside the following 24 hours relative to <code>asOf</code>.</p>
      <p>Use null Y for missing readings. <code>maxGapX</code> prevents connecting readings more than 90 minutes apart, including cursor interpolation. No unit conversion or synthetic joining point is added. For missing cloud cover, use null Y and a fallback width; validate that available percentages are between 0 and 100.</p>
      <p>See <Link to="/declarative/overview">Chart API</Link> for all fields and controls, <Link to="/charts/signal-scope">Signal scope</Link> for another composition of the same API, or <Link to="/charts/historic-temperatures">Historic temperatures</Link> for a complete aggregated-history example.</p>
    </DocPage.Section>
  </DocPage>;
}
