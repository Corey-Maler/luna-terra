import HistoricTemperaturesExample from './examples/HistoricTemperaturesExample';
import exampleSource from './examples/HistoricTemperaturesExample.tsx?raw';
import { DocPage } from '../../components/DocPage/DocPage';

const mountSource = `import { createRoot } from 'react-dom/client';
import HistoricTemperaturesExample from './HistoricTemperaturesExample';

createRoot(document.getElementById('root')!).render(<HistoricTemperaturesExample />);`;
const download = `data:text/plain;charset=utf-8,${encodeURIComponent(exampleSource)}`;

export default function HistoricTemperaturesPage() {
  return <DocPage title="Historic temperatures" section="Charts">
    <DocPage.Section id="example" title="Temperature, humidity, and heating history">
      <p>A 30-day climate history with a temperature min/max envelope, humidity overlay, heating-state strip, and labels for local highs and lows. The chart initially shows the last seven days. Readings are deterministic sample data, generated every five minutes from 31 March 2026 at 00:00 UTC.</p>
      <HistoricTemperaturesExample />
      <p>Drag the top ruler between Hours (24 hours), Days (3 days), and Weeks (7 days). Drag the plot or use the wheel to pan through the 30-day capture; Ctrl + wheel zooms. Drag the bottom caret to inspect temperature, humidity, and heating state. Touch supports pan and pinch. On a narrow screen, scroll the 560 px example horizontally.</p>
    </DocPage.Section>
    <DocPage.Section id="setup" title="Reproduce this exact chart">
      <p>The live chart above runs the complete component printed below. It includes every data generator, aggregation function, drawing element, label rule, color, dimension, and event callback. It imports only React and published Luna-Terra package entry points; it needs no data download, service, docs component, or hidden stylesheet.</p>
      <ol>
        <li>Start with a React + TypeScript application, such as the Vite React TypeScript template.</li>
        <li>Install the packages below.</li>
        <li>Save the complete component below as <code>src/HistoricTemperaturesExample.tsx</code>.</li>
        <li>Replace <code>src/main.tsx</code> with the mounting code below. Your HTML entry must contain <code>{'<div id="root"></div>'}</code>.</li>
        <li>Run your app’s development command (for Vite, <code>pnpm dev</code>).</li>
      </ol>
      <DocPage.Pre>{`pnpm add react react-dom @lunaterra/react @lunaterra/core @lunaterra/charts @lunaterra/elements @lunaterra/math @lunaterra/ui @lunaterra/color`}</DocPage.Pre>
      <p>The packages must include <code>TimelineChartChrome</code> and <code>LunaTerraCanvas</code>. When working from this repository before publishing, build the workspace with <code>pnpm build</code> and use its workspace packages.</p>
      <DocPage.Pre>{mountSource}</DocPage.Pre>
      <p>The component owns its explicit light palette and 560 × 252 px canvas, so the result does not depend on the docs theme. <code>LunaTerraCanvas</code> creates the engine and destroys it on unmount; its stable <code>onCreate</code> callback adds the scene. The chart shell owns gestures, with engine-level interaction disabled.</p>
    </DocPage.Section>
    <DocPage.Section id="source" title="Complete runnable component">
      <p><a href={download} download="HistoricTemperaturesExample.tsx">Download this component</a>, or copy the complete source below. This is the same source file imported by the live example, so the displayed implementation stays in sync.</p>
      <DocPage.Pre>{exampleSource}</DocPage.Pre>
    </DocPage.Section>
    <DocPage.Section id="data" title="Use your own readings">
      <p>Replace the three sample generators near the beginning of the component. X values are elapsed minutes from <code>DATA_START_UTC</code>; temperatures are Celsius, humidity is percent, and heating segments are start/end minute pairs. Keep readings sorted by minute and cover the full capture interval.</p>
      <DocPage.Pre>{`// Example input shapes; replace the generated arrays with your full dataset.
const RAW_TEMPERATURE_SAMPLES: TemperatureSample[] = [
  { minute: 0, temp: 18.2 }, { minute: 5, temp: 18.6 },
];
const RAW_HUMIDITY_SAMPLES: HumiditySample[] = [
  { minute: 0, humidity: 55 }, { minute: 5, humidity: 54 },
];
const HEATING_SEGMENTS = [{ x0: 0, x1: 25 }];
// Epoch milliseconds → elapsed minutes:
// minute = (timestampMs - DATA_START_UTC) / 60_000`}</DocPage.Pre>
      <p>Those short arrays show the shape; the runnable component generates the entire dataset itself. Update <code>DATA_START_UTC</code>, <code>TOTAL_DAYS</code>, and <code>RAW_STEP_MINUTES</code> for your capture, and keep the maximum visible window within its duration. The supplied aggregation assumes finite, continuous readings; segment missing data before adapting this example to a sensor with outages.</p>
      <p>The sample heater uses hysteresis: it turns on at or below 19°C and off at or above 20°C. With real equipment, replace <code>HEATING_SEGMENTS</code> with measured state intervals instead of inferring them from temperature.</p>
    </DocPage.Section>
    <DocPage.Section id="aggregation" title="How the chart is composed">
      <table><thead><tr><th>Part</th><th>Implementation and behavior</th></tr></thead><tbody>
        <tr><td>Temperature envelope</td><td>Each time bucket retains its minimum and maximum. Two LineSeries draw the bounds; the included RangeFill element fills the polygon between them.</td></tr>
        <tr><td>Humidity</td><td>Each bucket uses mean humidity, drawn by another LineSeries. Humidity has its own 20–90% scale mapped into the same plot; it does not share temperature units.</td></tr>
        <tr><td>Heating</td><td>StateBandSeries draws thick active intervals above a thin baseline.</td></tr>
        <tr><td>Aggregation level</td><td>5-minute buckets for windows up to 36 hours, 15-minute buckets up to four days, and 30-minute buckets for larger windows. All three levels are cached once per component mount.</td></tr>
        <tr><td>Viewport and cursor</td><td>TimelineChartChrome composes ScaleRuler, plot gestures, crosshair, and tooltip. Its onStateChange callback selects the aggregation level and updates the visible bounds and labels.</td></tr>
        <tr><td>High/low labels</td><td>A moving average selects candidate extrema; spacing and prominence filters reduce clutter. Labels are anchored to the unsmoothed series. Smoothing affects label selection only.</td></tr>
      </tbody></table>
      <p>This example composes the element API directly because it includes adaptive aggregation and extrema labels. The complete code for that composition is above. Its helpers belong to the example; they are not additional chart constructors exported by the declarative package.</p>
      <p>To change appearance, edit the palette in <code>buildScene</code>, stroke widths where the line series are constructed, and the geometry constants near the top. To change zoom behavior, edit the three window durations and their logarithmic mapping functions together. The tooltip reads the current aggregated series, so its temperature min/max values depend on zoom level.</p>
    </DocPage.Section>
  </DocPage>;
}
