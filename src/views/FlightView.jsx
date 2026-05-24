import { clubColor, orderedClubs } from '../lib/clubs';
import { mean, stdev, min, max } from '../lib/stats';
import { convertWindow, distLabel, UNIT_CONFIG } from '../lib/units';
import { getWindow } from '../data/benchmarks';

/**
 * Flight envelope view: shows every shot for every club plotted against the
 * club's optimal window for six key metrics (launch, spin, descent, peak
 * height, AoA, smash). Optimal zone is shaded green.
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
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: clubColor(club),
              marginRight: 8,
              verticalAlign: 'middle',
            }}
          ></span>
          {club} · flight envelope
        </div>
        <div className="card-subtitle">n = {shots.length} · optimal zone in green</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {metrics.map((m) => {
          const raw = shots.map((s) => s[m.key]).filter((v) => v != null);
          if (!raw.length) return <div key={m.key}></div>;
          const converted = raw.map(m.conv);
          const stats = {
            mean: mean(converted),
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
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single metric gauge. Horizontal bar with shaded optimal zone, individual
 * shots as dim ticks, and a bold tick for the mean.
 */
function FlightGauge({ label, unit, window, stats, shots }) {
  const [absMin, idealLow, idealHigh, absMax] = window;
  const pct = (v) => Math.max(0, Math.min(100, ((v - absMin) / (absMax - absMin)) * 100));
  const inWindow = shots.filter((v) => v >= idealLow && v <= idealHigh).length;
  const pctIn = shots.length ? ((inWindow / shots.length) * 100).toFixed(0) : 0;
  return (
    <div className="gauge">
      <div className="gauge-header">
        <div>
          <span className="gauge-label">{label}</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', marginLeft: 10 }}>
            {pctIn}% IN ZONE
          </span>
        </div>
        <div className="gauge-value">{formatVal(stats.mean, unit)}</div>
      </div>
      <div className="gauge-track">
        <div className="gauge-window" style={{ left: pct(idealLow) + '%', width: pct(idealHigh) - pct(idealLow) + '%' }}></div>
        {shots.map((v, i) => {
          const p = pct(v);
          if (p < 0 || p > 100) return null;
          return <div key={i} className="gauge-marker dim" style={{ left: `calc(${p}% - 0.5px)` }}></div>;
        })}
        <div className="gauge-marker" style={{ left: `calc(${pct(stats.mean)}% - 1px)` }}></div>
      </div>
      <div className="gauge-scale">
        <span>{formatVal(absMin, unit)}</span>
        <span style={{ color: 'var(--green)' }}>{formatVal(idealLow, unit)}</span>
        <span style={{ color: 'var(--green)' }}>{formatVal(idealHigh, unit)}</span>
        <span>{formatVal(absMax, unit)}</span>
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono',
          fontSize: 10,
          color: 'var(--text-faint)',
          marginTop: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        σ ±{formatVal(stats.stdev, '')} · range {formatVal(stats.min, '')}–{formatVal(stats.max, unit)}
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
