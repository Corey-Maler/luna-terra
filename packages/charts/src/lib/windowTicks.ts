export interface WindowTick {
  value: number;
  label: string;
}

export interface WindowTickOptions {
  center: number;
  windowSize: number;
  stepCandidates: readonly number[];
  formatLabel: (value: number, step: number) => string;
  maxTickCount?: number;
  edgeInsetRatio?: number;
}

export function chooseWindowTickStep(
  windowSize: number,
  stepCandidates: readonly number[],
  maxTickCount = 7,
): number {
  for (const step of stepCandidates) {
    if (windowSize / step <= maxTickCount) return step;
  }
  return stepCandidates[stepCandidates.length - 1] ?? 1;
}

export function makeWindowTicks(options: WindowTickOptions): WindowTick[] {
  const {
    center,
    windowSize,
    stepCandidates,
    formatLabel,
    maxTickCount = 7,
    edgeInsetRatio = 0.05,
  } = options;
  const xMin = center - windowSize / 2;
  const xMax = center + windowSize / 2;
  const tickStep = chooseWindowTickStep(windowSize, stepCandidates, maxTickCount);
  const ticks: WindowTick[] = [];

  ticks.push({ value: xMin, label: '' });

  const firstTick = Math.ceil(xMin / tickStep) * tickStep;
  for (let value = firstTick; value <= xMax; value += tickStep) {
    if (value - xMin > tickStep * edgeInsetRatio && xMax - value > tickStep * edgeInsetRatio) {
      ticks.push({ value, label: formatLabel(value, tickStep) });
    }
  }

  ticks.push({ value: xMax, label: '' });
  return ticks;
}