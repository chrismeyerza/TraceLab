import { clubColor, orderedClubs } from '../lib/clubs';
import { mean } from '../lib/stats';
import { classifyShape, bucketShape, SHAPE_BUCKETS, formatPath } from '../lib/shape';

/**
 * Shape & delivery view: face direction, club path, and the gap between them.
 *
 * Four sections:
 *   1. 9-ball-flight matrix (counts of each shape bucket)
 *   2. Face & path averages by club
 *   3. Face-vs-Path scatter (diagonal = straight ball; above = fade, below = draw)
 *   4. Start line vs side spin scatter
 */
export default function ShapeView({ shots, rightHanded }) {
  const validShots = shots.filter((s) => s.faceToTarget != null && s.clubPath != null);
  const shapes = validShots.map((s) => ({
    ...s,
    shape: classifyShape(s.faceToTarget, s.clubPath, rightHanded),
  }));

  const grid = SHAPE_BUCKETS.map((row) =>
    row.map((name) => ({
      name,
      shots: shapes.filter((s) => bucketShape(s.shape.name) === name),
    }))
  );
  const total = shapes.length;
  const maxCount = Math.max(...grid.flat().map((c) => c.shots.length));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Shape.</span> Face, path, the gap.
        </h1>
        <div className="page-meta">
          <div>{validShots.length} SHOTS WITH FACE & PATH DATA</div>
          <div>{rightHanded ? 'RIGHT-HANDED' : 'LEFT-HANDED'} · 9-BALL FLIGHT MATRIX</div>
        </div>
      </div>

      <div className="two-col uneven" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span className="num">01</span>9-ball flight matrix
            </div>
            <div className="card-subtitle">Where every shot starts and curves</div>
          </div>
          <div className="shape-grid">
            {grid.flat().map((cell, i) => {
              const pct = total ? (cell.shots.length / total) * 100 : 0;
              const intensity = maxCount ? cell.shots.length / maxCount : 0;
              const dominant = cell.shots.length === maxCount && maxCount > 0;
              return (
                <div
                  key={i}
                  className={`shape-cell ${cell.shots.length > 0 ? 'has-shots' : ''} ${dominant ? 'dominant' : ''}`}
                  style={dominant ? {} : { backgroundColor: `rgba(74, 222, 128, ${intensity * 0.08})` }}
                >
                  <div className="shape-cell-name">{cell.name}</div>
                  <div className="shape-cell-count">{cell.shots.length}</div>
                  <div className="shape-cell-pct">{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: 'JetBrains Mono',
              fontSize: 10,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
          >
            ROWS: START DIRECTION (PULL · STRAIGHT · PUSH) — COLS: CURVE (DRAW · STRAIGHT · FADE)
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span className="num">02</span>Face & path
            </div>
            <div className="card-subtitle">Averages by club</div>
          </div>
          <FaceAndPathTable shots={shapes} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">03</span>Face vs Path scatter
          </div>
          <div className="card-subtitle">
            The diagonal is "Face matches Path" — straight shots. Above = open face (fade). Below = closed face (draw).
          </div>
        </div>
        <FacePathScatter shots={shapes} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">04</span>Start line vs Curve
          </div>
          <div className="card-subtitle">Push/Pull at launch on X · Sidespin (curve direction) on Y</div>
        </div>
        <StartCurveScatter shots={shapes} rightHanded={rightHanded} />
      </div>
    </>
  );
}

function FaceAndPathTable({ shots }) {
  const byClub = {};
  shots.forEach((s) => {
    if (!byClub[s.club]) byClub[s.club] = [];
    byClub[s.club].push(s);
  });
  const entries = orderedClubs(Object.keys(byClub)).map((c) => [c, byClub[c]]);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>CLUB</th>
          <th className="num">N</th>
          <th className="num">FACE</th>
          <th className="num">PATH</th>
          <th className="num">F-TO-P</th>
          <th className="num">CLOSURE</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([club, clubShots]) => {
          const f = mean(clubShots.map((s) => s.faceToTarget));
          const p = mean(clubShots.map((s) => s.clubPath));
          const ftp = f - p;
          const cl = mean(clubShots.map((s) => s.closureRate).filter((v) => v != null));
          return (
            <tr key={club}>
              <td style={{ color: clubColor(club), fontWeight: 700 }}>{club}</td>
              <td className="num">{clubShots.length}</td>
              <td className="num">{f >= 0 ? '+' : ''}{f.toFixed(1)}°</td>
              <td className="num">{formatPath(p)}</td>
              <td
                className="num"
                style={{ color: ftp > 1 ? 'var(--amber)' : ftp < -1 ? 'var(--blue)' : 'var(--green)' }}
              >
                {ftp >= 0 ? '+' : ''}{ftp.toFixed(1)}°
              </td>
              <td className="num">{isNaN(cl) ? '—' : Math.round(cl).toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FacePathScatter({ shots }) {
  const W = 760;
  const H = 460;
  const PAD = 50;
  const range = 15;
  const xToPx = (x) => PAD + ((x + range) / (range * 2)) * (W - PAD * 2);
  const yToPx = (y) => H - PAD - ((y + range) / (range * 2)) * (H - PAD * 2);
  return (
    <div className="plot-container">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {[-10, -5, 0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={xToPx(v)}
              x2={xToPx(v)}
              y1={yToPx(-range)}
              y2={yToPx(range)}
              stroke="var(--border)"
              strokeDasharray={v === 0 ? '' : '1 4'}
              strokeOpacity={v === 0 ? 1 : 0.5}
            />
            <line
              x1={xToPx(-range)}
              x2={xToPx(range)}
              y1={yToPx(v)}
              y2={yToPx(v)}
              stroke="var(--border)"
              strokeDasharray={v === 0 ? '' : '1 4'}
              strokeOpacity={v === 0 ? 1 : 0.5}
            />
            <text x={xToPx(v)} y={H - PAD + 15} className="tick-label" textAnchor="middle">
              {v >= 0 ? '+' : ''}{v}°
            </text>
            <text x={PAD - 8} y={yToPx(v) + 3} className="tick-label" textAnchor="end">
              {v >= 0 ? '+' : ''}{v}°
            </text>
          </g>
        ))}
        <line
          x1={xToPx(-range)}
          y1={yToPx(-range)}
          x2={xToPx(range)}
          y2={yToPx(range)}
          stroke="var(--green)"
          strokeOpacity="0.4"
          strokeDasharray="4 4"
          strokeWidth="1"
        />

        <text x={xToPx(8)} y={yToPx(-8)} className="axis-label" textAnchor="middle">
          FACE OPEN · FADE/SLICE
        </text>
        <text x={xToPx(-8)} y={yToPx(8)} className="axis-label" textAnchor="middle">
          FACE CLOSED · DRAW/HOOK
        </text>

        <text x={W / 2} y={H - 8} className="axis-label" textAnchor="middle">
          CLUB PATH (deg)
        </text>
        <text x={14} y={H / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>
          FACE TO TARGET (deg)
        </text>

        {shots.map((s, i) => (
          <circle
            key={i}
            cx={xToPx(s.clubPath)}
            cy={yToPx(s.faceToTarget)}
            r="5"
            fill={clubColor(s.club)}
            fillOpacity="0.7"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.5"
          >
            <title>
              {s.club} · Face {s.faceToTarget.toFixed(1)}° · Path {formatPath(s.clubPath)} · F-to-P{' '}
              {s.shape.faceToPath.toFixed(1)}° · {s.shape.name}
            </title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, gap: 16 }}>
        {orderedClubs([...new Set(shots.map((s) => s.club))]).map((c) => (
          <div key={c} className="legend">
            <span className="legend-dot" style={{ background: clubColor(c), borderColor: clubColor(c) }}></span>
            <span style={{ color: clubColor(c) }}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StartCurveScatter({ shots, rightHanded }) {
  const W = 760;
  const H = 360;
  const PAD = 50;
  const xRange = 15;
  const yRange = 2500;
  const xToPx = (x) => PAD + ((x + xRange) / (xRange * 2)) * (W - PAD * 2);
  const yToPx = (y) => H - PAD - ((y + yRange) / (yRange * 2)) * (H - PAD * 2);
  return (
    <div className="plot-container">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        {[-10, -5, 0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={xToPx(v)}
              x2={xToPx(v)}
              y1={yToPx(-yRange)}
              y2={yToPx(yRange)}
              stroke="var(--border)"
              strokeDasharray={v === 0 ? '' : '1 4'}
              strokeOpacity={v === 0 ? 1 : 0.5}
            />
            <text x={xToPx(v)} y={H - PAD + 15} className="tick-label" textAnchor="middle">
              {v >= 0 ? '+' : ''}{v}°
            </text>
          </g>
        ))}
        {[-2000, -1000, 0, 1000, 2000].map((v) => (
          <g key={v}>
            <line
              x1={xToPx(-xRange)}
              x2={xToPx(xRange)}
              y1={yToPx(v)}
              y2={yToPx(v)}
              stroke="var(--border)"
              strokeDasharray={v === 0 ? '' : '1 4'}
              strokeOpacity={v === 0 ? 1 : 0.5}
            />
            <text x={PAD - 8} y={yToPx(v) + 3} className="tick-label" textAnchor="end">
              {v >= 0 ? '+' : ''}{v}
            </text>
          </g>
        ))}

        <text x={xToPx(0)} y={yToPx(yRange * 0.9)} className="axis-label" textAnchor="middle">
          {rightHanded ? 'PULL' : 'PUSH'} ← START LINE (Face to Target) → {rightHanded ? 'PUSH' : 'PULL'}
        </text>
        <text x={14} y={H / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>
          {rightHanded ? 'HOOK SPIN' : 'SLICE SPIN'} ← CURVE (Side Spin) → {rightHanded ? 'SLICE SPIN' : 'HOOK SPIN'}
        </text>

        {shots.map((s, i) => (
          <circle
            key={i}
            cx={xToPx(s.faceToTarget)}
            cy={yToPx(s.sideSpin || 0)}
            r="5"
            fill={clubColor(s.club)}
            fillOpacity="0.7"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.5"
          >
            <title>
              {s.club} · Start {s.faceToTarget.toFixed(1)}° · Side spin {s.sideSpin || 0} rpm
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
