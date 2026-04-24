import { V2 } from '@lunaterra/math';
import { Color } from '@lunaterra/color';
import { LineSeries, StackedAreaSeries } from '@lunaterra/charts';
import type { LunaTerraEngine } from '@lunaterra/core';
import { CanvasRenderer, LTElement, ScreenContainer } from '@lunaterra/core';
import { Panel } from './Panel';

export type FpsPanelMode = 'number' | 'minimal' | 'detailed';

export interface FpsPanelOptions {
  /** Initial display mode (default: 'number'). */
  mode?: FpsPanelMode;
  /** Screen-space anchor corner (default: 'top-left'). */
  anchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Offset from anchor corner in CSS px (default: 8). */
  offsetX?: number;
  offsetY?: number;
}

// ── Colors ────────────────────────────────────────────────────────────────
const FPS_LINE_COLOR = new Color(52, 211, 153);   // bright teal-green
const FPS_FILL_OPACITY = 0.22;
const REF_LINE_COLOR = 'rgba(255,255,255,0.15)';
const REF_TEXT_COLOR = 'rgba(255,255,255,0.42)';

/** Reference FPS thresholds drawn as dashed guide lines. */
const REF_LINES: Array<{ fps: number; label: string }> = [
  { fps: 60, label: '60' },
  { fps: 30, label: '30' },
];

const TRACE_COLORS: Record<string, string> = {
  render:      '#ff7c43',
  children:    '#4a9eff',
  attractors:  '#a78bfa',
  renderCycle: '#34d399',
};
const TRACE_DEFAULT_COLOR = '#94a3b8';

// ── Panel dimensions (CSS px) per mode ─────────────────────────────────────
const SIZES: Record<FpsPanelMode, { w: number; h: number }> = {
  number:   { w: 92,  h: 30 },
  minimal:  { w: 200, h: 88 },
  detailed: { w: 240, h: 160 },
};

const FPS_MAX = 120;
const HISTORY_LEN = 120;
const PAD = 8;
const TEXT_H = 14; // px, font size for fps label

/**
 * FpsPanel — a self-contained FPS / tracing overlay that renders inside a
 * `ScreenContainer` pinned to a corner of the canvas.
 *
 * Add it to an engine, then call `setEnabled(true)` to show it.
 * Click on the panel to cycle between modes: number → minimal → detailed.
 *
 * The engine's `fpsPanel` property is automatically set during `setup()`.
 */
export class FpsPanel extends LTElement<FpsPanelOptions> {
  private _mode: FpsPanelMode;
  private _enabled = false;
  private _fpsHistory: number[] = [];

  // Chart children (created in setup, updated every frame)
  private _container!: ScreenContainer;
  private _panel!: Panel;
  private _fpsLine!: LineSeries;
  private _stackedArea!: StackedAreaSeries;

  private _engineRef?: LunaTerraEngine;
  private _cleanupClick?: () => void;

  protected defaultOptions(): FpsPanelOptions {
    return {};
  }

  constructor(options: Partial<FpsPanelOptions> = {}) {
    super(options);
    this._mode = options.mode ?? 'number';
  }

  get isEnabled(): boolean { return this._enabled; }

  setEnabled(v: boolean): void {
    if (this._enabled === v) return;
    this._enabled = v;
    if (!v) {
      this._mode = 'number';
      this._fpsHistory = [];
    }
    this._engineRef?.requestUpdate();
  }

  private _nextMode(): void {
    const order: FpsPanelMode[] = ['number', 'minimal', 'detailed'];
    const idx = order.indexOf(this._mode);
    this._mode = order[(idx + 1) % order.length];
    this._engineRef?.requestUpdate();
  }

  override setup(engine: LunaTerraEngine): void {
    super.setup(engine);
    this._engineRef = engine;

    // Register on the engine so the docs header toggle can reach it.
    engine.fpsPanel = this;

    const { anchor = 'top-left', offsetX = 8, offsetY = 8 } = this.options;
    const { w, h } = SIZES['detailed']; // max size — container resizes via options

    this._container = new ScreenContainer({
      anchor, offsetX, offsetY,
      width: w, height: h,
      // worldBounds defaults to CSS-px space (0,0)→(w,h)
    });

    this._panel = new Panel({
      x: 0, y: 0,
      width: w, height: h,
    });

    this._fpsLine = new LineSeries({
      data: [],
      lineWidth: 1.5,
      fillOpacity: FPS_FILL_OPACITY,
      yFillTo: 0,
    });
    // Explicit bright color — avoids the dark default (Color(74,158,255)) on dark panel.
    this._fpsLine.styles.color = FPS_LINE_COLOR;

    this._stackedArea = new StackedAreaSeries({
      layers: [],
      yBase: 0,
      lineWidth: 1,
      fillOpacity: 0.65,
    });
    // Hidden until detailed mode is active.
    this._fpsLine.visibility = false;
    this._stackedArea.visibility = false;

    this._container.appendChild(this._panel);
    this._container.appendChild(this._stackedArea);
    this._container.appendChild(this._fpsLine);

    // Setup child tree properly (ScreenContainer needs its own setup)
    this._container.setup(engine);

    // Register click handler
    const canvas = engine.renderer.canvas;
    const onClick = (e: MouseEvent) => {
      if (!this._enabled) return;
      const rect = canvas.getBoundingClientRect();
      const hdpi = engine.renderer.hdpi;
      // getBoundingClientRect is in CSS px; canvas.width/height is in physical px
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX / hdpi;
      const cy = (e.clientY - rect.top) * scaleY / hdpi;

      const sr = this._container.getScreenRect(engine.renderer);
      if (cx >= sr.x && cx <= sr.x + sr.w && cy >= sr.y && cy <= sr.y + sr.h) {
        this._nextMode();
      }
    };
    canvas.addEventListener('click', onClick);
    this._cleanupClick = () => canvas.removeEventListener('click', onClick);
  }

  override destroy(): void {
    this._cleanupClick?.();
    if (this._engineRef?.fpsPanel === this) {
      this._engineRef.fpsPanel = undefined;
    }
  }

  override doUpdate(dt: number, renderer: CanvasRenderer): void {
    if (!this._enabled) return;

    const fps = dt > 0 ? Math.round(1000 / dt) : 0;
    if (this._fpsHistory.length >= HISTORY_LEN) this._fpsHistory.shift();
    this._fpsHistory.push(fps);

    this._updateContainerSize();
    this._updateChartData();

    this._container.doUpdate(dt, renderer);
  }

  private _updateContainerSize(): void {
    const { w, h } = SIZES[this._mode];
    this._container.options = { ...this._container.options, width: w, height: h };
    this._panel.options = { ...this._panel.options, width: w, height: h };
  }

  private _updateChartData(): void {
    const showChart = this._mode !== 'number';
    this._fpsLine.visibility = showChart;
    const showStacked = this._mode === 'detailed';
    this._stackedArea.visibility = showStacked;

    if (!showChart) return;

    const { w, h } = SIZES[this._mode];
    const chartX = PAD;
    const chartY = PAD + TEXT_H + 4;
    const chartW = w - PAD * 2;
    const chartH = h - PAD * 2 - TEXT_H - 4;

    // FPS line: y=chartY is FPS_MAX, y=chartY+chartH is 0
    const fpsData = this._fpsHistory.map((fps, i) => ({
      x: chartX + (i / (HISTORY_LEN - 1)) * chartW,
      y: chartY + chartH - (fps / FPS_MAX) * chartH,
    }));
    this._fpsLine.options = {
      ...this._fpsLine.options,
      data: fpsData,
      yFillTo: chartY + chartH,
    };

    if (showStacked) {
      const history = this._engineRef.tracing.getHistory();
      const len = history.length;
      if (len < 2) {
        this._stackedArea.options = { ...this._stackedArea.options, layers: [] };
        return;
      }

      const tagSet = new Set<string>();
      for (const snap of history) {
        for (const key of snap.keys()) tagSet.add(key);
      }
      const tags = Array.from(tagSet);
      const MS_MAX = 33;

      // Trim tracing history to match _fpsHistory length so both charts stay
      // in sync during the warm-up period (tracing fills up before _fpsHistory).
      const effectiveLen = this._fpsHistory.length;
      const trimmedHistory = history.slice(history.length - effectiveLen);

      // Each layer's y values are delta-ms relative to chartH.
      // yBase = chartY = bottom of chart area in Y-up space; stack grows upward.
      const layers = tags.map((tag) => ({
        color: TRACE_COLORS[tag] ?? TRACE_DEFAULT_COLOR,
        data: trimmedHistory.map((snap, i) => ({
          x: chartX + (i / (HISTORY_LEN - 1)) * chartW,
          y: ((snap.get(tag) ?? 0) / MS_MAX) * chartH,
        })),
      }));

      this._stackedArea.options = {
        ...this._stackedArea.options,
        layers,
        yBase: chartY,
      };
    }
  }

  override doRender(renderer: CanvasRenderer): void {
    if (!this._enabled) return;
    this._container.doRender(renderer);
    this._drawOverlay(renderer);
  }

  /**
   * Draws FPS label + reference guide lines on top of the chart,
   * in the container's CSS-px coordinate space.
   */
  private _drawOverlay(renderer: CanvasRenderer): void {
    const mode = this._mode;
    const { w, h } = SIZES[mode];
    const sr = this._container.getScreenRect(renderer);
    const bounds = this._container.options.worldBounds ??
      { xMin: 0, yMin: 0, xMax: w, yMax: h };
    const m = CanvasRenderer.makeScreenMatrix(sr.x, sr.y, sr.w, sr.h, bounds, renderer.hdpi);

    renderer.pushScreenTransform(m);

    // ── FPS label ──────────────────────────────────────────────────────────
    const isAnimating = this._engineRef?.isAnimating ?? false;
    const latestFps = this._fpsHistory.at(-1) ?? 0;
    const fpsColor = latestFps >= 55 ? '#34d399' : latestFps >= 30 ? '#fbbf24' : '#f87171';
    const modeIcon = '▾';
    const label = isAnimating ? `${latestFps} fps ${modeIcon}` : `PAUSED ${modeIcon}`;
    const textColor = isAnimating ? fpsColor : '#94a3b8';

    const b = renderer.batch(textColor, 1);
    b.fillText(label, new V2(PAD, PAD + TEXT_H), textColor, TEXT_H, 'left', 'top');

    // ── Reference lines (minimal + detailed) ──────────────────────────────
    if (mode !== 'number') {
      const chartX = PAD;
      const chartY = PAD + TEXT_H + 4;
      const chartW = w - PAD * 2;
      const chartH = h - PAD * 2 - TEXT_H - 4;

      for (const ref of REF_LINES) {
        const y = chartY + chartH - (ref.fps / FPS_MAX) * chartH;
        const br = renderer.batch(REF_LINE_COLOR, 1);
        br.ctx2d.save();
        br.ctx2d.setLineDash([3, 4]);
        br.moveTo(new V2(chartX, y));
        br.lineTo(new V2(chartX + chartW, y));
        br.stroke();
        br.ctx2d.setLineDash([]);
        br.ctx2d.restore();

        if (chartH > 30) {
          const bt = renderer.batch(REF_TEXT_COLOR, 1);
          // Right-align inside chart to avoid spilling past the panel edge.
          bt.fillText(ref.label, new V2(chartX + chartW - 2, y), REF_TEXT_COLOR, 9, 'right', 'middle');
        }
      }

      // ── Min / max callouts at chart edges (minimal mode) ─────────────────
      if (mode === 'minimal' && this._fpsHistory.length > 1) {
        const minFps = Math.min(...this._fpsHistory);
        const maxFps = Math.max(...this._fpsHistory);
        const bt = renderer.batch(REF_TEXT_COLOR, 1);
        bt.fillText(`↑${maxFps}`, new V2(chartX, chartY - 1), REF_TEXT_COLOR, 9, 'left', 'bottom');
        bt.fillText(`↓${minFps}`, new V2(chartX, chartY + chartH + 1), REF_TEXT_COLOR, 9, 'left', 'top');
      }
    }

    renderer.popScreenTransform();
  }
}
