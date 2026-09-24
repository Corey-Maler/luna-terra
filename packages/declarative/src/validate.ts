import type { ChartSpec } from './schema';

export class ChartValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ChartValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function fail(path: string, message: string): never { throw new ChartValidationError(path, message); }
function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object');
  return value as Record<string, unknown>;
}
function allowed(value: Record<string, unknown>, keys: string[], path: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unsupported field');
}
function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'expected a finite number');
  return value;
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 160 || !value.trim()) fail(path, 'expected nonempty text up to 160 characters');
  return value;
}
function color(value: unknown, path: string): void {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) fail(path, 'expected a six-digit hex color');
}

export function validateChartSpec(input: unknown): ChartSpec {
  const spec = record(input, 'chart');
  allowed(spec, ['schemaVersion', 'title', 'x', 'y', 'series', 'rules', 'regions', 'theme', 'controls'], 'chart');
  if (spec['schemaVersion'] !== 1) fail('chart.schemaVersion', 'expected version 1');
  string(spec['title'], 'chart.title');
  const x = record(spec['x'], 'chart.x');
  allowed(x, ['type', 'min', 'max', 'label', 'timeZone', 'locale'], 'chart.x');
  if (x['type'] !== 'time' && x['type'] !== 'number') fail('chart.x.type', 'expected time or number');
  if (finite(x['min'], 'chart.x.min') >= finite(x['max'], 'chart.x.max')) fail('chart.x', 'min must be below max');
  if (x['type'] === 'time' && (Math.abs(x['min'] as number) > 8.64e15 || Math.abs(x['max'] as number) > 8.64e15)) fail('chart.x', 'time domain is outside the supported date range');
  if (x['label'] !== undefined) string(x['label'], 'chart.x.label');
  if (x['locale'] !== undefined) {
    string(x['locale'], 'chart.x.locale');
    try { new Intl.DateTimeFormat(x['locale'] as string); }
    catch { fail('chart.x.locale', 'invalid locale'); }
  }
  if (x['timeZone'] !== undefined) {
    string(x['timeZone'], 'chart.x.timeZone');
    try { new Intl.DateTimeFormat('en', { timeZone: x['timeZone'] as string }); }
    catch { fail('chart.x.timeZone', 'invalid time zone'); }
  }
  const y = record(spec['y'], 'chart.y');
  allowed(y, ['min', 'max', 'label'], 'chart.y');
  string(y['label'], 'chart.y.label');
  if (y['min'] !== undefined) finite(y['min'], 'chart.y.min');
  if (y['max'] !== undefined) finite(y['max'], 'chart.y.max');
  if (y['min'] !== undefined && y['max'] !== undefined && (y['min'] as number) >= (y['max'] as number)) fail('chart.y', 'min must be below max');
  if (!Array.isArray(spec['series']) || spec['series'].length > 12) fail('chart.series', 'expected up to 12 series');
  const ids = new Set<string>();
  let totalPoints = 0;
  spec['series'].forEach((item: unknown, i: number) => {
    const path = `chart.series[${i}]`;
    const s = record(item, path);
    allowed(s, ['id', 'label', 'color', 'data', 'stroke', 'maxGapX', 'interpolation', 'lane', 'unit'], path);
    const id = string(s['id'], `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, 'duplicate ID');
    ids.add(id);
    string(s['label'], `${path}.label`);
    color(s['color'], `${path}.color`);
    if (!Array.isArray(s['data'])) fail(`${path}.data`, 'expected an array');
    totalPoints += s['data'].length;
    if (totalPoints > 10000) fail('chart.series', 'too many data points');
    let lastX = -Infinity;
    s['data'].forEach((point: unknown, j: number) => {
      const p = record(point, `${path}.data[${j}]`);
      allowed(p, ['x', 'y', 'width', 'color'], `${path}.data[${j}]`);
      if (p['color'] !== undefined) color(p['color'], `${path}.data[${j}].color`);
      if (p['width'] !== undefined && (finite(p['width'], `${path}.data[${j}].width`) <= 0 || (p['width'] as number) > 20)) fail(`${path}.data[${j}].width`, 'expected width between 0 and 20');
      const px = finite(p['x'], `${path}.data[${j}].x`);
      if (px <= lastX) fail(`${path}.data[${j}].x`, 'timestamps must be strictly increasing');
      lastX = px;
      if (p['y'] !== null) finite(p['y'], `${path}.data[${j}].y`);
    });
    if (s['unit'] !== undefined) string(s['unit'], `${path}.unit`);
    if (s['interpolation'] !== undefined && !['linear', 'step-after'].includes(s['interpolation'] as string)) fail(`${path}.interpolation`, 'expected linear or step-after');
    if (s['lane'] !== undefined) {
      const lane = record(s['lane'], `${path}.lane`);
      allowed(lane, ['min', 'max', 'top', 'bottom'], `${path}.lane`);
      if (finite(lane['min'], `${path}.lane.min`) >= finite(lane['max'], `${path}.lane.max`)) fail(`${path}.lane`, 'min must be below max');
      const top = finite(lane['top'], `${path}.lane.top`), bottom = finite(lane['bottom'], `${path}.lane.bottom`);
      if (top < 0 || bottom > 1 || top > bottom) fail(`${path}.lane`, 'expected 0 <= top <= bottom <= 1');
    }
    if (s['maxGapX'] !== undefined && finite(s['maxGapX'], `${path}.maxGapX`) <= 0) fail(`${path}.maxGapX`, 'must be positive');
    if (s['stroke'] !== undefined) {
      const stroke = record(s['stroke'], `${path}.stroke`);
      allowed(stroke, ['width', 'dash'], `${path}.stroke`);
      if (stroke['width'] !== undefined && (finite(stroke['width'], `${path}.stroke.width`) <= 0 || (stroke['width'] as number) > 20)) fail(`${path}.stroke.width`, 'expected width between 0 and 20');
      if (stroke['dash'] !== undefined) {
        if (!Array.isArray(stroke['dash']) || stroke['dash'].length > 8) fail(`${path}.stroke.dash`, 'expected up to 8 dash lengths');
        stroke['dash'].forEach((d: unknown, k: number) => { if (finite(d, `${path}.stroke.dash[${k}]`) <= 0) fail(`${path}.stroke.dash[${k}]`, 'must be positive'); });
      }
    }
  });
  for (const key of ['rules', 'regions'] as const) {
    const entries = spec[key];
    if (entries === undefined) continue;
    if (!Array.isArray(entries) || entries.length > 24) fail(`chart.${key}`, 'expected up to 24 entries');
    entries.forEach((item: unknown, i: number) => {
      const p = `chart.${key}[${i}]`;
      const e = record(item, p);
      allowed(e, key === 'rules' ? ['x', 'label', 'color'] : ['from', 'to', 'color', 'opacity'], p);
      if (key === 'rules') { finite(e['x'], `${p}.x`); string(e['label'], `${p}.label`); }
      else if (finite(e['from'], `${p}.from`) >= finite(e['to'], `${p}.to`)) fail(p, 'from must be below to');
      if (key === 'regions' && e['opacity'] !== undefined && (finite(e['opacity'], `${p}.opacity`) < 0 || (e['opacity'] as number) > 1)) fail(`${p}.opacity`, 'expected 0–1');
      if (e['color'] !== undefined) color(e['color'], `${p}.color`);
      else if (key === 'regions') fail(`${p}.color`, 'required');
    });
  }
  if (spec['controls'] !== undefined && spec['controls'] !== false) {
    const controls = record(spec['controls'], 'chart.controls');
    allowed(controls, ['zoom', 'pan', 'cursor', 'tooltip', 'minWindow', 'initialWindow'], 'chart.controls');
    for (const key of ['zoom', 'pan', 'cursor', 'tooltip']) {
      if (controls[key] !== undefined && typeof controls[key] !== 'boolean') fail(`chart.controls.${key}`, 'expected a boolean');
    }
    const span = (x['max'] as number) - (x['min'] as number);
    for (const key of ['minWindow', 'initialWindow']) {
      if (controls[key] !== undefined && (finite(controls[key], `chart.controls.${key}`) <= 0 || (controls[key] as number) > span)) fail(`chart.controls.${key}`, 'expected a positive window within the X domain');
    }
    if (controls['minWindow'] !== undefined && controls['initialWindow'] !== undefined && (controls['minWindow'] as number) > (controls['initialWindow'] as number)) fail('chart.controls.initialWindow', 'must be at least minWindow');
  }
  if (spec['theme'] !== undefined) {
    const theme = record(spec['theme'], 'chart.theme');
    allowed(theme, ['background', 'foreground', 'grid'], 'chart.theme');
    for (const [key, value] of Object.entries(theme)) color(value, `chart.theme.${key}`);
  }
  return input as ChartSpec;
}
