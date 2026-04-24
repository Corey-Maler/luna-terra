export type TracingSnapshot = ReadonlyMap<string, number>;

const MAX_HISTORY = 120;

/**
 * Per-instance tracing store. Each `LunaTerraEngine` owns one so that
 * multiple canvases on the same page don't pollute each other's data.
 */
export class TracingInstance {
  private readonly _stats = new Map<string, number>();
  private readonly _history: TracingSnapshot[] = [];

  perf(tag: string, deltaMS: number): void {
    this._stats.set(tag, deltaMS);
  }

  getStats(): ReadonlyMap<string, number> {
    return this._stats;
  }

  /** Push a copy of current stats into the ring buffer (max 120 entries). */
  snapshot(): void {
    if (this._history.length >= MAX_HISTORY) {
      this._history.shift();
    }
    this._history.push(new Map(this._stats));
  }

  /** Returns the ring buffer oldest → newest. */
  getHistory(): readonly TracingSnapshot[] {
    return this._history;
  }

  clearHistory(): void {
    this._history.length = 0;
  }
}

// ── Legacy global singleton (kept for backwards compat) ──────────────────

const _global = new TracingInstance();

export function tracing(): string {
  return 'tracing';
}

tracing.perf       = (tag: string, deltaMS: number) => _global.perf(tag, deltaMS);
tracing.getStats   = ()                             => _global.getStats();
tracing.snapshot   = ()                             => _global.snapshot();
tracing.getHistory = ()                             => _global.getHistory();
tracing.clearHistory = ()                           => _global.clearHistory();

