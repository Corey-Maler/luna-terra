import type { ChartSpec } from '@lunaterra/declarative';

// Complete deterministic example data. Replace these arrays with your provider's readings.
const HOUR = 3_600_000;
const asOf = Date.UTC(2026, 8, 23, 12);
const observations = Array.from({ length: 49 }, (_, i) => ({
  x: asOf + (i - 48) * HOUR,
  y: Number((15 + 3.3 * Math.sin(i * Math.PI / 12) + 0.4 * Math.sin(i * 1.7)).toFixed(1)),
}));
const forecast = Array.from({ length: 25 }, (_, i) => ({
  x: asOf + i * HOUR,
  y: Number((15.6 + 3.5 * Math.sin(i * Math.PI / 12)).toFixed(1)),
}));
const cover = [12, 8, 18, 32, 58, 75, 86, 94, 88, 74, 68, 60, 52, 44, 38, 30, 18, 10, 5, 8, 14, 26, 40, 55, 62];
const cloudForecast = cover.map((percent, i) => ({
  x: asOf + i * HOUR,
  cover: percent,
  // Illustrative daylight, 06:00–18:00 UTC; use your provider's daylight flag in production.
  isDay: (12 + i) % 24 >= 6 && (12 + i) % 24 < 18,
}));

export const chart: ChartSpec = {
  schemaVersion: 1,
  title: 'Temperature — Example station',
  x: { type: 'time', min: asOf - 48 * HOUR, max: asOf + 24 * HOUR, timeZone: 'UTC', locale: 'en-GB' },
  y: { label: 'Temperature (°C)' },
  controls: { zoom: true, pan: true, cursor: true, tooltip: true, minWindow: 6 * HOUR },
  series: [
    { id: 'observed', label: 'Observed', color: '#cf823d', unit: '°C',
      data: observations, stroke: { width: 2.5 }, maxGapX: 90 * 60_000 },
    { id: 'forecast', label: 'Forecast', color: '#cf823d', unit: '°C',
      data: forecast, stroke: { width: 2.5, dash: [7, 5] }, maxGapX: 90 * 60_000 },
    { id: 'clouds', label: 'Cloud cover', color: '#8295ad', unit: '%',
      lane: { min: 0, max: 100, top: 0.09, bottom: 0.09 },
      interpolation: 'step-after', maxGapX: 90 * 60_000,
      data: cloudForecast.map(point => ({
        x: point.x, y: point.cover, width: 2 + point.cover * 0.1,
        color: point.isDay && point.cover <= 20 ? '#e8b323' : '#8295ad',
      })),
    },
  ],
  rules: [{ x: asOf, label: 'Forecast begins', color: '#778ca7' }],
  regions: [{ from: asOf, to: asOf + 24 * HOUR, color: '#cf823d', opacity: 0.07 }],
};
