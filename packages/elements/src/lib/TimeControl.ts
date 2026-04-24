/**
 * TimeControl — a reusable canvas-rendered time scrubber / playback control.
 *
 * Renders entirely in screen space via `batchScreenSpace()` and handles its
 * own click/drag interaction through hit regions on the canvas — same pattern
 * as ZoomControls in @lunaterra/core.
 *
 * Usage:
 * ```ts
 * const tc = new TimeControl({
 *   startDate: new Date('2025-01-01'),
 *   endDate:   new Date('2027-01-01'),
 *   onChange:  (date) => scene.date = date,
 * });
 * engine.add(tc);
 * ```
 */

import { V2 } from '@lunaterra/math';
import { LTElement } from '@lunaterra/core';
import type { CanvasRenderer } from '@lunaterra/core';
import type { LunaTerraEngine } from '@lunaterra/core';

// ── Options ──────────────────────────────────────────────────────────────────

export interface TimeControlOptions {
  /** Left end of scrubber range. */
  startDate: Date;
  /** Right end of scrubber range. */
  endDate: Date;
  /** Starting date (default: midpoint of range). */
  initialDate?: Date;
  /** Playback speed multipliers.  Default: [1000, 10_000, 100_000, 500_000]. */
  speeds?: number[];
  /** Human-friendly labels for each speed. Auto-generated if omitted. */
  speedLabels?: string[];
  /** Distance from the bottom of the canvas in CSS px (default 20). */
  bottom?: number;
  /** Horizontal padding in CSS px (default 24). */
  padding?: number;
  /** Custom date formatter.  Default: locale date string. */
  formatDate?: (d: Date) => string;
  /** Fires when the date changes (playback or scrub). */
  onChange?: (date: Date) => void;
  /** Fires when play/pause toggles. */
  onPlayingChange?: (playing: boolean) => void;
  /** Accent colour (updated by host for theme changes). */
  accentColor?: string;
  /** Background tint for the control bar. */
  bgColor?: string;
}

// ── Layout constants (CSS px, scaled by HDPI at render time) ─────────────────

const BAR_H = 32;     // bar height
const BTN_W = 28;     // play button width
const SPEED_W = 56;   // speed label width
const GAP = 6;
const THUMB_R = 6;    // scrubber thumb radius
const TRACK_H = 2;    // scrubber track thickness
const DATE_FONT = 10;
const LABEL_FONT = 11;

// ── Component ────────────────────────────────────────────────────────────────

export class TimeControl extends LTElement<TimeControlOptions> {
  // ── State ────────────────────────────────────────────────────────────────
  private _date!: Date;
  private _playing = false;
  private _speedIndex = 1; // default to second speed option
  private _dragging = false;

  // ── Hit regions (physical px, updated every render) ────────────────────
  private _hitPlay = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private _hitSpeed = { x1: 0, y1: 0, x2: 0, y2: 0 };
  private _hitTrack = { x1: 0, y1: 0, x2: 0, y2: 0 };

  // ── Listeners ──────────────────────────────────────────────────────────
  private _cleanups: (() => void)[] = [];


  // ── Public API ─────────────────────────────────────────────────────────

  get date(): Date {
    return this._date;
  }

  set date(d: Date) {
    const opts = this.options;
    const clamped = new Date(
      Math.max(opts.startDate.getTime(), Math.min(opts.endDate.getTime(), d.getTime())),
    );
    this._date = clamped;
  }

  get playing(): boolean {
    return this._playing;
  }

  setPlaying(v: boolean) {
    if (v === this._playing) return;
    this._playing = v;
    this.options.onPlayingChange?.(v);
    if (v) {
      this._engine?.requestContinuousLoop();
    } else {
      this._engine?.releaseContinuousLoop();
    }
    this._engine?.requestUpdate();
  }

  get speed(): number {
    return this._speeds()[this._speedIndex];
  }

  cycleSpeed() {
    const speeds = this._speeds();
    this._speedIndex = (this._speedIndex + 1) % speeds.length;
    this._engine?.requestUpdate();
  }

  /** Accent colour — call when theme changes. */
  public accentColor = '#3c2a1a';
  /** Background tint — call when theme changes. */
  public bgColor = 'rgba(243,243,243,0.75)';

  // ── Internals ──────────────────────────────────────────────────────────

  protected override defaultOptions(): TimeControlOptions {
    const now = new Date();
    const sixMonths = 183 * 86_400_000;
    return {
      startDate: new Date(now.getTime() - sixMonths),
      endDate: new Date(now.getTime() + sixMonths),
      initialDate: now,
      speeds: [1_000, 10_000, 100_000, 500_000],
      bottom: 20,
      padding: 24,
      formatDate: (d: Date) => d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
  }

  private _speeds(): number[] {
    return this.options.speeds ?? [1_000, 10_000, 100_000, 500_000];
  }

  private _speedLabel(): string {
    if (this.options.speedLabels?.[this._speedIndex]) {
      return this.options.speedLabels[this._speedIndex];
    }
    const s = this._speeds()[this._speedIndex];
    if (s >= 1_000_000) return `×${(s / 1_000_000).toFixed(0)}M`;
    if (s >= 1_000) return `×${(s / 1_000).toFixed(0)}k`;
    return `×${s}`;
  }

  private _formatDate(d: Date): string {
    return (this.options.formatDate ?? ((dd: Date) => dd.toLocaleDateString()))(d);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  override setup(engine: LunaTerraEngine) {
    super.setup(engine);
    this._date = this.options.initialDate ?? new Date();

    if (this.options.accentColor) this.accentColor = this.options.accentColor;
    if (this.options.bgColor) this.bgColor = this.options.bgColor;

    const canvas = engine.renderer.canvas;

    // ── Click handler (play/pause, speed) ────────────────────────────────
    const onClick = (e: MouseEvent) => {
      const p = this._eventToPhysical(e, canvas);
      if (!p) return;

      if (hit(p, this._hitPlay)) {
        this.setPlaying(!this._playing);
      } else if (hit(p, this._hitSpeed)) {
        this.cycleSpeed();
      }
    };

    // ── Drag handler (scrubber) ──────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const p = this._eventToPhysical(e, canvas);
      if (!p) return;
      if (hit(p, this._hitTrack)) {
        this._dragging = true;
        this._scrubTo(p.x);
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this._dragging) return;
      const p = this._eventToPhysical(e, canvas);
      if (p) this._scrubTo(p.x);
    };

    const onMouseUp = () => {
      this._dragging = false;
    };

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const p = this._touchToPhysical(t, canvas);
      if (hit(p, this._hitTrack)) {
        this._dragging = true;
        this._scrubTo(p.x);
        e.preventDefault();
      } else if (hit(p, this._hitPlay)) {
        this.setPlaying(!this._playing);
        e.preventDefault();
      } else if (hit(p, this._hitSpeed)) {
        this.cycleSpeed();
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!this._dragging) return;
      const t = e.touches[0];
      if (!t) return;
      const p = this._touchToPhysical(t, canvas);
      this._scrubTo(p.x);
      e.preventDefault();
    };

    const onTouchEnd = () => {
      this._dragging = false;
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    this._cleanups = [
      () => canvas.removeEventListener('click', onClick),
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => canvas.removeEventListener('touchstart', onTouchStart),
      () => canvas.removeEventListener('touchmove', onTouchMove),
      () => canvas.removeEventListener('touchend', onTouchEnd),
    ];
  }

  override update(dt: number) {
    if (this._playing) {
      const ms = dt * this.speed;
      const next = new Date(this._date.getTime() + ms);
      const opts = this.options;
      if (next.getTime() >= opts.endDate.getTime()) {
        this._date = new Date(opts.endDate.getTime());
        this.setPlaying(false);
      } else if (next.getTime() <= opts.startDate.getTime()) {
        this._date = new Date(opts.startDate.getTime());
        this.setPlaying(false);
      } else {
        this._date = next;
      }
      this.options.onChange?.(this._date);
    }
  }

  override render(renderer: CanvasRenderer) {
    const opts = this.options;
    const hdpi = window.devicePixelRatio || 1;
    const canvasW = renderer.width;  // physical px
    const canvasH = renderer.height;

    const padPx = (opts.padding ?? 24) * hdpi;
    const bottomPx = (opts.bottom ?? 20) * hdpi;
    const barH = BAR_H * hdpi;
    const btnW = BTN_W * hdpi;
    const speedW = SPEED_W * hdpi;
    const gapPx = GAP * hdpi;
    const thumbR = THUMB_R * hdpi;
    const trackH = TRACK_H * hdpi;

    // Bar geometry
    const barY = canvasH - bottomPx - barH;
    const barX = padPx;
    const barW = canvasW - padPx * 2;

    if (barW < 100 * hdpi) return; // too narrow

    // ── Background pill ──────────────────────────────────────────────────
    const bg = renderer.batchScreenSpace(this.bgColor);
    const r = 8 * hdpi;
    _roundRect(bg, barX, barY, barW, barH, r);
    bg.fill();

    // ── Play/Pause button ────────────────────────────────────────────────
    let x = barX + gapPx;
    this._hitPlay = { x1: x, y1: barY, x2: x + btnW, y2: barY + barH };

    const midY = barY + barH / 2;
    const iconBatch = renderer.batchScreenSpace(this.accentColor);

    if (this._playing) {
      // Pause icon: two vertical bars
      const bw = 3 * hdpi;
      const bh = 10 * hdpi;
      iconBatch.moveTo(new V2(x + btnW / 2 - bw - 1.5 * hdpi, midY - bh / 2));
      iconBatch.lineTo(new V2(x + btnW / 2 - bw - 1.5 * hdpi, midY + bh / 2));
      iconBatch.moveTo(new V2(x + btnW / 2 + 1.5 * hdpi, midY - bh / 2));
      iconBatch.lineTo(new V2(x + btnW / 2 + 1.5 * hdpi, midY + bh / 2));
      iconBatch.renew(this.accentColor, bw);
      iconBatch.stroke();
    } else {
      // Play icon: triangle
      const sz = 6 * hdpi;
      iconBatch.moveTo(new V2(x + btnW / 2 - sz * 0.5, midY - sz));
      iconBatch.lineTo(new V2(x + btnW / 2 + sz, midY));
      iconBatch.lineTo(new V2(x + btnW / 2 - sz * 0.5, midY + sz));
      iconBatch.fill();
    }

    x += btnW;

    // ── Speed label ──────────────────────────────────────────────────────
    this._hitSpeed = { x1: x, y1: barY, x2: x + speedW, y2: barY + barH };
    const speedStr = this._speedLabel();
    renderer.batchScreenSpace(this.accentColor).renderText(
      speedStr,
      new V2(x + speedW / 2 - (speedStr.length * 3.2 * hdpi), midY + LABEL_FONT * hdpi * 0.35),
      LABEL_FONT,
    );
    x += speedW;

    // ── Scrubber track ───────────────────────────────────────────────────
    const trackX = x + gapPx;
    const trackEndX = barX + barW - gapPx - padPx;
    const trackW = trackEndX - trackX;
    const trackY = midY;

    this._hitTrack = {
      x1: trackX - thumbR,
      y1: barY,
      x2: trackEndX + thumbR,
      y2: barY + barH,
    };

    // Track line
    const trackBatch = renderer.batchScreenSpace(this.accentColor, trackH);
    trackBatch.moveTo(new V2(trackX, trackY));
    trackBatch.lineTo(new V2(trackEndX, trackY));
    trackBatch.renew(this.accentColor, trackH, {});
    renderer.ctx.globalAlpha = 0.25;
    trackBatch.stroke();
    renderer.ctx.globalAlpha = 1;

    // Thumb position
    const range = opts.endDate.getTime() - opts.startDate.getTime();
    const progress = range > 0
      ? (this._date.getTime() - opts.startDate.getTime()) / range
      : 0;
    const thumbX = trackX + progress * trackW;

    // Filled progress line
    if (progress > 0.001) {
      const progBatch = renderer.batchScreenSpace(this.accentColor, trackH);
      progBatch.moveTo(new V2(trackX, trackY));
      progBatch.lineTo(new V2(thumbX, trackY));
      renderer.ctx.globalAlpha = 0.5;
      progBatch.stroke();
      renderer.ctx.globalAlpha = 1;
    }

    // Thumb circle
    const ctx = renderer.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.arc(thumbX, trackY, thumbR, 0, Math.PI * 2);
    ctx.fillStyle = this.accentColor;
    ctx.fill();
    ctx.restore();

    // ── Date label ───────────────────────────────────────────────────────
    const dateStr = this._formatDate(this._date);
    const dateFontPx = DATE_FONT;
    renderer.batchScreenSpace(this.accentColor).renderText(
      dateStr,
      new V2(trackEndX + gapPx, midY + dateFontPx * hdpi * 0.35),
      dateFontPx,
    );
  }

  override destroy() {
    for (const fn of this._cleanups) fn();
    this._cleanups = [];
    if (this._playing) {
      this._engine?.releaseContinuousLoop();
    }
    this._engine = undefined;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private _eventToPhysical(e: MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const hdpi = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * hdpi,
      y: (e.clientY - rect.top) * hdpi,
    };
  }

  private _touchToPhysical(t: Touch, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const hdpi = window.devicePixelRatio || 1;
    return {
      x: (t.clientX - rect.left) * hdpi,
      y: (t.clientY - rect.top) * hdpi,
    };
  }

  private _scrubTo(physicalX: number) {
    const track = this._hitTrack;
    const trackX = track.x1 + (THUMB_R * (window.devicePixelRatio || 1));
    const trackEndX = track.x2 - (THUMB_R * (window.devicePixelRatio || 1));
    const trackW = trackEndX - trackX;
    if (trackW <= 0) return;

    const t = Math.max(0, Math.min(1, (physicalX - trackX) / trackW));
    const opts = this.options;
    const ms = opts.startDate.getTime() + t * (opts.endDate.getTime() - opts.startDate.getTime());
    this._date = new Date(ms);
    this.options.onChange?.(this._date);
    this._engine?.requestUpdate();
  }
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

import type { Batch } from '@lunaterra/core';

function _roundRect(
  b: Batch,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  b.moveTo(new V2(x + r, y));
  b.lineTo(new V2(x + w - r, y));
  b.arcTo(new V2(x + w, y), new V2(x + w, y + r), r);
  b.lineTo(new V2(x + w, y + h - r));
  b.arcTo(new V2(x + w, y + h), new V2(x + w - r, y + h), r);
  b.lineTo(new V2(x + r, y + h));
  b.arcTo(new V2(x, y + h), new V2(x, y + h - r), r);
  b.lineTo(new V2(x, y + r));
  b.arcTo(new V2(x, y), new V2(x + r, y), r);
}

function hit(
  p: { x: number; y: number },
  r: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}
