import { mean, stdev, median } from './stats';

/**
 * Trends — the analytical engine behind the Trends view.
 *
 * Three primary jobs:
 *   1. Group a shot collection into sessions, then compute per-session
 *      medians of each metric for a chosen club.
 *   2. Compute a baseline (all-time mean and standard deviation per metric)
 *      across all that club's shots.
 *   3. Compute a simple linear regression slope per metric across session
 *      medians (the drift signal).
 *
 * Why session medians and not raw shots? Because asking "how am I trending
 * over time" is a question about session-level performance, not shot-level.
 * Raw shots within a session bounce around; the session median is what
 * "today's performance" really means. The trend chart plots session medians
 * over time, one dot per session.
 *
 * Median (not mean) for the per-session aggregation because sessions are
 * small samples (often <20 shots) and a single mishit shouldn't move the
 * dot dramatically. For the all-time baseline, we use mean ± σ — those are
 * the natural Gaussian parameters that match how the distribution visual
 * is drawn.
 */

/**
 * The metrics the Trends view surfaces. Order matters — this is the order
 * they appear in the UI grid. Format string is for display formatting only.
 * `field` is the property name on a shot record.
 *
 * Units are mostly raw (mph, yds, mm, etc) — the Trends view does no unit
 * conversion since (a) all the source data is already in the user's
 * preferred units via the parser, and (b) trends-over-time work on whatever
 * the unit is.
 *
 * Actually, looking at the data model: ballSpeed/clubSpeed are mph,
 * carry/total are yards (imperial), faceImpactH/V are mm, etc. The chart
 * just plots numbers — the unit label comes from this definition.
 */
export const TREND_METRICS = [
  { key: 'clubSpeed',     label: 'CLUB SPEED',     unit: 'mph',  decimals: 1 },
  { key: 'ballSpeed',     label: 'BALL SPEED',     unit: 'mph',  decimals: 1 },
  { key: 'efficiency',    label: 'SMASH FACTOR',   unit: '',     decimals: 3 },
  { key: 'carry',         label: 'CARRY',          unit: 'yds',  decimals: 1 },
  { key: 'angleOfAttack', label: 'ATTACK ANGLE',   unit: '°',    decimals: 1 },
  { key: 'clubPath',      label: 'CLUB PATH',      unit: '°',    decimals: 1 },
  { key: 'faceToPath',    label: 'FACE TO PATH',   unit: '°',    decimals: 1 },
  { key: 'backSpin',      label: 'SPIN RATE',      unit: 'rpm',  decimals: 0 },
  { key: 'peakHeight',    label: 'PEAK HEIGHT',    unit: 'ft',   decimals: 1 },
];

/**
 * Group shots by session, returning [{ sessionId, label, date, shots[] }]
 * sorted by date ascending (oldest first — chronological reads left to
 * right on the trend chart).
 *
 * Sessions where we can't determine a date fall to the end (and get a
 * synthetic timestamp), but should be rare — the parser stamps every shot
 * with createdAt.
 */
export function groupBySession(shots) {
  const map = new Map();
  for (const s of shots || []) {
    const id = s.sessionId || '__nosession__';
    if (!map.has(id)) {
      map.set(id, {
        sessionId: id,
        // Use the earliest shot's createdAt as the session date — sessions
        // are short enough that the first shot's time is a fine proxy.
        date: s.createdAt || 0,
        shots: [],
      });
    }
    const sess = map.get(id);
    sess.shots.push(s);
    // Update earliest date as we see shots
    if (s.createdAt && s.createdAt < sess.date) sess.date = s.createdAt;
  }
  const result = [...map.values()];
  result.sort((a, b) => (a.date || 0) - (b.date || 0));
  return result;
}

/**
 * For one club and one metric, compute the session-by-session median series.
 * Returns [{ sessionId, date, value, n }] where:
 *   - date is the session's date (ms since epoch)
 *   - value is the median of the metric within that session
 *   - n is the number of shots in the session for this metric (after
 *     filtering nulls)
 *
 * Sessions with no valid values for the metric are excluded entirely (a
 * dot for "no data" would be misleading). Sessions with only 1-2 shots
 * are included with their `n` flagged — the UI uses this to draw them
 * faded so the user sees "this is a thin point."
 */
export function sessionSeries(sessionGroups, club, metricKey) {
  const out = [];
  for (const sess of sessionGroups) {
    const clubShots = sess.shots.filter((s) => s.club === club);
    const vals = clubShots
      .map((s) => s[metricKey])
      .filter((v) => v != null && !isNaN(v) && isFinite(v));
    if (!vals.length) continue;
    out.push({
      sessionId: sess.sessionId,
      date: sess.date,
      value: median(vals),
      n: vals.length,
    });
  }
  return out;
}

/**
 * Simple linear regression on (x, y) pairs. Returns { slope, intercept,
 * r2 } or null if input has <2 points. Used to draw the trend line over
 * the session-medians series so the user can see direction at a glance.
 *
 * The regression is in raw "value over date" space — slope's unit is
 * "metric per millisecond", which is unhelpful for direct display. The UI
 * surfaces the direction (up / down / flat) and a normalised "drift over
 * 90 days" value derived from slope.
 */
export function linearRegression(points) {
  if (!points || points.length < 2) return null;
  const xs = points.map((p) => p.date);
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const xMean = mean(xs);
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  if (den === 0) return null; // all x identical — no meaningful slope
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  // r² for "how much of the variance does the line explain"
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yHat = slope * xs[i] + intercept;
    ssRes += (ys[i] - yHat) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/**
 * Baseline for one metric across a club's shots: mean ± σ over the entire
 * raw shot population (not session medians). Returns null for empty input.
 *
 * Using raw shots, not session medians, because the baseline question is
 * "what's my typical 7i club speed across every shot I've ever hit?" —
 * which is a population statistic. The trend chart uses session medians
 * for a different reason (smoothing the within-session noise).
 */
export function metricBaseline(shots, club, metricKey) {
  const clubShots = (shots || []).filter((s) => s.club === club);
  const vals = clubShots
    .map((s) => s[metricKey])
    .filter((v) => v != null && !isNaN(v) && isFinite(v));
  if (!vals.length) return null;
  return {
    mean: mean(vals),
    stdev: stdev(vals),
    median: median(vals),
    n: vals.length,
  };
}

/**
 * Pinned-session value for one metric — median across the pinned session's
 * shots for this club. Returns null if the pinned session has no valid
 * shots for this club + metric.
 */
export function pinnedSessionValue(shots, club, metricKey, pinnedSessionId) {
  if (!pinnedSessionId) return null;
  const clubShots = (shots || []).filter(
    (s) => s.club === club && s.sessionId === pinnedSessionId
  );
  const vals = clubShots
    .map((s) => s[metricKey])
    .filter((v) => v != null && !isNaN(v) && isFinite(v));
  if (!vals.length) return null;
  return {
    value: median(vals),
    n: vals.length,
  };
}

/**
 * Convenience: format a metric value using its `decimals` setting. Returns
 * a string suitable for display.
 */
export function formatMetricValue(value, metric) {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(metric.decimals ?? 1);
}

/**
 * For UI: return the most-hit club in the dataset, so the Trends view can
 * default to a useful selection. Falls back to the first club alphabetically
 * if there's no data.
 */
export function mostHitClub(shots, clubList) {
  if (!clubList || !clubList.length) return null;
  const counts = {};
  for (const s of shots || []) {
    if (!s.club) continue;
    counts[s.club] = (counts[s.club] || 0) + 1;
  }
  let best = clubList[0];
  let bestCount = counts[best] || 0;
  for (const c of clubList) {
    const n = counts[c] || 0;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}
