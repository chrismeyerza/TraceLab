import { useMemo } from 'react';
import { clubColor, orderedClubs } from '../lib/clubs';
import { summarize, mean, max, stdev } from '../lib/stats';
import { convertDistance, convertSpeed, distLabel, speedLabel } from '../lib/units';
import { getWindow, classifyStrike } from '../data/benchmarks';
import { classifyShape, bucketShape, formatPath } from '../lib/shape';
import Insight from '../components/Insight';

/**
 * Overview is the landing page. Two cards:
 *   1. Per-club averages table (ball speed, smash, carry, spin, strike centroid)
 *   2. Auto-generated insights driven by the data
 */
export default function OverviewView({ shots, sessions, rightHanded, units }) {
  const recentSession = sessions[0];

  const byClub = useMemo(() => {
    const m = {};
    shots.forEach((s) => {
      if (!m[s.club]) m[s.club] = [];
      m[s.club].push(s);
    });
    return m;
  }, [shots]);

  const orderedEntries = useMemo(
    () => orderedClubs(Object.keys(byClub)).map((c) => [c, byClub[c]]),
    [byClub]
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Overview.</span> All data, key metrics.
        </h1>
        <div className="page-meta">
          <div>
            {shots.length} SHOTS · {Object.keys(byClub).length} CLUBS
          </div>
          <div>
            {sessions.length} SESSIONS · UPDATED{' '}
            {recentSession?.date ? new Date(recentSession.date).toLocaleDateString('en-GB') : '—'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">01</span>By club · typical values
          </div>
          <div className="card-subtitle">10% trimmed mean (outliers dropped) · matches Flight & Distance views</div>
        </div>
        <div style={{ margin: '0 -20px' }}>
          <div className="club-summary header">
            <div>CLUB</div>
            <div>SHOTS</div>
            <div>BALL SPEED</div>
            <div>SMASH</div>
            <div>CARRY</div>
            <div>SPIN</div>
            <div>STRIKE</div>
          </div>
          {orderedEntries.map(([club, clubShots]) => {
            const bs = summarize(clubShots, 'ballSpeed');
            const sm = summarize(clubShots, 'efficiency');
            const ca = summarize(clubShots, 'carry');
            const sp = summarize(clubShots, 'totalSpin');
            const fih = summarize(clubShots, 'faceImpactH');
            const fiv = summarize(clubShots, 'faceImpactV');
            const w = getWindow(club);
            // Display the 10% trimmed mean (drops top + bottom 10% of values,
            // averages the rest). Outlier-robust without sacrificing data the
            // way a median would. The σ is the FULL-sample standard deviation
            // — spread should reflect outliers since that's the variability
            // story we're telling.
            const bsDisp = bs ? convertSpeed(bs.trimmedMean, units.speed) : null;
            const bsSdDisp = bs ? convertSpeed(bs.stdev, units.speed) : 0;
            const caDisp = ca ? convertDistance(ca.trimmedMean, units.distance) : null;
            const caSdDisp = ca ? convertDistance(ca.stdev, units.distance) : 0;
            return (
              <div className="club-summary" key={club}>
                <div className="club-summary-name" style={{ color: clubColor(club) }}>{club}</div>
                <div className="club-summary-cell">
                  <div className="v">{clubShots.length}</div>
                  <div className="l">shots</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">
                    {bsDisp != null ? bsDisp.toFixed(1) : '—'}{' '}
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>±{bsSdDisp.toFixed(1)}</span>
                  </div>
                  <div className="l">{speedLabel(units.speed)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{sm ? sm.trimmedMean.toFixed(2) : '—'}</div>
                  <div className="l">{benchmark(sm?.trimmedMean, w.smash)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">
                    {caDisp != null ? caDisp.toFixed(1) : '—'}{' '}
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>±{caSdDisp.toFixed(1)}</span>
                  </div>
                  <div className="l">{distLabel(units.distance)} carry</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{sp ? Math.round(sp.trimmedMean).toLocaleString() : '—'}</div>
                  <div className="l">{benchmark(sp?.trimmedMean, w.spin)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{fih && fiv ? `${fih.trimmedMean.toFixed(1)},${fiv.trimmedMean.toFixed(1)}` : '—'}</div>
                  <div className="l">centroid mm</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">02</span>What the data says
          </div>
          <div className="card-subtitle">Auto-generated from your shots · grouped by analytical pillar</div>
        </div>
        <Insights shots={shots} byClub={byClub} rightHanded={rightHanded} units={units} />
      </div>
    </>
  );
}

/** Coloured pill showing if a value is in/out of its optimal range. */
function benchmark(value, window) {
  if (value == null) return '—';
  const [absMin, idealLow, idealHigh, absMax] = window;
  let tag, label;
  if (value < absMin || value > absMax) {
    tag = 'poor';
    label = 'OUT';
  } else if (value >= idealLow && value <= idealHigh) {
    tag = 'good';
    label = 'IN RANGE';
  } else {
    tag = 'mid';
    label = value < idealLow ? 'LOW' : 'HIGH';
  }
  return <span className={`bench-tag ${tag}`}>{label}</span>;
}

// ============================================================================
// Insights: analytical rules organised by pillar.
//
// Five pillars cover the full game: Strike, Flight, Distance, Shape, and
// Consistency. Each rule function takes context and returns zero or more
// insight objects. Insight = { level, title, body }, where level ∈ ('', 'warn',
// 'bad') styles the left-border accent in the UI.
//
// Design goals:
//   - Variety: every rule belongs to exactly one pillar, capped per-pillar so
//     no single area drowns out the others
//   - Per-club specificity: most rules emit per-club insights rather than
//     bag-wide aggregates, because that's what's actionable
//   - Guardrails: every rule requires a minimum shot count to fire (typically
//     5 per club) so we don't hallucinate insights from 2-shot noise
//   - Honesty: we don't manufacture an insight if the data doesn't support
//     one. An empty pillar is fine.
// ============================================================================
const PER_PILLAR_CAP = 3; // max insights shown per pillar
const MIN_SHOTS_PER_CLUB = 5; // minimum data for per-club rules to fire

const PILLARS = [
  { key: 'strike',      label: 'Strike',       accent: 'var(--red)' },
  { key: 'flight',      label: 'Flight',       accent: 'var(--amber)' },
  { key: 'distance',    label: 'Distance',     accent: 'var(--green)' },
  { key: 'shape',       label: 'Shape',        accent: 'var(--blue)' },
  { key: 'consistency', label: 'Consistency',  accent: '#a78bfa' },
];

function Insights({ shots, byClub, rightHanded, units }) {
  const itemsByPillar = useMemo(() => {
    const out = { strike: [], flight: [], distance: [], shape: [], consistency: [] };

    // -------- STRIKE PILLAR ----------------------------------------------
    Object.entries(byClub).forEach(([club, clubShots]) => {
      if (clubShots.length < MIN_SHOTS_PER_CLUB) return;
      const withStrike = clubShots.filter((s) => s.faceImpactH != null && s.faceImpactV != null);
      if (withStrike.length < MIN_SHOTS_PER_CLUB) return;

      // Single consolidated strike-quality insight per club, instead of three
      // separate rules (cost / horizontal bias / vertical bias) that all fired
      // on the same problem and crowded out other pillars.
      const classified = withStrike.map((s) => ({
        s, c: classifyStrike(s.club, s.faceImpactH, s.faceImpactV),
      })).filter((x) => x.c);
      const centred = classified.filter((x) => x.c.band === 'centred').map((x) => x.s);
      // "Off" for this insight means strikes that genuinely cost ball speed:
      // heel/toe (gear effect, energy loss) and high-face (added dynamic loft).
      // Low-face strikes are excluded — they're often the strongest iron
      // strikes, not a problem worth flagging.
      const off = classified.filter((x) => x.c.band === 'heel-toe' || x.c.band === 'high').map((x) => x.s);
      const offPct = (off.length / classified.length) * 100;
      const centredBS = centred.length ? mean(centred.map((s) => s.ballSpeed)) : null;
      const offBS = off.length ? mean(off.map((s) => s.ballSpeed)) : null;
      const meanH = mean(withStrike.map((s) => s.faceImpactH));
      const meanV = mean(withStrike.map((s) => s.faceImpactV));

      if (offPct >= 25 && centredBS && offBS) {
        const lossPct = ((centredBS - offBS) / centredBS) * 100;
        const meanCarry = mean(clubShots.map((s) => s.carry).filter((c) => c != null));
        const carryLossYds = lossPct > 0 ? lossPct * 0.013 * meanCarry : 0;
        const dirBits = [];
        if (Math.abs(meanH) > 4) dirBits.push(`${Math.abs(meanH).toFixed(1)}mm ${meanH > 0 ? 'heel' : 'toe'}`);
        if (Math.abs(meanV) > 4) dirBits.push(`${Math.abs(meanV).toFixed(1)}mm ${meanV > 0 ? 'high' : 'low'}`);
        out.strike.push({
          level: offPct > 40 ? 'bad' : 'warn',
          title: `${club} · Strike quality`,
          body: (
            <>
              <span className="num">{offPct.toFixed(0)}%</span> of strikes are off-centre or worse.
              {dirBits.length > 0 && <> Average bias: <span className="num">{dirBits.join(' · ')}</span>.</>}
              {lossPct > 1 && (
                <> Off-centre strikes cost ~<span className="num">{lossPct.toFixed(1)}%</span> ball speed —
                roughly <span className="num">{convertDistance(carryLossYds, units.distance).toFixed(1)} {distLabel(units.distance)}</span> of carry.</>
              )}
            </>
          ),
        });
      }
    });

    // -------- FLIGHT PILLAR -----------------------------------------------
    // Per-club checks against published optimal windows for launch, spin,
    // descent angle. These windows are 4-tuples: [absMin, idealLow, idealHigh, absMax].
    // We surface insights when the mean is outside the [idealLow, idealHigh] core.
    Object.entries(byClub).forEach(([club, clubShots]) => {
      if (clubShots.length < MIN_SHOTS_PER_CLUB) return;
      const w = getWindow(club);

      const launches = clubShots.map((s) => s.launchAngle).filter((v) => v != null);
      if (launches.length >= MIN_SHOTS_PER_CLUB) {
        const m = mean(launches);
        if (m < w.launch[1]) {
          out.flight.push({
            level: m < w.launch[0] ? 'bad' : 'warn',
            title: `${club} · Launch low`,
            body: (
              <>
                Launching at <span className="num">{m.toFixed(1)}°</span>, optimal{' '}
                <span className="num">{w.launch[1]}–{w.launch[2]}°</span>. Lower-launching shots run more and hold less green — usually a steep AoA or de-lofted face.
              </>
            ),
          });
        } else if (m > w.launch[2]) {
          out.flight.push({
            level: m > w.launch[3] ? 'bad' : 'warn',
            title: `${club} · Launch high`,
            body: (
              <>
                Launching at <span className="num">{m.toFixed(1)}°</span>, optimal{' '}
                <span className="num">{w.launch[1]}–{w.launch[2]}°</span>. High launch costs distance — usually a scoopy release or added loft at impact.
              </>
            ),
          });
        }
      }

      const spins = clubShots.map((s) => s.totalSpin).filter((v) => v != null);
      if (spins.length >= MIN_SHOTS_PER_CLUB) {
        const m = mean(spins);
        if (m < w.spin[1]) {
          out.flight.push({
            level: m < w.spin[0] ? 'bad' : 'warn',
            title: `${club} · Spin low`,
            body: (
              <>
                Spinning <span className="num">{Math.round(m).toLocaleString()}</span> rpm, optimal{' '}
                <span className="num">{w.spin[1].toLocaleString()}–{w.spin[2].toLocaleString()}</span>. Low spin = won't hold a green and runs unpredictably.
              </>
            ),
          });
        } else if (m > w.spin[2]) {
          out.flight.push({
            level: m > w.spin[3] ? 'bad' : 'warn',
            title: `${club} · Spin high`,
            body: (
              <>
                Spinning <span className="num">{Math.round(m).toLocaleString()}</span> rpm, optimal{' '}
                <span className="num">{w.spin[1].toLocaleString()}–{w.spin[2].toLocaleString()}</span>. High spin balloons trajectory and costs distance.
              </>
            ),
          });
        }
      }

      const descents = clubShots.map((s) => s.descentAngle).filter((v) => v != null);
      if (descents.length >= MIN_SHOTS_PER_CLUB) {
        const m = mean(descents);
        // Only flag low descent for irons/wedges (where green-holding matters).
        // Driver/woods are fine with shallow descent.
        const isIronOrWedge = /^([2-9]i|[2-9]h|PW|GW|SW|LW)$/.test(club) || /^\d+°$/.test(club);
        if (isIronOrWedge && m < w.descent[1]) {
          out.flight.push({
            level: m < w.descent[0] ? 'bad' : 'warn',
            title: `${club} · Descent shallow`,
            body: (
              <>
                Landing at <span className="num">{m.toFixed(1)}°</span>, optimal{' '}
                <span className="num">{w.descent[1]}–{w.descent[2]}°</span>. Under 40° won't hold a green from full distance.
              </>
            ),
          });
        }
      }
    });

    // -------- DISTANCE PILLAR ---------------------------------------------
    // Two rule families: cost-of-poor-strikes per club, and gap problems.
    Object.entries(byClub).forEach(([club, clubShots]) => {
      const allCarries = clubShots.map((s) => s.carry).filter((v) => v != null);
      if (allCarries.length < MIN_SHOTS_PER_CLUB) return;
      const withStrike = clubShots.filter((s) => s.faceImpactH != null && s.faceImpactV != null);
      const classified = withStrike.map((s) => ({ s, c: classifyStrike(s.club, s.faceImpactH, s.faceImpactV) })).filter((x) => x.c);
      const centred = classified.filter((x) => x.c.band === 'centred').map((x) => x.s);
      if (centred.length < 3) return;
      const centredCarries = centred.map((s) => s.carry).filter((v) => v != null);
      const allMean = mean(allCarries);
      const centredMean = mean(centredCarries);
      const gain = centredMean - allMean;
      if (gain > 4) {
        out.distance.push({
          level: gain > 10 ? 'warn' : '',
          title: `${club} · Strike-quality cost`,
          body: (
            <>
              You'd carry <span className="num">+{convertDistance(gain, units.distance).toFixed(1)} {distLabel(units.distance)}</span> if every strike was centred —
              your average is <span className="num">{convertDistance(allMean, units.distance).toFixed(0)} {distLabel(units.distance)}</span>, your centred strikes go{' '}
              <span className="num">{convertDistance(centredMean, units.distance).toFixed(0)} {distLabel(units.distance)}</span>.
            </>
          ),
        });
      }
    });

    // Gap problems — adjacent clubs in the ladder within 5 yds of each other.
    // Use smart-carry (centred + low) where possible; fall back to all-shots.
    // Matches the Distance view's cohort definition.
    const carriesByClub = {};
    Object.entries(byClub).forEach(([club, clubShots]) => {
      const all = clubShots.map((s) => s.carry).filter((v) => v != null);
      if (all.length < MIN_SHOTS_PER_CLUB) return;
      const withStrike = clubShots.filter((s) => s.faceImpactH != null && s.faceImpactV != null);
      const classified = withStrike.map((s) => ({ s, c: classifyStrike(s.club, s.faceImpactH, s.faceImpactV) })).filter((x) => x.c);
      const smart = classified.filter((x) => x.c.band === 'centred' || x.c.band === 'low').map((x) => x.s);
      const smartCarries = smart.map((s) => s.carry).filter((v) => v != null);
      const carry = smartCarries.length >= 3 ? mean(smartCarries) : mean(all);
      carriesByClub[club] = { carry, source: smartCarries.length >= 3 ? 'smart' : 'all' };
    });
    const ladder = Object.entries(carriesByClub)
      .map(([club, info]) => ({ club, ...info }))
      .sort((a, b) => b.carry - a.carry);
    for (let i = 0; i < ladder.length - 1; i++) {
      const a = ladder[i];
      const b = ladder[i + 1];
      const gap = a.carry - b.carry;
      if (gap < 5) {
        out.distance.push({
          level: gap < 3 ? 'warn' : '',
          title: `${a.club} ↔ ${b.club} · Gap problem`,
          body: (
            <>
              <span className="num">{convertDistance(gap, units.distance).toFixed(1)} {distLabel(units.distance)}</span> between these two clubs — they're doing the same job. Worth checking lofts or fitting.
            </>
          ),
        });
      }
    }

    // -------- SHAPE PILLAR ------------------------------------------------
    // Dominant shape (kept from before) + face-to-path bias per club.
    const shapeShots = shots.filter((s) => s.faceToTarget != null && s.clubPath != null);
    if (shapeShots.length >= MIN_SHOTS_PER_CLUB) {
      const shapes = shapeShots.map((s) => bucketShape(classifyShape(s.faceToTarget, s.clubPath, rightHanded).name));
      const counts = {};
      shapes.forEach((sh) => { counts[sh] = (counts[sh] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      const pct = (top[1] / shapes.length) * 100;
      if (top[0] !== 'Straight' && pct > 30) {
        out.shape.push({
          level: pct > 50 ? 'warn' : '',
          title: `Dominant shape · ${top[0]}`,
          body: (
            <>
              <span className="num">{pct.toFixed(0)}%</span> of your shots end up here.{' '}
              {top[0].includes('Slice') || top[0].includes('Fade')
                ? 'Your face is open relative to your path. Either close the face or swing more left for a RH player.'
                : top[0].includes('Hook') || top[0].includes('Draw')
                ? 'Your face is closed relative to your path. Check grip strength and release timing.'
                : ''}
            </>
          ),
        });
      }
    }

    // Per-club path & face-to-path bias
    Object.entries(byClub).forEach(([club, clubShots]) => {
      const paths = clubShots.map((s) => s.clubPath).filter((v) => v != null);
      const ftps = clubShots.map((s) => s.faceToPath).filter((v) => v != null);
      if (paths.length < MIN_SHOTS_PER_CLUB) return;
      const meanPath = mean(paths);
      const meanFtp = ftps.length ? mean(ftps) : null;

      if (Math.abs(meanPath) > 3) {
        out.shape.push({
          level: Math.abs(meanPath) > 5 ? 'warn' : '',
          title: `${club} · Path bias`,
          body: (
            <>
              Average path is <span className="num">{formatPath(meanPath)}</span>.{' '}
              {meanPath > 0
                ? 'Strong in-to-out path — promotes a draw or push. Useful with a square face; problematic when the face lags closed.'
                : 'Strong out-to-in path — promotes a fade or pull. Common with over-the-top moves.'}
            </>
          ),
        });
      }
      if (meanFtp != null && Math.abs(meanFtp) > 2) {
        out.shape.push({
          level: Math.abs(meanFtp) > 4 ? 'warn' : '',
          title: `${club} · Face-to-Path`,
          body: (
            <>
              Average face-to-path is <span className="num">{meanFtp > 0 ? '+' : ''}{meanFtp.toFixed(1)}°</span> — this is the curve generator.{' '}
              {meanFtp > 0 ? 'Consistent open-to-path delivery means fade/slice curve.' : 'Consistent closed-to-path delivery means draw/hook curve.'}
            </>
          ),
        });
      }
    });

    // -------- CONSISTENCY PILLAR ------------------------------------------
    // Repeatability metrics — σ in carry, σ in strike location, σ in path.
    // Pulled out as its own pillar because "tighter > longer" for scoring.
    Object.entries(byClub).forEach(([club, clubShots]) => {
      if (clubShots.length < MIN_SHOTS_PER_CLUB + 2) return; // need a bit more for σ to be meaningful

      const carries = clubShots.map((s) => s.carry).filter((v) => v != null);
      if (carries.length >= MIN_SHOTS_PER_CLUB) {
        const sd = stdev(carries);
        const m = mean(carries);
        const cv = (sd / m) * 100;
        if (cv > 8) {
          out.consistency.push({
            level: cv > 14 ? 'warn' : '',
            title: `${club} · Carry inconsistency`,
            body: (
              <>
                Carry σ is <span className="num">±{convertDistance(sd, units.distance).toFixed(1)} {distLabel(units.distance)}</span> ({cv.toFixed(0)}% of mean).{' '}
                Tightening dispersion here is usually more valuable for scoring than gaining distance.
              </>
            ),
          });
        }
      }

      const paths = clubShots.map((s) => s.clubPath).filter((v) => v != null);
      if (paths.length >= MIN_SHOTS_PER_CLUB) {
        const sd = stdev(paths);
        if (sd > 3) {
          out.consistency.push({
            level: sd > 5 ? 'warn' : '',
            title: `${club} · Path variability`,
            body: (
              <>
                Club path varies <span className="num">±{sd.toFixed(1)}°</span> shot-to-shot — that's the reason your shape is unpredictable. Same swing delivers different paths means timing or sequencing issue.
              </>
            ),
          });
        }
      }
    });

    // Sort each pillar: bad first, then warn, then info; cap at PER_PILLAR_CAP
    const order = { bad: 0, warn: 1, '': 2 };
    for (const pillar of Object.keys(out)) {
      out[pillar].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
      out[pillar] = out[pillar].slice(0, PER_PILLAR_CAP);
    }
    return out;
  }, [shots, byClub, rightHanded, units]);

  const totalCount = Object.values(itemsByPillar).reduce((a, p) => a + p.length, 0);
  if (totalCount === 0) {
    return <div className="empty-state-sub" style={{ padding: 20 }}>Load more shots to unlock insights.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {PILLARS.map((p) => {
        const items = itemsByPillar[p.key];
        if (!items.length) return null;
        return (
          <div key={p.key}>
            <div style={{
              fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700,
              color: p.accent, letterSpacing: '0.14em',
              textTransform: 'uppercase', marginBottom: 10,
              paddingBottom: 7, borderBottom: `1px solid ${p.accent}55`,
            }}>
              {p.label} · {items.length}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((ins, i) => (
                <Insight key={i} level={ins.level} title={ins.title}>
                  {ins.body}
                </Insight>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
