import { clubColor, orderedClubs } from '../lib/clubs';
import { mean, stdev } from '../lib/stats';
import { convertSpeed, convertDistance, speedLabel, distLabel } from '../lib/units';
import { classifyStrike, getStrikeBands } from '../data/benchmarks';

/**
 * Strike view: where on the face you're contacting the ball, and what it costs.
 *
 * Three sections:
 *   1. Tolerance reference — what counts as centred / near / off, by club category
 *   2. Strike summary table — % of shots in each band + ball-speed cost
 *   3. Per-club strike plots — visual centroid + tolerance zones for each club
 *
 * The previous "master heatmap" was dropped: the per-club plots cover the same
 * ground with better information (separated by club), and the FilterBar already
 * lets you select any combination of clubs for cross-bag pattern-spotting.
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
            <span className="num">01</span>Strike tolerance reference
          </div>
          <div className="card-subtitle">What counts as a centred strike — by club category</div>
        </div>
        <ToleranceReference />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">02</span>Strike summary · ball speed by zone
          </div>
          <div className="card-subtitle">How much speed you give up vs your centred strikes · zones use per-club tolerance</div>
        </div>
        <StrikeZoneTable shots={strikeShots} units={units} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">03</span>Per-club strike pattern
          </div>
          <div className="card-subtitle">Centroid + 1σ ellipse · green / amber / red zones show centred / near / off-centre tolerance</div>
        </div>
        <StrikePerClub shots={strikeShots} units={units} />
      </div>
    </>
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
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                n = {clubShots.length}
              </span>
            </div>
            <SinglePlot shots={clubShots} club={club} units={units} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
              <div>
                CENTROID <span style={{ color: 'var(--text)', fontWeight: 700 }}>{meanH.toFixed(1)},{meanV.toFixed(1)}</span>
              </div>
              <div>
                1σ <span style={{ color: 'var(--text)', fontWeight: 700 }}>±{sdH.toFixed(1)},±{sdV.toFixed(1)}</span>
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
  const bands = getStrikeBands(club);
  // Per-shot classifications, used for the count summary below
  const classified = shots.map((s) => classifyStrike(club, s.faceImpactH, s.faceImpactV));
  const bandCount = (b) => classified.filter((c) => c && c.band === b).length;
  // Helper: convert a mm radius to SVG units (x and y scales are different)
  const radPxX = (r) => xToPx(r) - xToPx(0);
  const radPxY = (r) => yToPx(0) - yToPx(r);
  return (
    <>
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
        {/*
          Tolerance zones, drawn as concentric ellipses stacked largest-first
          so the fills layer into annular bands. Outside the red boundary = miss
          (no fill, emphasised by absence). The fills are deliberately muted so
          the data dots remain the visual focus.
        */}
        <ellipse cx={xToPx(0)} cy={yToPx(0)} rx={radPxX(bands.off)} ry={radPxY(bands.off)}
          fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.35)" strokeWidth="0.6" />
        <ellipse cx={xToPx(0)} cy={yToPx(0)} rx={radPxX(bands.near)} ry={radPxY(bands.near)}
          fill="rgba(251,191,36,0.10)" stroke="rgba(251,191,36,0.45)" strokeWidth="0.6" />
        <ellipse cx={xToPx(0)} cy={yToPx(0)} rx={radPxX(bands.centred)} ry={radPxY(bands.centred)}
          fill="rgba(74,222,128,0.14)" stroke="rgba(74,222,128,0.55)" strokeWidth="0.8" />

        {/* Zone labels — positioned at the top edge of each band */}
        <text x={xToPx(0)} y={yToPx(bands.centred) - 2} textAnchor="middle"
          style={{ fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 600, fill: 'rgba(74,222,128,0.9)', letterSpacing: '0.05em' }}>
          CENTRED
        </text>
        <text x={xToPx(0)} y={yToPx(bands.near) - 2} textAnchor="middle"
          style={{ fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 600, fill: 'rgba(251,191,36,0.9)', letterSpacing: '0.05em' }}>
          NEAR
        </text>
        <text x={xToPx(0)} y={yToPx(bands.off) - 2} textAnchor="middle"
          style={{ fontFamily: 'JetBrains Mono', fontSize: 7, fontWeight: 600, fill: 'rgba(239,68,68,0.9)', letterSpacing: '0.05em' }}>
          OFF
        </text>
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
        {shots.map((s, i) => {
          const c = classified[i];
          return (
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
                {s.ballSpeed != null ? convertSpeed(s.ballSpeed, units.speed).toFixed(1) : '—'} {speedLabel(units.speed)} · ({s.faceImpactH}, {s.faceImpactV})
                {c ? ` · ${c.distMm.toFixed(1)}mm from centre · ${(c.pctOfCentred * 100).toFixed(0)}% of centred zone` : ''}
              </title>
            </circle>
          );
        })}
        <circle cx={xToPx(meanH)} cy={yToPx(meanV)} r="2.5" fill="var(--text)" />
        <circle cx={xToPx(meanH)} cy={yToPx(meanV)} r="6" fill="none" stroke="var(--text)" strokeWidth="0.5" strokeDasharray="1 1" />
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
        <span style={{ color: 'var(--green)' }}>● {bandCount('centred')} centred</span>
        <span style={{ color: 'var(--amber)' }}>● {bandCount('near')} near</span>
        <span style={{ color: 'var(--red)' }}>● {bandCount('off') + bandCount('miss')} off+</span>
      </div>
      {shots.length >= 3 && (
        <div style={{ textAlign: 'center', marginTop: 6, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.05em', fontWeight: 500 }}>
          DASHED OUTLINE = CONSISTENCY ZONE · ~68% OF SHOTS · σ {Math.hypot(sdH, sdV).toFixed(1)}mm
        </div>
      )}
    </>
  );
}

/**
 * Strike zone summary. Each row is a tolerance band (Centred / Near / Off / Miss).
 * Critically, shots are classified by the band appropriate to their own club —
 * a 10mm-from-centre strike is "near" on an iron but well inside "centred" on
 * a driver. This avoids the previous flat 5/10/15mm thresholds which under-rated
 * driver strikes and over-rated wedge strikes.
 *
 * Ball-speed comparison is per-club: each shot's speed loss is computed against
 * the average of that club's centred strikes (its own best contact reference).
 */
function StrikeZoneTable({ shots, units }) {
  // Per-club: average ball speed of the club's centred-band shots. Used as the
  // benchmark for the speed-loss column. Falls back to "near" if a club has no
  // centred strikes; falls back to all-shots if neither.
  const centredBSByClub = {};
  const allClubs = [...new Set(shots.map((s) => s.club))];
  for (const c of allClubs) {
    const cs = shots.filter((s) => s.club === c);
    const centred = cs.filter((s) => {
      const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
      return cl && cl.band === 'centred';
    });
    const ref = centred.length >= 2 ? centred
      : cs.filter((s) => {
          const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
          return cl && (cl.band === 'centred' || cl.band === 'near');
        });
    centredBSByClub[c] = ref.length ? mean(ref.map((s) => s.ballSpeed)) : null;
  }

  // Per-club centred-shot carry — the reference distance each band is compared
  // against. Uses median rather than mean so a single freakishly long centred
  // strike doesn't make every other shot look bad. Same shape as centredBSByClub.
  const centredCarryByClub = {};
  for (const c of [...new Set(shots.map((s) => s.club))]) {
    const ref = shots.filter((s) => {
      const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
      return cl && cl.band === 'centred' && s.club === c && s.carry != null;
    });
    centredCarryByClub[c] = ref.length ? mean(ref.map((s) => s.carry)) : null;
  }

  const bands = ['centred', 'near', 'off', 'miss'];
  const labelByBand = {
    centred: 'CENTRED',
    near:    'NEAR CENTRE',
    off:     'OFF CENTRE',
    miss:    'MISS',
  };

  // Bucket every shot into its band
  const byBand = { centred: [], near: [], off: [], miss: [] };
  for (const s of shots) {
    const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
    if (cl) byBand[cl.band].push(s);
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>ZONE</th>
          <th className="num">SHOTS</th>
          <th className="num">% OF TOTAL</th>
          <th className="num">AVG DIST FROM CENTRE</th>
          <th className="num">CONSISTENCY (σ)</th>
          <th className="num">AVG BALL SPEED</th>
          <th className="num">CARRY VS CENTRED</th>
          <th className="num">AVG SMASH</th>
          <th className="num">AVG CARRY</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((b) => {
          const zShots = byBand[b];
          if (!zShots.length) return null;
          const dists = zShots.map((s) => classifyStrike(s.club, s.faceImpactH, s.faceImpactV).distMm);
          // Consistency: combined σ of impact location within this band. Tight =
          // shots cluster in roughly the same spot; loose = spraying within the
          // band. Useful even for "off" — tight off shots reveal a systematic
          // miss pattern, loose off shots reveal random inconsistency.
          const sigmaH = stdev(zShots.map((s) => s.faceImpactH));
          const sigmaV = stdev(zShots.map((s) => s.faceImpactV));
          const sigma = Math.hypot(sigmaH, sigmaV);
          const bs = mean(zShots.map((s) => s.ballSpeed));
          const sm = mean(zShots.map((s) => s.efficiency).filter((v) => v != null));
          const ca = mean(zShots.map((s) => s.carry).filter((v) => v != null));
          // Per-shot carry loss vs that shot's club's centred carry reference,
          // then averaged. Carry is the user-meaningful metric — the actual
          // yardage lost on course. Ball-speed loss was a proxy that didn't
          // map cleanly to "how much shorter will this go".
          const perShotLosses = zShots
            .map((s) => {
              const ref = centredCarryByClub[s.club];
              if (!ref || s.carry == null) return null;
              return ((s.carry - ref) / ref) * 100;
            })
            .filter((v) => v != null);
          const diff = perShotLosses.length ? mean(perShotLosses) : null;
          return (
            <tr key={b}>
              <td>{labelByBand[b]}</td>
              <td className="num">{zShots.length}</td>
              <td className="num">{((zShots.length / shots.length) * 100).toFixed(0)}%</td>
              <td className="num">{mean(dists).toFixed(1)} mm</td>
              <td className="num">{zShots.length >= 3 ? `± ${sigma.toFixed(1)} mm` : '—'}</td>
              <td className="num">{convertSpeed(bs, units.speed).toFixed(1)} {speedLabel(units.speed)}</td>
              <td
                className="num"
                style={{ color: diff != null && diff < -4 ? 'var(--red)' : diff != null && diff < -1.5 ? 'var(--amber)' : 'var(--green)' }}
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

/**
 * Tolerance reference card. Shows the centred / near / off thresholds for each
 * club category, so the user understands what "10mm out" actually means in
 * context. Values are read from the same source (benchmarks.js STRIKE_BANDS)
 * that all the analysis uses, so the displayed numbers always match the maths.
 */
function ToleranceReference() {
  const cats = [
    { key: 'driver', label: 'Driver',     example: 'Dr' },
    { key: 'wood',   label: 'Fairway woods', example: '3w' },
    { key: 'hybrid', label: 'Hybrids',    example: '4h' },
    { key: 'iron',   label: 'Irons',      example: '7i' },
    { key: 'wedge',  label: 'Wedges',     example: 'PW' },
  ];
  return (
    <>
      <table className="data-table">
        <thead>
          <tr>
            <th>CLUB CATEGORY</th>
            <th className="num">CENTRED ≤</th>
            <th className="num">NEAR ≤</th>
            <th className="num">OFF ≤</th>
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => {
            const b = getStrikeBands(c.example);
            return (
              <tr key={c.key}>
                <td>{c.label}</td>
                <td className="num" style={{ color: 'var(--green)' }}>{b.centred} mm</td>
                <td className="num" style={{ color: 'var(--amber)' }}>{b.near} mm</td>
                <td className="num" style={{ color: 'var(--red)' }}>{b.off} mm</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
        Distance is measured from the geometric centre of the face — combined toe-heel and low-high.{' '}
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>Centred</span> is the pure-energy-transfer zone where ball-speed loss is essentially zero.{' '}
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Near</span> shots typically cost 1-3% ball speed.{' '}
        <span style={{ color: 'var(--red)', fontWeight: 600 }}>Off</span> shots cost 3-8% — that's 5-15 yards on a 7-iron.{' '}
        Beyond that is a miss; expect bigger losses and worse dispersion.
      </div>
    </>
  );
}
