import { useMemo } from 'react';
import { clubColor, orderedClubs } from '../lib/clubs';
import { mean, stdev } from '../lib/stats';
import { convertDistance, distLabel } from '../lib/units';
import { classifyStrike, getWindow } from '../data/benchmarks';

/**
 * Distance view: how far you actually hit each club, with strike-aware cohorts.
 *
 * The killer idea: a single "average carry" number is misleading because it
 * mashes pure strikes together with mishits. We split each club into three
 * cohorts and present all three so the user can see their best, their
 * realistic playing distance, and their honest baseline.
 *
 *   All shots             — the unfiltered number. Honest but includes mishits.
 *   Centred + Near (smart) — what you can rely on. Use this for course strategy.
 *   Centred only           — your ceiling. The distance when everything's right.
 *
 * Each row shows N, carry, total, run, and ±1σ range. The σ shrinks as you
 * tighten the cohort, which is itself the data story: "your good strikes are
 * tight, your bad ones are wild".
 *
 * Below the per-club table, a gapping ladder visualises smart-carry per club
 * with overlap detection. Two adjacent clubs that carry within ~5 yards of
 * each other are flagged as a gap problem — useless redundancy in the bag.
 *
 * At the bottom, a "cost of poor strikes" callout per club: the gap between
 * Centred-only carry and All carry, expressed as "if you cleaned this up,
 * you'd be carrying X more yards".
 */
export default function DistanceView({ shots, units }) {
  const clubs = orderedClubs([...new Set(shots.map((s) => s.club))]);
  const validShots = shots.filter((s) => s.carry != null);

  // Group shots once, per club, into the three cohorts. Reused by both the
  // table and the gapping ladder so the analysis is consistent.
  // Smart = "Centred + Low" — under the new H/V strike model (PR 4.14),
  // low-face strikes on irons often produce the player's best ball-speed
  // strikes (lower dynamic loft, more efficient energy transfer). Pooling
  // them with centred gives a more honest reliable-yardage baseline than
  // centred-only on small samples.
  const cohortsByClub = useMemo(() => {
    const map = {};
    for (const club of clubs) {
      const all = validShots.filter((s) => s.club === club);
      // Cohort membership depends on strike classification — shots without
      // face-impact data (typically the FLT_MAX partial-shot pattern) can't
      // be classified at all, so they ONLY contribute to "All shots".
      const withClass = all.map((s) => ({
        s,
        cl: classifyStrike(s.club, s.faceImpactH, s.faceImpactV),
      }));
      const centred = withClass.filter((x) => x.cl?.band === 'centred').map((x) => x.s);
      const low     = withClass.filter((x) => x.cl?.band === 'low').map((x) => x.s);
      const smart   = [...centred, ...low];
      map[club] = { all, smart, centred };
    }
    return map;
  }, [clubs, validShots]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Distance.</span> How far you actually hit it.
        </h1>
        <div className="page-meta">
          <div>{validShots.length} SHOTS WITH CARRY DATA · {clubs.length} CLUBS</div>
          <div>SMART = CENTRED + NEAR · STRIKE-AWARE</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">01</span>About these numbers
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          Every commercial launch monitor reports "your average carry" with a single number that mashes pure strikes
          together with toe-heel mishits. That number is honest but useless for course strategy — it's biased downward
          by your worst shots.
          <br /><br />
          We split each club's shots three ways. <strong style={{ color: 'var(--text-strong)' }}>All shots</strong> is the
          honest baseline. <strong style={{ color: 'var(--green)' }}>Smart</strong> keeps centred + low-face strikes
          and drops high-face / heel/toe — your realistic playing distance, the number to use for club selection on course.
          <strong style={{ color: 'var(--text-strong)' }}> Centred only</strong> shows your ceiling: what you carry when you
          truly flush it. Cohorts use the per-club H/V strike bands from the Strike view.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">02</span>Carry & total by club
          </div>
          <div className="card-subtitle">All shots · Smart (centred + low) · Centred only · per club</div>
        </div>
        <DistanceTable cohortsByClub={cohortsByClub} clubs={clubs} units={units} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">
            <span className="num">03</span>Gapping ladder
          </div>
          <div className="card-subtitle">
            Smart-carry per club · adjacent clubs within {convertDistance(5, units.distance).toFixed(0)} {distLabel(units.distance)} are flagged
          </div>
        </div>
        <GappingLadder cohortsByClub={cohortsByClub} clubs={clubs} units={units} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="num">04</span>Cost of poor strikes
          </div>
          <div className="card-subtitle">How much carry distance you'd gain per club if you only hit centred strikes</div>
        </div>
        <CostOfPoorStrikes cohortsByClub={cohortsByClub} clubs={clubs} units={units} />
      </div>
    </>
  );
}

/**
 * The big per-club table. Three rows per club: All / Smart / Centred-only.
 * Rows with fewer than 3 shots in the cohort are dimmed and show "needs more
 * data" rather than misleading stats.
 */
function DistanceTable({ cohortsByClub, clubs, units }) {
  const conv = (v) => v == null ? null : convertDistance(v, units.distance);
  const fmt = (v, digits = 1) => v == null ? '—' : v.toFixed(digits);
  const dLabel = distLabel(units.distance);
  const COHORTS = [
    { key: 'all',     label: 'All shots',       tone: 'var(--text)' },
    { key: 'smart',   label: 'Smart',           tone: 'var(--green)' },
    { key: 'centred', label: 'Centred only',    tone: 'var(--blue)' },
  ];

  const w = (club) => getWindow(club); // for tour-benchmark column

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>CLUB</th>
          <th>COHORT</th>
          <th className="num">% · N</th>
          <th className="num">AVG CARRY</th>
          <th className="num">AVG TOTAL</th>
          <th className="num">AVG RUN</th>
          <th className="num">CARRY RANGE (±1σ)</th>
          <th className="num">TOUR REF</th>
        </tr>
      </thead>
      <tbody>
        {clubs.map((club) => {
          const cohorts = cohortsByClub[club];
          const tourCarry = w(club).carry?.[2]; // index 2 = tour amateur midpoint
          // Denominator for percentages: total shots for this club (All cohort).
          // So Smart's % is "of all the shots, this fraction are smart strikes",
          // not "of smart strikes, this fraction are smart strikes" (which would
          // always be 100). Same logic for Centred only.
          const totalForClub = cohorts.all.length;
          return COHORTS.map((c, idx) => {
            const cohortShots = cohorts[c.key];
            const enoughData = cohortShots.length >= 3;
            const carries = cohortShots.map((s) => s.carry).filter((v) => v != null);
            const totals  = cohortShots.map((s) => s.totalDist).filter((v) => v != null);
            const runs    = cohortShots.map((s) => s.runDistance).filter((v) => v != null);
            const carryMean = enoughData && carries.length ? mean(carries) : null;
            const carrySd   = enoughData && carries.length >= 3 ? stdev(carries) : null;
            const totalMean = enoughData && totals.length ? mean(totals) : null;
            const runMean   = enoughData && runs.length ? mean(runs) : null;
            const pct = totalForClub > 0 ? (cohortShots.length / totalForClub) * 100 : 0;
            return (
              <tr key={`${club}-${c.key}`} style={{
                opacity: enoughData ? 1 : 0.45,
                borderTop: idx === 0 ? '1px solid var(--border-strong)' : undefined,
              }}>
                {idx === 0 ? (
                  <td rowSpan={COHORTS.length} style={{ color: clubColor(club), fontWeight: 700, borderRight: '1px solid var(--border)', verticalAlign: 'top' }}>
                    {club}
                  </td>
                ) : null}
                <td style={{ color: c.tone, fontWeight: 600 }}>{c.label}</td>
                <td className="num">
                  <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  <span style={{ color: 'var(--text-faint)', fontWeight: 500, marginLeft: 6 }}>· {cohortShots.length}</span>
                </td>
                <td className="num">
                  {carryMean == null ? '—' : `${fmt(conv(carryMean))} ${dLabel}`}
                </td>
                <td className="num">
                  {totalMean == null ? '—' : `${fmt(conv(totalMean))} ${dLabel}`}
                </td>
                <td className="num">
                  {runMean == null ? '—' : `${fmt(conv(runMean))} ${dLabel}`}
                </td>
                <td className="num">
                  {carrySd == null ? (enoughData ? '—' : 'NEEDS MORE DATA') : `± ${fmt(conv(carrySd))} ${dLabel}`}
                </td>
                <td className="num" style={{ color: 'var(--text-faint)' }}>
                  {idx === 0 && tourCarry ? `${fmt(conv(tourCarry), 0)} ${dLabel}` : ''}
                </td>
              </tr>
            );
          });
        })}
      </tbody>
    </table>
  );
}

/**
 * Visual ladder of smart-carry distances. Each club gets a horizontal bar
 * starting at zero, ending at its smart-carry distance. Bars are sorted by
 * distance (longest first) and coloured by club. A gap-overlap warning chip
 * appears beside any club whose smart-carry is within 5 yards of an adjacent
 * club in the ladder.
 *
 * If a club doesn't have enough data for a smart cohort, it falls through to
 * showing the all-shots carry, with a small "FROM ALL SHOTS" tag noting the
 * fallback.
 */
function GappingLadder({ cohortsByClub, clubs, units }) {
  // Resolve a single carry number per club: smart if available, else all.
  const rows = clubs
    .map((club) => {
      const c = cohortsByClub[club];
      const smartCarries = c.smart.map((s) => s.carry).filter((v) => v != null);
      const allCarries = c.all.map((s) => s.carry).filter((v) => v != null);
      let carryYds = null;
      let source = null;
      if (smartCarries.length >= 3) {
        carryYds = mean(smartCarries);
        source = 'smart';
      } else if (allCarries.length >= 3) {
        carryYds = mean(allCarries);
        source = 'all';
      }
      return { club, carryYds, source };
    })
    .filter((r) => r.carryYds != null)
    .sort((a, b) => b.carryYds - a.carryYds);

  if (rows.length === 0) {
    return <div className="empty-state"><div className="empty-state-sub">No clubs have enough carry data yet.</div></div>;
  }

  const maxCarryYds = rows[0].carryYds;
  // Threshold for "gap problem" — 5 yds in user's preferred unit. Stored as
  // yds because that's the internal storage convention; converted at display.
  const GAP_THRESHOLD_YDS = 5;

  // Annotate each row with overlap status relative to its neighbours
  const annotated = rows.map((r, i) => {
    const above = rows[i - 1];
    const below = rows[i + 1];
    const gapAbove = above ? above.carryYds - r.carryYds : null;
    const gapBelow = below ? r.carryYds - below.carryYds : null;
    const tooClose = (gapAbove != null && gapAbove < GAP_THRESHOLD_YDS) ||
                     (gapBelow != null && gapBelow < GAP_THRESHOLD_YDS);
    return { ...r, gapAbove, gapBelow, tooClose };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {annotated.map((r) => {
        const pct = (r.carryYds / maxCarryYds) * 100;
        const displayCarry = convertDistance(r.carryYds, units.distance);
        return (
          <div key={r.club} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 110px 100px', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <div style={{ color: clubColor(r.club), fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>{r.club}</div>
            <div style={{ position: 'relative', height: 22, background: 'var(--bg-elev-1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: clubColor(r.club),
                opacity: 0.8,
                borderRadius: 3,
              }} />
              {r.tooClose && (
                <div style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700,
                  color: 'var(--amber)', letterSpacing: '0.05em',
                }}>
                  ⚠ GAP ISSUE
                </div>
              )}
            </div>
            <div className="num" style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: 'var(--text-strong)' }}>
              {displayCarry.toFixed(1)} {distLabel(units.distance)}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.05em', fontWeight: 500 }}>
              {r.source === 'all' ? 'FROM ALL SHOTS' : 'SMART CARRY'}
            </div>
          </div>
        );
      })}
      {annotated.some((r) => r.tooClose) && (
        <div style={{ marginTop: 14, padding: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 4, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Gap warning:</span> adjacent clubs carrying within {convertDistance(5, units.distance).toFixed(0)} {distLabel(units.distance)} of each other are doing the same job. Worth checking whether you actually need both, or whether one needs a setup tweak (loft, shaft, swing change).
        </div>
      )}
    </div>
  );
}

/**
 * Per-club callout showing what you'd gain by tightening strike quality.
 * Difference between centred-only carry and all-shots carry, expressed as
 * "if you cleaned this up, you'd be carrying X more yards on average".
 *
 * Negative numbers (centred-only < all) are theoretically possible when
 * you've only hit a few centred shots and they happen to be on the lower end
 * by chance — we suppress those to avoid suggesting that poor strikes go
 * further than good ones.
 */
function CostOfPoorStrikes({ cohortsByClub, clubs, units }) {
  const dLabel = distLabel(units.distance);
  const rows = clubs.map((club) => {
    const c = cohortsByClub[club];
    const allCarries = c.all.map((s) => s.carry).filter((v) => v != null);
    const centredCarries = c.centred.map((s) => s.carry).filter((v) => v != null);
    if (allCarries.length < 3 || centredCarries.length < 3) {
      return { club, status: 'insufficient' };
    }
    const allMean = mean(allCarries);
    const centredMean = mean(centredCarries);
    const gainYds = centredMean - allMean;
    if (gainYds <= 0) {
      // Either no strike penalty showing up in the data yet, or noise from
      // small samples. Either way not actionable; show neutral.
      return { club, status: 'neutral', allMean, centredMean };
    }
    return { club, status: 'gain', allMean, centredMean, gainYds };
  });

  const actionable = rows.filter((r) => r.status === 'gain').sort((a, b) => b.gainYds - a.gainYds);
  const others = rows.filter((r) => r.status !== 'gain');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {actionable.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--text-dim)', padding: 16, lineHeight: 1.5 }}>
            Not enough data to show meaningful strike-quality gains yet — keep logging sessions and this will sharpen up.
          </div>
        )}
        {actionable.map((r) => (
          <div key={r.club} style={{
            padding: 14,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${clubColor(r.club)}`,
            borderRadius: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: clubColor(r.club), fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13 }}>
                {r.club}
              </span>
              <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13 }}>
                +{convertDistance(r.gainYds, units.distance).toFixed(1)} {dLabel}
              </span>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.05em', fontWeight: 500 }}>
              {convertDistance(r.allMean, units.distance).toFixed(0)} → {convertDistance(r.centredMean, units.distance).toFixed(0)} {dLabel} on centred strikes
            </div>
          </div>
        ))}
      </div>
      {others.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)', fontFamily: 'JetBrains Mono', letterSpacing: '0.05em', fontWeight: 500 }}>
          {others.map((r) => r.club).join(' · ')} — not enough centred-strike data yet
        </div>
      )}
    </div>
  );
}
