import { clubColor, orderedClubs } from '../lib/clubs';
import { trimmedMean, stdev, min, max } from '../lib/stats';
import { convertWindow, distLabel, UNIT_CONFIG } from '../lib/units';
import { getWindow } from '../data/benchmarks';

/**
 * Flight envelope view: every shot for every club plotted against the club's
 * optimal window across six key metrics (launch, spin, descent, peak height,
 * AoA, smash). Optimal zone shaded green; gauge axis auto-expands to include
 * any actual shots that fall outside the benchmark window.
 */
export default function FlightView({ shots, units }) {
  const clubs = orderedClubs([...new Set(shots.map((s) => s.club))]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Flight.</span> Launch, spin, descent, height.
        </h1>
        <div className="page-meta">
          <div>{shots.length} SHOTS · {clubs.length} CLUBS</div>
          <div>OPTIMAL WINDOWS FROM TRACKMAN / TOUR AVERAGES</div>
        </div>
      </div>

      {clubs.map((club) => {
        const clubShots = shots.filter((s) => s.club === club);
        return <FlightCard key={club} club={club} shots={clubShots} units={units} />;
      })}
    </>
  );
}

function FlightCard({ club, shots, units }) {
  const w = getWindow(club);
  // Peak height converts (yds→m); everything else is unit-invariant.
  const distFactor = UNIT_CONFIG.distance[units.distance].factor;
  const metrics = [
    { key: 'launchAngle',   label: 'LAUNCH ANGLE',    unit: '°',                       window: w.launch,     conv: (v) => v },
    { key: 'totalSpin',     label: 'TOTAL SPIN',      unit: 'rpm',                     window: w.spin,       conv: (v) => v },
    { key: 'descentAngle',  label: 'DESCENT ANGLE',   unit: '°',                       window: w.descent,    conv: (v) => v },
    { key: 'peakHeight',    label: 'PEAK HEIGHT',     unit: distLabel(units.distance), window: convertWindow(w.peakHeight, distFactor), conv: (v) => v * distFactor },
    { key: 'angleOfAttack', label: 'ANGLE OF ATTACK', unit: '°',                       window: w.aoa,        conv: (v) => v },
    { key: 'efficiency',    label: 'SMASH FACTOR',    unit: '',                        window: w.smash,      conv: (v) => v },
  ];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">
          <span
            style={{
              display: 'inline-block',
              width: 10, height: 10,
              borderRadius: '50%',
              background: clubColor(club),
              marginRight: 8,
              verticalAlign: 'middle',
            }}
          ></span>
          {club} · flight envelope
        </div>
        <div className="card-subtitle">n = {shots.length} · optimal zone in green · typical = 10% trimmed mean</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, paddingTop: 8 }}>
        {metrics.map((m) => {
          const raw = shots.map((s) => s[m.key]).filter((v) => v != null);
          if (!raw.length) return <div key={m.key}></div>;
          const converted = raw.map(m.conv);
          const stats = {
            typical: trimmedMean(converted),
            stdev: stdev(converted),
            min: min(converted),
            max: max(converted),
            n: converted.length,
          };
          return (
            <FlightGauge
              key={m.key}
              label={m.label}
              unit={m.unit}
              window={m.window}
              stats={stats}
              shots={converted}
              clubColor={clubColor(club)}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single metric gauge. Horizontal bar with shaded optimal zone, individual
 * shots as filled dots in the club's colour, and a labelled marker for the
 * trimmed-mean "typical" value. Axis auto-expands to include any shots that
 * fall outside the benchmark window so the data is always visible.
 */
function FlightGauge({ label, unit, window, stats, shots, clubColor }) {
  const [absMin, idealLow, idealHigh, absMax] = window;
  // Axis bounds: union of the benchmark window and the actual data range,
  // with 5% padding on each end so dots near the edge aren't clipped.
  const dataMin = stats.min;
  const dataMax = stats.max;
  const axisMin = Math.min(absMin, dataMin);
  const axisMax = Math.max(absMax, dataMax);
  const span = axisMax - axisMin || 1;
  const padded = span * 0.05;
  const visibleMin = axisMin - padded;
  const visibleMax = axisMax + padded;
  const pct = (v) => {
    return ((v - visibleMin) / (visibleMax - visibleMin)) * 100;
  };
  const inWindow = shots.filter((v) => v >= idealLow && v <= idealHigh).length;
  const pctIn = shots.length ? ((inWindow / shots.length) * 100).toFixed(0) : 0;

  const typicalPct = pct(stats.typical);
  // Clamp the typical-marker label position so it never falls off the edge.
  // Above ~92% it gets pinned to the right; below ~8% pinned to the left;
  // otherwise it centres on the marker.
  const labelLeft = Math.max(8, Math.min(92, typicalPct));
  const labelAnchor = typicalPct < 12 ? 'flex-start' : typicalPct > 88 ? 'flex-end' : 'center';
  const labelTransform = typicalPct < 12 ? 'translateX(0)' : typicalPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)';

  const sd = stats.stdev;
  const oneSdLow = stats.typical - sd;
  const oneSdHigh = stats.typical + sd;

  // Out-of-range arrow indicators — when actual min/max extends beyond what
  // we showed last revision (clipping), keep them visible. We've expanded
  // the axis to include data, so this only fires if a value is still beyond
  // the padded bounds (extremely unusual). Keeping for completeness.
  const anyBelow = shots.some((v) => pct(v) < 0);
  const anyAbove = shots.some((v) => pct(v) > 100);

  return (
    <div className="gauge">
      <div className="gauge-header">
        <span className="gauge-label">{label}</span>
        <span className="gauge-zone-pct">
          {pctIn}% IN ZONE
        </span>
      </div>

      {/* Anchored value label above the typical marker */}
      <div className="gauge-label-row">
        <div
          className="gauge-typical-label"
          style={{
            left: `${labelLeft}%`,
            transform: labelTransform,
            justifyContent: labelAnchor,
          }}
        >
          <span className="gauge-typical-num">{formatVal(stats.typical, unit)}</span>
          <span className="gauge-typical-tag">TYPICAL</span>
        </div>
      </div>

      <div className="gauge-track">
        {/* Optimal zone fill */}
        <div
          className="gauge-window"
          style={{ left: `${pct(idealLow)}%`, width: `${pct(idealHigh) - pct(idealLow)}%` }}
        >
          <div className="gauge-window-label">OPTIMAL</div>
        </div>

        {/* Outer window soft borders so [absMin, absMax] reads as the wider
            "acceptable" band rather than being invisible */}
        <div className="gauge-acceptable-edge" style={{ left: `${pct(absMin)}%` }}></div>
        <div className="gauge-acceptable-edge" style={{ left: `${pct(absMax)}%` }}></div>

        {/* Individual shots as filled dots in club colour. Position-based; if
            multiple shots happen to land on identical values they'll stack
            (overlap), which itself is a useful density signal. */}
        {shots.map((v, i) => {
          const p = pct(v);
          if (p < 0 || p > 100) return null;
          return (
            <div
              key={i}
              className="gauge-dot"
              style={{
                left: `${p}%`,
                background: clubColor,
              }}
              title={formatVal(v, unit)}
            ></div>
          );
        })}

        {/* Typical-shot marker (downward triangle anchored above the track,
            line down through the track for precise positioning) */}
        <div className="gauge-typical-marker" style={{ left: `${typicalPct}%` }}>
          <svg width="10" height="6" viewBox="0 0 10 6" style={{ position: 'absolute', top: -7, left: -5 }}>
            <path d="M 5 6 L 0 0 L 10 0 Z" fill="var(--text)" />
          </svg>
        </div>

        {/* Out-of-range arrows (only render if anything actually falls
            outside the padded axis — should be vanishingly rare) */}
        {anyBelow && <div className="gauge-oob-arrow left">‹</div>}
        {anyAbove && <div className="gauge-oob-arrow right">›</div>}
      </div>

      <div className="gauge-scale">
        <span>{formatVal(visibleMin, unit)}</span>
        <span className="gauge-scale-mid" style={{ left: `${pct(idealLow)}%` }}>{formatVal(idealLow, unit)}</span>
        <span className="gauge-scale-mid" style={{ left: `${pct(idealHigh)}%` }}>{formatVal(idealHigh, unit)}</span>
        <span>{formatVal(visibleMax, unit)}</span>
      </div>

      <div className="gauge-caption">
        <span className="gauge-caption-strong">1σ band {formatVal(oneSdLow, '')}–{formatVal(oneSdHigh, unit)}</span>
        <span className="gauge-caption-dim"> · range {formatVal(stats.min, '')}–{formatVal(stats.max, unit)} · n = {stats.n}</span>
      </div>
    </div>
  );
}

function formatVal(v, unit) {
  if (v == null || isNaN(v)) return '—';
  let s;
  if (unit === 'rpm') s = Math.round(v).toLocaleString();
  else if (Math.abs(v) >= 10) s = v.toFixed(1);
  else s = v.toFixed(2);
  return unit ? `${s} ${unit}` : s;
}
