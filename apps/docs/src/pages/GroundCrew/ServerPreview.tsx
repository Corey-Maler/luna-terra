import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compileChart, validateChartSpec } from '@lunaterra/declarative';
import type { LunaTerraEngine } from '@lunaterra/core';
import { LunaTerraCanvas } from '../../../../../packages/react/src/LunaTerraCanvas';
import { getDocsDrawingTheme } from '../../theme/drawingTheme';
import { chart as forecastChart } from '../Charts/examples/forecastChart';
import styles from './ServerPreview.module.css';

interface Quota { renderLimit: number; windowSeconds: number }
interface PreviewImage { url: string; width: number; height: number; summary: string }

export function ServerPreview() {
  const [title, setTitle] = useState('Garden temperature');
  const [color, setColor] = useState('#cf823d');
  const [forecastHours, setForecastHours] = useState(24);
  const [width, setWidth] = useState(900);
  const [pixelRatio, setPixelRatio] = useState(1);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<PreviewImage | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const spec = useMemo(() => {
    const chart = validateChartSpec(structuredClone(forecastChart));
    chart.title = title.trim() || 'Garden temperature';
    const forecastStart = chart.rules![0].x;
    chart.x.max = forecastStart + forecastHours * 3_600_000;
    chart.series.forEach(series => { series.data = series.data.filter(point => point.x <= chart.x.max); });
    chart.regions?.forEach(region => { region.to = chart.x.max; });
    chart.series.filter(series => !series.lane).forEach(series => { series.color = color; });
    chart.regions?.forEach(region => { region.color = color; });
    chart.theme = { background: '#fcf9f2', foreground: '#5a3512', grid: '#9a9080' };
    return chart;
  }, [title, color, forecastHours]);

  const onCreate = useCallback((engine: LunaTerraEngine) => {
    engine.theme = getDocsDrawingTheme(false);
    engine.add(compileChart(spec, { width: 900, height: 360, pixelRatio: 1 }, { responsive: true }));
  }, [spec]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/config', { signal: controller.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Image server unavailable. Run the full demo to generate previews.');
      setQuota(await response.json() as Quota);
    }).catch(error => { if (error.name !== 'AbortError') setStatus('Image server unavailable. Run the full demo to generate previews.'); });
    return () => {
      controller.abort();
      requestRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!retryAt) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) { setRetryAt(0); setRemaining(null); setStatus('You can render another image now.'); }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  async function renderImage() {
    if (pending || retryAt > Date.now()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setStatus('Rendering image…');
    try {
      const response = await fetch('/api/v1/render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart: spec, output: { width, height: 360, pixelRatio } }),
        signal: controller.signal,
      });
      const left = response.headers.get('RateLimit-Remaining');
      if (left !== null) setRemaining(Number(left));
      if (response.status === 429) {
        const seconds = Math.max(1, Number(response.headers.get('Retry-After')) || 60);
        setRetryAt(Date.now() + seconds * 1000);
        throw new Error('Preview limit reached.');
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'The image could not be generated. Please try again.');
      }
      if (!response.headers.get('content-type')?.includes('image/png')) throw new Error('The server did not return a PNG image.');
      const url = URL.createObjectURL(await response.blob());
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setResult({ url, width: width * pixelRatio, height: 360 * pixelRatio, summary: `${spec.title} · ${forecastHours}h forecast` });
      setStatus('Image generated. Change the settings and render again to update it.');
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : 'Image rendering failed.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  const secondsLeft = Math.max(0, Math.ceil((retryAt - now) / 1000));
  return (
    <div className={styles.preview}>
      <div className={styles.controls}>
        <label>Chart title<input value={title} maxLength={80} onChange={event => setTitle(event.target.value)} /></label>
        <label>Line color<input type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
        <label>Forecast<select value={forecastHours} onChange={event => setForecastHours(Number(event.target.value))}>
          <option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option>
        </select></label>
        <label>Image width<select value={width} onChange={event => setWidth(Number(event.target.value))}>
          <option value={640}>640 px</option><option value={900}>900 px</option><option value={1200}>1200 px</option>
        </select></label>
        <label>Resolution<select value={pixelRatio} onChange={event => setPixelRatio(Number(event.target.value))}>
          <option value={1}>1×</option><option value={2}>2×</option>
        </select></label>
      </div>
      <p className={styles.caption}>Interactive browser chart — drag the rulers to zoom and inspect readings.</p>
      <LunaTerraCanvas onCreate={onCreate} background="#fcf9f2" style={{ width: '100%', height: 420 }} aria-label="Interactive weather chart used for the server preview" />
      <div className={styles.actions}>
        <button type="button" onClick={() => { void renderImage(); }} disabled={pending || secondsLeft > 0 || !quota}>
          {pending ? 'Rendering…' : secondsLeft > 0 ? `Try again in ${secondsLeft}s` : 'Render on server'}
        </button>
        {result && <a href={result.url} download="weather.png">Download PNG</a>}
      </div>
      {quota && <p className={styles.caption}>{quota.renderLimit} render requests per {quota.windowSeconds < 60 ? `${quota.windowSeconds} seconds` : `${Number((quota.windowSeconds / 60).toFixed(1))} minutes`} per IP.{remaining !== null ? ` ${remaining} remaining in this window.` : ''} Changing the browser chart uses no requests.</p>}
      <p role="status" aria-live="polite">{status}</p>
      {result ? <figure className={styles.image}>
        <img src={result.url} width={result.width} height={result.height} alt={`Server-rendered ${result.summary}`} />
        <figcaption>Last server image: {result.summary} · {result.width} × {result.height} pixels</figcaption>
      </figure> : <p className={styles.placeholder}>Your server-generated PNG will appear here.</p>}
    </div>
  );
}
