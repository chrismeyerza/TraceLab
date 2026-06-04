import { useMemo, useState, useEffect } from 'react';
import {
  TREND_METRICS,
  groupBySession,
  sessionSeries,
  linearRegression,
  metricBaseline,
  pinnedSessionValue,
  mostHitClub,
  formatMetricValue,
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
export default function TrendsView({ shots, allClubs, units, pinnedSession }) {
  // Club selection. Defaults to the most-hit club so the view is useful
  // on first land. Stored locally — switching club shouldn't affect any
  // other view's state.
  const [club, setClub] = useState(null);
  useEffect(() => {
    if (!club && allClubs.length) {
      const def = mostHitClub(shots, allClubs);
      if (def) setClub(def);
    }
    // If the current club no longer exists in allClubs (e.g. filters
    // changed and now-excluded), revert to the most-hit available.
    else if (club && !allClubs.includes(club)) {
      const def = mostHitClub(shots, allClubs);
      if (def) setClub(def);
    }
  }, [allClubs, shots, club]);

  // Session-by-session series for each metric — computed once per
  // (shots, club) change rather than per-metric to share the grouping work.
  const sessionGroups = useMemo(() => groupBySession(shots), [shots]);

  if (!shots.length) {
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

  // Pre-compute per-metric: baseline, pinned-session value, series, regression.
  // Doing it once here makes the render code below straightforward.
  const metricsData = TREND_METRICS.map((m) => {
    const baseline = metricBaseline(shots, club, m.key);
    const pinned = pinnedSession
      ? pinnedSessionValue(shots, club, m.key, pinnedSession.id)
      : null;
    const series = sessionSeries(sessionGroups, club, m.key);
    const reg = linearRegression(series);
    return { metric: m, baseline, pinned, series, reg };
  });

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
            Session medians for {club}, oldest → newest. Trend line shows direction.
          </div>
        </div>
        {hasEnoughForTrend ? (
          <div className="trends-grid">
            {metricsData.map(({ metric, series, reg }) => (
              <DriftChart
                key={metric.key}
                metric={metric}
                series={series}
                regression={reg}
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

  // Range bar geometry: µ ± 2σ. The marker for today is placed
  // proportionally. Values outside that range get clamped to the edge so
  // the dot is always visible, but coloured red as a hint that it's beyond
  // the normal range.
  let pct = null; // 0..1 position on the bar
  let outOfRange = false;
  if (todayVal != null && baseline.stdev > 0) {
    const min = baseline.mean - 2 * baseline.stdev;
    const max = baseline.mean + 2 * baseline.stdev;
    pct = (todayVal - min) / (max - min);
    if (pct < 0 || pct > 1) outOfRange = true;
    pct = Math.max(0, Math.min(1, pct));
  } else if (todayVal != null) {
    pct = 0.5;
  }

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
      {/* Range bar: -2σ ... mean ... +2σ */}
      <div className="trend-range-bar">
        <div className="trend-range-track">
          {/* Centre tick at mean */}
          <div className="trend-range-mean" />
          {/* Today's marker */}
          {pct != null && (
            <div
              className={`trend-range-today ${outOfRange ? 'out-of-range' : ''}`}
              style={{ left: `${pct * 100}%` }}
            />
          )}
        </div>
        <div className="trend-range-labels">
          <span>{formatMetricValue(baseline.mean - 2 * baseline.stdev, metric)}</span>
          <span>{formatMetricValue(baseline.mean + 2 * baseline.stdev, metric)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini drift chart: SVG line chart of session medians over time, with a
 * linear regression line through them. Y-axis auto-scales to the data
 * range with a small padding so points don't hug the edges; X-axis is
 * date, oldest → newest.
 *
 * Sessions with low shot counts (n<3) are drawn faded to signal the data
 * point may not be representative. The regression line is drawn whether
 * or not it has good fit — direction is the signal we care about.
 *
 * Below the chart: latest value, delta from earliest, and the regression's
 * predicted drift over the chart's full timespan ("drift +2.1 over 47
 * days"). Gives the user numerical context for what the line shows.
 */
function DriftChart({ metric, series, regression }) {
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

  // SVG geometry. Drawn into a viewBox; CSS sizes it responsively.
  const W = 200;
  const H = 90;
  const padL = 4;
  const padR = 4;
  const padT = 6;
  const padB = 6;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // X domain: session dates
  const xs = series.map((p) => p.date);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  // Y domain with a small padding so points aren't on the edge
  const ys = series.map((p) => p.value);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const xToPx = (x) => padL + ((x - xMin) / xRange) * plotW;
  const yToPx = (y) => padT + (1 - (y - yLo) / (yHi - yLo)) * plotH;

  // Build the path (polyline) connecting session dots
  const linePath = series.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xToPx(p.date)} ${yToPx(p.value)}`
  ).join(' ');

  // Regression line, evaluated at the two endpoints
  let regLine = null;
  if (regression) {
    const y1 = regression.slope * xMin + regression.intercept;
    const y2 = regression.slope * xMax + regression.intercept;
    regLine = { x1: xToPx(xMin), y1: yToPx(y1), x2: xToPx(xMax), y2: yToPx(y2) };
  }

  // Footer numbers
  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  const days = Math.round((xMax - xMin) / (24 * 60 * 60 * 1000));

  return (
    <div className="trend-card">
      <div className="trend-card-label">{metric.label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {/* Regression first so dots overlay */}
        {regLine && (
          <line
            x1={regLine.x1} y1={regLine.y1} x2={regLine.x2} y2={regLine.y2}
            stroke="var(--text-dim)"
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.65"
          />
        )}
        {/* Connecting line */}
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
