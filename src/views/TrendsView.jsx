import { useMemo, useState, useEffect } from 'react';
import {
  TREND_METRICS,
  groupBySession,
  sessionSeries,
  linearRegression,
  movingAverage,
  metricBaseline,
  pinnedSessionValue,
  mostHitClub,
  formatMetricValue,
  valueHistogram,
} from '../lib/trends';
import { clubColor } from '../lib/clubs';

/**
 * Trends — per-club performance dashboard.
 *
 * Two sections, both club-scoped via a header picker:
 *
 *   1. TODAY vs BASELINE — only shows if a session is pinned. For each
 *      of nine metrics, displays a card with today's median, the all-
 *      time baseline (mean ± σ), the delta direction, and a small range
 *      visual that places today's value on the all-time distribution.
 *
 *   2. DRIFT OVER TIME — always shows when ≥3 sessions exist for the
 *      chosen club. A 2-column grid of mini line charts, one per metric.
 *      Each chart shows session medians as dots, ordered left to right
 *      by date, with a linear regression line drawn through them.
 *
 * Default scope: Full-only shots (driven by the parent's filter). If the
 * user widens the TYPES filter to include partials, this view's data
 * widens with it — but baselines mixing partials and fulls would be
 * misleading, so the design relies on the user respecting the default.
 *
 * Empty states:
 *   - No club selected (or no shots at all) → an "import some shots"
 *     message
 *   - <3 sessions for the chosen club → trend charts hidden with a note
 *     "Need at least 3 sessions of <club> to show drift"
 *   - No pinned session → "Today vs baseline" section says "Pin a
 *     session to compare it to your baseline"
 */
export default function TrendsView({ shots, allShots, allClubs, units, pinnedSession }) {
  // `shots` is the user-filtered set (respects the current filter bar).
  // `allShots` is the user's full shot history regardless of filter — used
  // for the all-time baseline and the drift chart, because those questions
  // ("what's my all-time mean?" and "how have I trended across all sessions?")
  // wouldn't make sense narrowed to a single pinned session. The Today vs
  // Baseline section uses the pinned session for "today" and allShots for
  // the baseline; the drift section uses allShots entirely.

  // Club selection. Defaults to the most-hit club so the view is useful
  // on first land. Stored locally — switching club shouldn't affect any
  // other view's state.
  const [club, setClub] = useState(null);
  useEffect(() => {
    if (!club && allClubs.length) {
      const def = mostHitClub(allShots || shots, allClubs);
      if (def) setClub(def);
    }
    // If the current club no longer exists in allClubs (e.g. filters
    // changed and now-excluded), revert to the most-hit available.
    else if (club && !allClubs.includes(club)) {
      const def = mostHitClub(allShots || shots, allClubs);
      if (def) setClub(def);
    }
  }, [allClubs, allShots, shots, club]);

  // The trend math operates on the FULL shot history, never filtered.
  // Otherwise pinning a session would collapse the drift chart to one
  // session, and baselines would be one-session medians — neither useful.
  // Defensive fallback to `shots` if allShots isn't passed (older caller).
  const sourceShots = allShots && allShots.length ? allShots : shots;

  // Session-by-session series for each metric — computed once per
  // (sourceShots, club) change rather than per-metric to share the grouping work.
  const sessionGroups = useMemo(() => groupBySession(sourceShots), [sourceShots]);

  if (!sourceShots.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
        <p>Import some shots to see trends and per-club fingerprints.</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
        <p>No clubs in the current filter scope.</p>
      </div>
    );
  }

  // Pre-compute per-metric: baseline, pinned-session value, series,
  // moving average (the trend line). Doing it once here makes the render
  // code below straightforward.
  // Baselines: full history (sourceShots). Pinned: only that session's data.
  // Series: full history grouped by session.
  const metricsData = TREND_METRICS.map((m) => {
    const baseline = metricBaseline(sourceShots, club, m.key);
    const pinned = pinnedSession
      ? pinnedSessionValue(sourceShots, club, m.key, pinnedSession.id)
      : null;
    const series = sessionSeries(sessionGroups, club, m.key);
    const trend = movingAverage(series);
    return { metric: m, baseline, pinned, series, trend };
  });

  // Global x-axis range — the union of all session dates that have ANY
  // metric value for this club. All drift charts use this same range so
  // session N's dot is at the same horizontal pixel position across every
  // chart in the grid. That's what makes "scan vertically to correlate
  // metrics in a session" actually work.
  const globalDates = (() => {
    const set = new Set();
    for (const d of metricsData) {
      for (const p of d.series) set.add(p.date);
    }
    return [...set].sort((a, b) => a - b);
  })();
  const globalXMin = globalDates.length ? globalDates[0] : null;
  const globalXMax = globalDates.length ? globalDates[globalDates.length - 1] : null;

  const hasEnoughForTrend = metricsData.some((d) => d.series.length >= 3);

  return (
    <>
      {/* Club picker */}
      <div className="trends-club-picker">
        <span className="filter-label">CLUB</span>
        <div className="chip-row">
          {allClubs.map((c) => (
            <button
              key={c}
              className={`chip ${c === club ? 'active' : ''}`}
              onClick={() => setClub(c)}
              style={c === club ? {
                background: clubColor(c),
                borderColor: clubColor(c),
                color: '#0a0e0c',
              } : { color: clubColor(c) }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: Today vs Baseline */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">01</span>Today vs your baseline
          </div>
          <div className="card-subtitle">
            {pinnedSession
              ? `Pinned session: ${pinnedSession.label}`
              : 'Pin a session (Sessions view) to compare it against your all-time baseline'}
          </div>
        </div>
        {pinnedSession ? (
          <div className="trends-grid">
            {metricsData.map(({ metric, baseline, pinned }) => (
              <FingerprintCard
                key={metric.key}
                metric={metric}
                baseline={baseline}
                pinned={pinned}
              />
            ))}
          </div>
        ) : (
          <div style={{
            padding: 30,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            Open Sessions, click "pin" next to a session, then come back.<br />
            This view will show how that session compares to your all-time {club} averages
            across nine key metrics.
          </div>
        )}
      </div>

      {/* SECTION 2: Drift over time */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">02</span>Drift over time
          </div>
          <div className="card-subtitle">
            Session medians for {club}. Dots = each session, oldest left → newest right. Dashed line = moving average.
          </div>
        </div>
        {hasEnoughForTrend ? (
          <div className="trends-grid">
            {metricsData.map(({ metric, series, trend }) => (
              <DriftChart
                key={metric.key}
                metric={metric}
                series={series}
                trend={trend}
                globalXMin={globalXMin}
                globalXMax={globalXMax}
              />
            ))}
          </div>
        ) : (
          <div style={{
            padding: 30,
            textAlign: 'center',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}>
            Need at least 3 sessions of {club} to show drift.{' '}
            Currently: {Math.max(...metricsData.map((d) => d.series.length))} session(s).
          </div>
        )}
      </div>
    </>
  );
}

/**
 * One metric's "today vs baseline" card. Three pieces of information:
 *   - The big number: today's median for this metric in this session
 *   - The baseline: all-time mean ± σ
 *   - A range bar: shows µ-2σ → µ+2σ horizontally, with a dot at today's
 *     value and a tick at µ. Lets the user see at a glance whether today
 *     is within typical bounds or an outlier.
 *
 * When no data: shows the metric name and a "—". When the baseline is
 * undefined: same. When the pinned session has no shots for this club +
 * metric: shows the baseline but the today line is greyed.
 */
function FingerprintCard({ metric, baseline, pinned }) {
  if (!baseline) {
    return (
      <div className="trend-card">
        <div className="trend-card-label">{metric.label}</div>
        <div className="trend-card-value-row">
          <div className="trend-card-today-value" style={{ color: 'var(--text-faint)' }}>
            —
          </div>
        </div>
        <div className="trend-card-baseline" style={{ color: 'var(--text-faint)' }}>
          No data for this metric
        </div>
      </div>
    );
  }

  const todayVal = pinned?.value ?? null;
  const delta = todayVal != null ? todayVal - baseline.mean : null;
  // "σ above" or "σ below" — only meaningful when σ > 0 (so we don't divide by 0)
  const sigmas = todayVal != null && baseline.stdev > 0
    ? (todayVal - baseline.mean) / baseline.stdev
    : null;

  // Range bar geometry: actual min..max of the player's shots, NOT µ±2σ.
  // ±2σ bounds were confusing in practice — users read the boundary labels
  // as "shots I've actually hit" when they were just statistical limits.
  // Using true min/max means the boundary labels are real shots from the
  // history. The σ context is still visible in the delta annotation.
  const min = baseline.min;
  const max = baseline.max;
  const range = max - min;
  let pct = null;
  let meanPct = null;
  let outOfRange = false;
  if (range > 0) {
    if (todayVal != null) {
      pct = (todayVal - min) / range;
      if (pct < 0 || pct > 1) outOfRange = true;
      pct = Math.max(0, Math.min(1, pct));
    }
    meanPct = (baseline.mean - min) / range;
    meanPct = Math.max(0, Math.min(1, meanPct));
  } else if (todayVal != null) {
    pct = 0.5;
    meanPct = 0.5;
  }

  // Density heatmap. Built from the actual value distribution; null when
  // sample size is too small to be meaningful (<8 shots). Each bin's alpha
  // is proportional to bin_count / max_bin_count.
  const hist = valueHistogram(baseline.values);

  // Delta sign for the colour: green if magnitude is small (within 1σ),
  // amber if 1-2σ, red beyond. Direction (up/down) is shown by the arrow,
  // not the colour — many metrics are "higher is worse" so colouring by
  // sign would be misleading.
  let deltaColor = 'var(--text)';
  if (sigmas != null) {
    const abs = Math.abs(sigmas);
    deltaColor = abs < 1 ? 'var(--text)' : abs < 2 ? 'var(--amber)' : 'var(--red)';
  }

  return (
    <div className="trend-card">
      <div className="trend-card-label">{metric.label}</div>
      <div className="trend-card-value-row">
        {todayVal != null ? (
          <>
            <div className="trend-card-today-value">
              {formatMetricValue(todayVal, metric)}
            </div>
            {metric.unit && (
              <div className="trend-card-unit">{metric.unit}</div>
            )}
            {delta != null && (
              <div className="trend-card-delta" style={{ color: deltaColor }}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(metric.decimals)}
                {sigmas != null && (
                  <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.75 }}>
                    ({Math.abs(sigmas).toFixed(1)}σ)
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="trend-card-today-value" style={{ color: 'var(--text-faint)' }}>
            no shots
          </div>
        )}
      </div>
      <div className="trend-card-baseline">
        all-time {formatMetricValue(baseline.mean, metric)}
        {baseline.stdev > 0 && (
          <> ± {formatMetricValue(baseline.stdev, metric)}</>
        )}
        <span style={{ marginLeft: 4, color: 'var(--text-faint)', fontSize: 9 }}>
          (n={baseline.n})
        </span>
      </div>
      {/* Range bar: actual min..max with density heatmap behind. The heatmap
          bins reflect how often values fall in each region — darker = more
          shots there. The mean tick and today dot overlay the heatmap. */}
      <div className="trend-range-bar">
        <div className="trend-range-track">
          {/* Heatmap bins — only drawn when we have enough data for the
              histogram to be honest (>=8 values per valueHistogram). */}
          {hist && (
            <div className="trend-range-heatmap">
              {(() => {
                const maxCount = Math.max(...hist.bins);
                if (maxCount === 0) return null;
                return hist.bins.map((count, i) => {
                  const alpha = count / maxCount;
                  return (
                    <div
                      key={i}
                      className="trend-range-bin"
                      style={{
                        left: `${(i / hist.nBins) * 100}%`,
                        width: `${(1 / hist.nBins) * 100}%`,
                        opacity: 0.15 + alpha * 0.55,
                      }}
                    />
                  );
                });
              })()}
            </div>
          )}
          {/* Mean tick — at the actual mean's position, not centre */}
          {meanPct != null && (
            <div
              className="trend-range-mean"
              style={{ left: `${meanPct * 100}%` }}
            />
          )}
          {/* Today's marker */}
          {pct != null && (
            <div
              className={`trend-range-today ${outOfRange ? 'out-of-range' : ''}`}
              style={{ left: `${pct * 100}%` }}
            />
          )}
        </div>
        <div className="trend-range-labels">
          <span>{formatMetricValue(min, metric)}</span>
          <span>{formatMetricValue(max, metric)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini drift chart: SVG line chart of session medians over time. The dashed
 * line is a trailing moving average (3 or 5 sessions, adaptive to series
 * length) — better than linear regression at capturing real shape like
 * "improved then plateaued" instead of smoothing everything into a slope.
 *
 * X-axis uses a GLOBAL range (passed in via globalXMin/globalXMax) shared
 * across all metric charts in the grid, so session N's dot sits at the same
 * horizontal position no matter which metric you're looking at. This lets
 * the user scan vertically across the grid to correlate metrics: "session 4
 * — club speed jumped, ball speed jumped, carry jumped" reads visually
 * because the dots align.
 *
 * Date labels at the bottom corners give a concrete sense of time span.
 * Y-axis min/max labels at the top-left and bottom-left give magnitude.
 *
 * Sessions with low shot counts (n<3) are drawn faded to signal the data
 * point may not be representative.
 */
function DriftChart({ metric, series, trend, globalXMin, globalXMax }) {
  // Need at least 2 points for the chart to make sense. Less than 3 we
  // hide entirely — addressed by the parent's "needs ≥3 sessions" gate,
  // but defensive here too.
  if (!series || series.length < 2) {
    return (
      <div className="trend-card">
        <div className="trend-card-label">{metric.label}</div>
        <div style={{ padding: 20, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
          Need 2+ sessions
        </div>
      </div>
    );
  }

  // SVG geometry. Slightly taller to make room for axis labels at top
  // (y range) and bottom (date span). Drawn into a viewBox; CSS sizes
  // responsively.
  const W = 200;
  const H = 100;
  const padL = 4;
  const padR = 4;
  const padT = 10; // room for y-max label
  const padB = 14; // room for x-axis date labels
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // X domain — uses the GLOBAL range (across all metrics) so all 9 charts
  // align horizontally. Session N's dot is in the same x position no matter
  // which metric you're looking at, so vertical scanning to correlate
  // metrics actually works. Falls back to this series' own range if the
  // global wasn't provided.
  const gMin = globalXMin != null ? globalXMin : Math.min(...series.map((p) => p.date));
  const gMax = globalXMax != null ? globalXMax : Math.max(...series.map((p) => p.date));
  const xRange = (gMax - gMin) || 1;

  // Y domain with a small padding so points aren't on the edge
  const ys = series.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const xToPx = (x) => padL + ((x - gMin) / xRange) * plotW;
  const yToPx = (y) => padT + (1 - (y - yLo) / (yHi - yLo)) * plotH;

  // Build the path connecting session dots
  const linePath = series.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xToPx(p.date)} ${yToPx(p.value)}`
  ).join(' ');

  // Moving-average path. Each segment connects consecutive points; if
  // there's no trend (single point), nothing renders. Window is in the
  // trend points so we can label the line with it.
  let trendPath = null;
  let trendWindow = null;
  if (trend && trend.length >= 2) {
    trendPath = trend.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${xToPx(p.date)} ${yToPx(p.value)}`
    ).join(' ');
    trendWindow = trend[trend.length - 1].window;
  }

  // Footer numbers (use this series' own min/max dates for the day count
  // — that's the actual time over which the change happened, not the
  // global x-range which may include sessions where this metric was absent)
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  const days = Math.round((last.date - first.date) / (24 * 60 * 60 * 1000));

  // Date labels for the x-axis. Use the GLOBAL range so the labels match
  // the actual span of dots across the grid.
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const startLabel = fmtDate(gMin);
  const endLabel = fmtDate(gMax);

  return (
    <div className="trend-card">
      <div className="trend-card-label">{metric.label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* Y-axis range labels — top (max) and bottom (min) of the data
            range. Anchored at the top-left and bottom-left of the plot
            area so the eye can quickly read "the chart spans 77 to 81". */}
        <text x={padL} y={padT - 2}
          style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, fill: 'var(--text-faint)' }}>
          {formatMetricValue(yMax, metric)}
        </text>
        <text x={padL} y={padT + plotH + 6}
          style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, fill: 'var(--text-faint)' }}>
          {formatMetricValue(yMin, metric)}
        </text>

        {/* X-axis date labels at left and right edges of the plot */}
        <text x={padL} y={H - 2}
          style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, fill: 'var(--text-faint)' }}>
          {startLabel}
        </text>
        <text x={padL + plotW} y={H - 2} textAnchor="end"
          style={{ fontFamily: 'JetBrains Mono', fontSize: 6.5, fill: 'var(--text-faint)' }}>
          {endLabel}
        </text>

        {/* Moving-average line first so dots overlay it */}
        {trendPath && (
          <>
            <path
              d={trendPath}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="0.9"
              strokeDasharray="2 2"
              opacity="0.75"
            />
            {/* Tiny inline label so the user knows what the dashed line is */}
            <text
              x={padL + plotW - 1}
              y={padT + 4}
              textAnchor="end"
              style={{ fontFamily: 'JetBrains Mono', fontSize: 6, fill: 'var(--text-faint)' }}
            >
              {trendWindow}-sess avg
            </text>
          </>
        )}

        {/* Connecting line through raw session medians */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--green)"
          strokeWidth="1"
          opacity="0.5"
        />
        {/* Dots */}
        {series.map((p, i) => (
          <circle
            key={i}
            cx={xToPx(p.date)}
            cy={yToPx(p.value)}
            r="2.5"
            fill="var(--green)"
            opacity={p.n < 3 ? 0.4 : 1}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
        <span>{formatMetricValue(first.value, metric)} → {formatMetricValue(last.value, metric)}</span>
        <span style={{ color: delta >= 0 ? 'var(--green)' : 'var(--amber)' }}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(metric.decimals)} over {days}d
        </span>
      </div>
    </div>
  );
}
