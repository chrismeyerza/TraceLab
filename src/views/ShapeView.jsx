import { useState } from 'react';
import { clubColor, orderedClubs } from '../lib/clubs';
import { mean } from '../lib/stats';
import { classifyShape, bucketShape, SHAPE_BUCKETS, formatPath } from '../lib/shape';

/**
 * Shape & delivery view: face direction, club path, and the gap between them.
 *
 * Four sections:
 *   1. 9-ball-flight matrix — click any cell to inspect the shots in it
 *   2. Face & path averages by club
 *   3. Face-vs-Path scatter — click any dot to see that exact shot
 *   4. Start line vs side spin scatter
 *
 * The drill-down state lets the user verify the classification. "Click a
 * cell that surprises you and see the actual shots" is the diagnostic
 * workflow when the bucket counts don't match the user's mental model.
 */
export default function ShapeView({ shots, rightHanded }) {
  const validShots = shots.filter((s) => s.faceToTarget != null && s.clubPath != null);
  const shapes = validShots.map((s) => ({
    ...s,
    shape: classifyShape(s.faceToTarget, s.clubPath, rightHanded),
  }));

  // Drill-down selection. Shape: { kind: 'cell', cell: 'Pull Hook' } or
  // { kind: 'shot', id: '...' } or null.
  const [drillDown, setDrillDown] = useState(null);

  const grid = SHAPE_BUCKETS.map((row) =>
    row.map((name) => ({
      name,
      shots: shapes.filter((s) => bucketShape(s.shape.name) === name),
    }))
  );
  const total = shapes.length;
  const maxCount = Math.max(...grid.flat().map((c) => c.shots.length));

  // Resolve drill-down selection to a concrete list of shots, with a label.
  const drillShots =
    drillDown?.kind === 'cell'
      ? shapes.filter((s) => bucketShape(s.shape.name) === drillDown.cell)
      : drillDown?.kind === 'shot'
      ? shapes.filter((s) => s.id === drillDown.id)
      : null;
  const drillLabel =
    drillDown?.kind === 'cell'
      ? `${drillDown.cell} — ${drillShots.length} shot${drillShots.length === 1 ? '' : 's'}`
      : drillDown?.kind === 'shot'
      ? 'Selected shot'
      : null;

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
              const isSelected = drillDown?.kind === 'cell' && drillDown.cell === cell.name;
              const clickable = cell.shots.length > 0;
              return (
                <div
                  key={i}
                  className={`shape-cell ${cell.shots.length > 0 ? 'has-shots' : ''} ${dominant ? 'dominant' : ''} ${isSelected ? 'selected' : ''} ${clickable ? 'clickable' : ''}`}
                  style={dominant ? {} : { backgroundColor: `rgba(74, 222, 128, ${intensity * 0.08})` }}
                  onClick={() => {
                    if (!clickable) return;
                    setDrillDown(
                      isSelected ? null : { kind: 'cell', cell: cell.name }
                    );
                  }}
                  role={clickable ? 'button' : undefined}
                  title={clickable ? `Click to see the ${cell.shots.length} shot${cell.shots.length === 1 ? '' : 's'} in this cell` : ''}
                >
                  <div className="shape-cell-name">{cell.name}</div>
                  <div className="shape-cell-pct">{pct.toFixed(0)}%</div>
                  <div className="shape-cell-count">{cell.shots.length} shot{cell.shots.length === 1 ? '' : 's'}</div>
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
            ROWS: START DIRECTION (PULL · STRAIGHT · PUSH) — COLS: CURVE (DRAW · STRAIGHT · FADE) · CLICK A CELL TO INSPECT
          </div>
          {drillShots && (
            <DrillPanel
              label={drillLabel}
              shots={drillShots}
              onClear={() => setDrillDown(null)}
            />
          )}
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
            The diagonal is "Face matches Path" — straight shots. Above = open face (fade). Below = closed face (draw). Click a dot to inspect.
          </div>
        </div>
        <FacePathScatter
          shots={shapes}
          selectedId={drillDown?.kind === 'shot' ? drillDown.id : null}
          onSelectShot={(id) => setDrillDown(
            drillDown?.kind === 'shot' && drillDown.id === id ? null : { kind: 'shot', id }
          )}
        />
        {drillDown?.kind === 'shot' && drillShots && (
          <DrillPanel
            label={drillLabel}
            shots={drillShots}
            onClear={() => setDrillDown(null)}
          />
        )}
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

function FacePathScatter({ shots, selectedId, onSelectShot }) {
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

        {shots.map((s, i) => {
          const isSelected = selectedId === s.id;
          return (
            <circle
              key={s.id || i}
              cx={xToPx(s.clubPath)}
              cy={yToPx(s.faceToTarget)}
              r={isSelected ? '8' : '5'}
              fill={clubColor(s.club)}
              fillOpacity={isSelected ? '1' : '0.7'}
              stroke={isSelected ? 'var(--text-strong)' : 'rgba(0,0,0,0.3)'}
              strokeWidth={isSelected ? '2' : '0.5'}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectShot?.(s.id)}
            >
              <title>
                {s.club} · Face {s.faceToTarget.toFixed(1)}° · Path {formatPath(s.clubPath)} · Start {s.shape.startLine.toFixed(1)}° · F-to-P{' '}
                {s.shape.faceToPath.toFixed(1)}° · {s.shape.name}
              </title>
            </circle>
          );
        })}
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

/**
 * Drill-down panel: a small table of shots and their per-shot face / path /
 * face-to-path values. Used to verify classification calls — click a cell or
 * dot that surprises you, see exactly which shots are in it, and judge
 * whether the call is honest. This is the verification tool for the
 * bucketing logic itself.
 *
 * Columns kept deliberately tight: when, club, face, path, F-to-P, granular
 * shape name (the underlying classification before bucketing). The "shape"
 * column is intentionally redundant with the cell label; it lets you see
 * which granular sub-shape mapped to the cell.
 */
function DrillPanel({ label, shots, onClear }) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: 14,
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border-strong)',
        borderLeft: '3px solid var(--green)',
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <button
          className="btn-secondary"
          onClick={onClear}
          style={{ padding: '3px 10px', fontSize: 10 }}
        >
          CLEAR
        </button>
      </div>
      {shots.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No shots in this selection.</div>
      ) : (
        <table className="data-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>WHEN</th>
              <th>CLUB</th>
              <th className="num">FACE</th>
              <th className="num">PATH</th>
              <th className="num">START</th>
              <th className="num">F-TO-P</th>
              <th>CLASSIFICATION</th>
            </tr>
          </thead>
          <tbody>
            {shots
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {s.createdAt
                      ? new Date(s.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td style={{ color: clubColor(s.club), fontWeight: 700 }}>{s.club}</td>
                  <td className="num">
                    {s.faceToTarget > 0 ? '+' : ''}{s.faceToTarget.toFixed(1)}°
                  </td>
                  <td className="num">{formatPath(s.clubPath)}</td>
                  <td
                    className="num"
                    style={{
                      color:
                        Math.abs(s.shape.startLine) > 3 ? 'var(--amber)' : 'var(--text)',
                      fontWeight: 600,
                    }}
                    title="Estimated initial direction of ball flight (0.75 × face + 0.25 × path)"
                  >
                    {s.shape.startLine > 0 ? '+' : ''}{s.shape.startLine.toFixed(1)}°
                  </td>
                  <td
                    className="num"
                    style={{
                      color:
                        s.shape.faceToPath > 2 ? 'var(--amber)'
                        : s.shape.faceToPath < -2 ? 'var(--blue)'
                        : 'var(--green)',
                      fontWeight: 600,
                    }}
                  >
                    {s.shape.faceToPath > 0 ? '+' : ''}{s.shape.faceToPath.toFixed(1)}°
                  </td>
                  <td style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.shape.name}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
