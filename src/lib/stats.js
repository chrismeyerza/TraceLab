// Numerical helpers used everywhere. Pure functions, no React.

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export const stdev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
};

export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const max = (arr) => (arr.length ? Math.max(...arr) : 0);
export const min = (arr) => (arr.length ? Math.min(...arr) : 0);

/**
 * Summarize an array of shots over a numeric field.
 * Returns null if no values present.
 */
export function summarize(shots, field) {
  const vals = shots.map((s) => s[field]).filter((v) => v != null && !isNaN(v));
  if (!vals.length) return null;
  return {
    mean: mean(vals),
    median: median(vals),
    stdev: stdev(vals),
    min: min(vals),
    max: max(vals),
    n: vals.length,
  };
}
