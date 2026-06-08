// Lightweight debug counters — no-ops in production builds.
// Replace with a real debug panel if needed.

export const incDebugValue = (_name: string, _delta = 1): void => {
  // no-op
};

export const printDebugValue = (_name: string, _value: number | string): void => {
  // no-op
};
