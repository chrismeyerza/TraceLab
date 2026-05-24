import { clubColor, orderedClubs } from '../lib/clubs';
import { mean, stdev, min, max } from '../lib/stats';
import { convertSpeed, convertDistance, speedLabel, distLabel } from '../lib/units';

/**
 * Strike view: where on the face you're contacting the ball, and what it costs.
 *
 * Three sections:
 *   1. Master heatmap — all shots, coloured by ball speed (slow=red → fast=green)
 *   2. Per-club centroid plots with 1σ dispersion ellipse
 *   3. Speed-loss-by-zone table (centre vs slightly-off vs off vs big miss)
 */
export default function StrikeView({ shots, units }) {
  const strikeShots = shots.filter((s) => s.faceImpactH != null && s.faceImpactV != null);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Strike.</span> Where you hit the face.
        </h1>
        <div className="page-meta">
          <div>{strikeShots.length} SHOTS WITH STRIKE DATA</div>
          <div>USGA IRON FACE · 127mm × 71.12mm</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">01</span>Impact location · coloured by ball speed
          </div>
          <div className="card-subtitle">Dark = slow · Bright = fast · See what off-centre strikes cost</div>
        </div>
        <StrikePlot shots={strikeShots} units={units} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">02</span>Per-club strike pattern
          </div>
          <div className="card-subtitle">Centroid + 1σ ellipse · the tighter the better</div>
        </div>
        <StrikePerClub shots={strikeShots} units={units} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">03</span>Ball speed by strike zone
          </div>
          <div className="card-subtitle">How much speed you give up on off-centre strikes</div>
        </div>
        <StrikeZoneTable shots={strikeShots} units={units} />
      </div>
    </>
  );
}

/** Master strike plot. SVG, scaled responsively via viewBox. */
function StrikePlot({ shots, units }) {
  const W = 800;
  const H = 460;
  const FACE_W = 127;
  const FACE_H = 71.12;
  const PAD = 60;
  const PAD_TOP = 30;
  const plotW = W - PAD * 2;
  const plotH = H - PAD - PAD_TOP;
  const xRange = [-40, 40];
  const yRange = [-30, 30];
  const xToPx = (x) => PAD + ((x - xRange[0]) / (xRange[1] - xRange[0])) * plotW;
  const yToPx = (y) => H - PAD - ((y - yRange[0]) / (yRange[1] - yRange[0])) * plotH;

  const speeds = shots.map((s) => s.ballSpeed).filter((v) => v != null);
  const minBS = min(speeds);
  const maxBS = max(speeds);
  const colorFor = (s) => {
    const t = (s.ballSpeed - minBS) / (maxBS - minBS || 1);
    if (t < 0.5) {
      return `rgba(${239 + (251 - 239) * t * 2}, ${68 + (191 - 68) * t * 2}, ${68 + (36 - 68) * t * 2}, 0.85)`;
    }
    return `rgba(${251 + (74 - 251) * (t - 0.5) * 2}, ${191 + (222 - 191) * (t - 0.5) * 2}, ${
      36 + (128 - 36) * (t - 0.5) * 2
    }, 0.85)`;
  };

  return (
    <div className="plot-container">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={xToPx(xRange[0])} x2={xToPx(xRange[1])} y1={yToPx(0)} y2={yToPx(0)} stroke="var(--border)" strokeDasharray="2 4" />
        <line x1={xToPx(0)} x2={xToPx(0)} y1={yToPx(yRange[0])} y2={yToPx(yRange[1])} stroke="var(--border)" strokeDasharray="2 4" />

        <rect
          x={xToPx(-FACE_W / 2)}
          y={yToPx(FACE_H / 2)}
          width={xToPx(FACE_W / 2) - xToPx(-FACE_W / 2)}
          height={yToPx(-FACE_H / 2) - yToPx(FACE_H / 2)}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
          rx="6"
        />
        <ellipse
          cx={xToPx(0)}
          cy={yToPx(0)}
          rx={xToPx(8) - xToPx(0)}
          ry={yToPx(0) - yToPx(5)}
          fill="rgba(74,222,128,0.06)"
          stroke="rgba(74,222,128,0.25)"
          strokeDasharray="3 3"
        />

        {[-60, -40, -20, 0, 20, 40, 60]
          .filter((x) => x >= xRange[0] && x <= xRange[1])
          .map((x) => (
            <text key={x} x={xToPx(x)} y={H - PAD + 18} className="tick-label" textAnchor="middle">
              {x}
            </text>
          ))}
        {[-30, -20, -10, 0, 10, 20, 30]
          .filter((y) => y >= yRange[0] && y <= yRange[1])
          .map((y) => (
            <text key={y} x={PAD - 10} y={yToPx(y) + 3} className="tick-label" textAnchor="end">
              {y}
            </text>
          ))}

        <text x={W / 2} y={H - 8} className="axis-label" textAnchor="middle">
          TOE ← HORIZONTAL (mm) → HEEL
        </text>
        <text x={14} y={H / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>
          LOW ← VERTICAL (mm) → HIGH
        </text>

        <text x={xToPx(0)} y={PAD_TOP - 8} className="tick-label" textAnchor="middle">
          CENTRE
        </text>

        {shots.map((s, i) => (
          <circle
            key={i}
            cx={xToPx(s.faceImpactH)}
            cy={yToPx(s.faceImpactV)}
            r="5"
            fill={colorFor(s)}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="0.5"
          >
            <title>
              {s.club} · {s.ballSpeed?.toFixed(1)} mph · ({s.faceImpactH}, {s.faceImpactV})
            </title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)' }}>
          n = <span style={{ color: 'var(--text)', fontWeight: 600 }}>{shots.length}</span> · ball speed range{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {convertSpeed(minBS, units.speed).toFixed(1)}–{convertSpeed(maxBS, units.speed).toFixed(1)}{' '}
            {speedLabel(units.speed)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
            SLOW
          </span>
          <div className="legend-bar">
            <div className="legend-bar-segment" style={{ background: '#ef4444' }}></div>
            <div className="legend-bar-segment" style={{ background: '#f97316' }}></div>
            <div className="legend-bar-segment" style={{ background: '#fbbf24' }}></div>
            <div className="legend-bar-segment" style={{ background: '#84cc16' }}></div>
            <div className="legend-bar-segment" style={{ background: '#4ade80' }}></div>
          </div>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
            FAST
          </span>
        </div>
      </div>
    </div>
  );
}

function StrikePerClub({ shots, units }) {
  const clubs = orderedClubs([...new Set(shots.map((s) => s.club))]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(clubs.length, 3)}, 1fr)`, gap: 12 }}>
      {clubs.map((club) => {
        const clubShots = shots.filter((s) => s.club === club);
        const h = clubShots.map((s) => s.faceImpactH);
        const v = clubShots.map((s) => s.faceImpactV);
        const meanH = mean(h);
        const meanV = mean(v);
        const sdH = stdev(h);
        const sdV = stdev(v);
        return (
          <div key={club} className="plot-container" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: clubColor(club) }}>{club}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                n = {clubShots.length}
              </span>
            </div>
            <SinglePlot shots={clubShots} club={club} units={units} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, fontFamily: 'JetBrains Mono', fontSize: 10 }}>
              <div>
                CENTROID <span style={{ color: 'var(--text)' }}>{meanH.toFixed(1)},{meanV.toFixed(1)}</span>
              </div>
              <div>
                1σ <span style={{ color: 'var(--text)' }}>±{sdH.toFixed(1)},±{sdV.toFixed(1)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SinglePlot({ shots, club, units }) {
  const W = 280;
  const H = 200;
  const FACE_W = 127;
  const FACE_H = 71.12;
  const PAD = 14;
  const xRange = [-50, 50];
  const yRange = [-35, 35];
  const xToPx = (x) => PAD + ((x - xRange[0]) / (xRange[1] - xRange[0])) * (W - PAD * 2);
  const yToPx = (y) => H - PAD - ((y - yRange[0]) / (yRange[1] - yRange[0])) * (H - PAD * 2);
  const color = clubColor(club);
  const h = shots.map((s) => s.faceImpactH);
  const v = shots.map((s) => s.faceImpactV);
  const meanH = mean(h);
  const meanV = mean(v);
  const sdH = stdev(h);
  const sdV = stdev(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <line x1={xToPx(xRange[0])} x2={xToPx(xRange[1])} y1={yToPx(0)} y2={yToPx(0)} stroke="var(--border)" strokeDasharray="1 3" />
      <line x1={xToPx(0)} x2={xToPx(0)} y1={yToPx(yRange[0])} y2={yToPx(yRange[1])} stroke="var(--border)" strokeDasharray="1 3" />
      <rect
        x={xToPx(-FACE_W / 2)}
        y={yToPx(FACE_H / 2)}
        width={xToPx(FACE_W / 2) - xToPx(-FACE_W / 2)}
        height={yToPx(-FACE_H / 2) - yToPx(FACE_H / 2)}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth="1"
        rx="3"
      />
      {shots.length >= 3 && (
        <ellipse
          cx={xToPx(meanH)}
          cy={yToPx(meanV)}
          rx={Math.abs(xToPx(sdH) - xToPx(0))}
          ry={Math.abs(yToPx(0) - yToPx(sdV))}
          fill={color}
          fillOpacity="0.08"
          stroke={color}
          strokeOpacity="0.6"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
      {shots.map((s, i) => (
        <circle
          key={i}
          cx={xToPx(s.faceImpactH)}
          cy={yToPx(s.faceImpactV)}
          r="3.5"
          fill={color}
          fillOpacity="0.7"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
        >
          <title>
            {s.ballSpeed != null ? convertSpeed(s.ballSpeed, units.speed).toFixed(1) : '—'} {speedLabel(units.speed)} ·
            ({s.faceImpactH}, {s.faceImpactV})
          </title>
        </circle>
      ))}
      <circle cx={xToPx(meanH)} cy={yToPx(meanV)} r="2.5" fill="var(--text)" />
      <circle cx={xToPx(meanH)} cy={yToPx(meanV)} r="6" fill="none" stroke="var(--text)" strokeWidth="0.5" strokeDasharray="1 1" />
    </svg>
  );
}

function StrikeZoneTable({ shots, units }) {
  const zones = [
    { name: 'CENTRE', test: (s) => Math.hypot(s.faceImpactH, s.faceImpactV) <= 5 },
    {
      name: 'SLIGHTLY OFF',
      test: (s) => {
        const d = Math.hypot(s.faceImpactH, s.faceImpactV);
        return d > 5 && d <= 10;
      },
    },
    {
      name: 'OFF',
      test: (s) => {
        const d = Math.hypot(s.faceImpactH, s.faceImpactV);
        return d > 10 && d <= 15;
      },
    },
    { name: 'BIG MISS', test: (s) => Math.hypot(s.faceImpactH, s.faceImpactV) > 15 },
  ];
  const centre = shots.filter(zones[0].test);
  const centreBSMean = centre.length ? mean(centre.map((s) => s.ballSpeed)) : null;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>ZONE</th>
          <th>SHOTS</th>
          <th>% OF TOTAL</th>
          <th>AVG BALL SPEED</th>
          <th>VS CENTRE</th>
          <th>AVG SMASH</th>
          <th>AVG CARRY</th>
        </tr>
      </thead>
      <tbody>
        {zones.map((z) => {
          const zShots = shots.filter(z.test);
          if (!zShots.length) return null;
          const bs = mean(zShots.map((s) => s.ballSpeed));
          const sm = mean(zShots.map((s) => s.efficiency).filter((v) => v != null));
          const ca = mean(zShots.map((s) => s.carry).filter((v) => v != null));
          const diff = centreBSMean ? ((bs - centreBSMean) / centreBSMean) * 100 : null;
          return (
            <tr key={z.name}>
              <td>{z.name}</td>
              <td className="num">{zShots.length}</td>
              <td className="num">{((zShots.length / shots.length) * 100).toFixed(0)}%</td>
              <td className="num">{convertSpeed(bs, units.speed).toFixed(1)} {speedLabel(units.speed)}</td>
              <td
                className="num"
                style={{ color: diff && diff < -2 ? 'var(--red)' : diff && diff < 0 ? 'var(--amber)' : 'var(--green)' }}
              >
                {diff !== null ? (diff > 0 ? '+' : '') + diff.toFixed(1) + '%' : '—'}
              </td>
              <td className="num">{sm.toFixed(3)}</td>
              <td className="num">{convertDistance(ca, units.distance).toFixed(1)} {distLabel(units.distance)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
