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

/**
 * 10% trimmed mean: drop the top and bottom 10% of values (by Math.floor of
 * 0.1 × n), then average the rest. With fewer than 10 values, floor(0.1*n)
 * rounds to 0 — so this safely degrades to ordinary mean for small samples
 * (where outliers aren't really a meaningful concept anyway).
 *
 * Used as the "typical shot" centre in Flight gauges and per-club summaries.
 * Outlier-robust without losing data the way a median does (which uses only
 * the middle value or two).
 */
export const trimmedMean = (arr, fraction = 0.1) => {
  if (!arr.length) return 0;
  if (arr.length < 5) return mean(arr); // not enough data to trim meaningfully
  const sorted = [...arr].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * fraction);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  return mean(trimmed);
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
    trimmedMean: trimmedMean(vals),
    median: median(vals),
    stdev: stdev(vals),
    min: min(vals),
    max: max(vals),
    n: vals.length,
  };
}
