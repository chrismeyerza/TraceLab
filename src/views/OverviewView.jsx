import { useMemo } from 'react';
import { clubColor, orderedClubs } from '../lib/clubs';
import { summarize, mean, max } from '../lib/stats';
import { convertDistance, convertSpeed, distLabel, speedLabel } from '../lib/units';
import { getWindow } from '../data/benchmarks';
import { classifyShape, bucketShape } from '../lib/shape';
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
            <span className="num">01</span>By club · averages
          </div>
          <div className="card-subtitle">Smash · Carry · Launch · Spin · Descent · Strike</div>
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
            const bsDisp = bs ? convertSpeed(bs.mean, units.speed) : null;
            const bsSdDisp = bs ? convertSpeed(bs.stdev, units.speed) : 0;
            const caDisp = ca ? convertDistance(ca.mean, units.distance) : null;
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
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>±{bsSdDisp.toFixed(1)}</span>
                  </div>
                  <div className="l">{speedLabel(units.speed)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{sm ? sm.mean.toFixed(2) : '—'}</div>
                  <div className="l">{benchmark(sm?.mean, w.smash)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">
                    {caDisp != null ? caDisp.toFixed(1) : '—'}{' '}
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>±{caSdDisp.toFixed(1)}</span>
                  </div>
                  <div className="l">{distLabel(units.distance)} carry</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{sp ? Math.round(sp.mean).toLocaleString() : '—'}</div>
                  <div className="l">{benchmark(sp?.mean, w.spin)}</div>
                </div>
                <div className="club-summary-cell">
                  <div className="v">{fih && fiv ? `${fih.mean.toFixed(1)},${fiv.mean.toFixed(1)}` : '—'}</div>
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
          <div className="card-subtitle">Auto-generated from your shots</div>
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

/**
 * Run analytical rules across the data set and surface up to 6 noteworthy
 * findings. Rules: strike cost in ball speed/carry, strike bias (toe/heel),
 * vertical strike pattern, dominant shape, low smash per club.
 */
function Insights({ shots, byClub, rightHanded, units }) {
  const items = useMemo(() => {
    const out = [];

    // Per-club strike-pattern checks
    Object.entries(byClub).forEach(([club, clubShots]) => {
      const h = clubShots.map((s) => s.faceImpactH).filter((v) => v != null);
      const v = clubShots.map((s) => s.faceImpactV).filter((v) => v != null);
      if (h.length < 3) return;

      const meanH = mean(h);
      const meanV = mean(v);

      const offCentre = clubShots.filter((s) => s.faceImpactH != null && Math.abs(s.faceImpactH) > 10);
      const offBS = offCentre.length ? mean(offCentre.map((s) => s.ballSpeed)) : null;
      const centre = clubShots.filter((s) => s.faceImpactH != null && Math.abs(s.faceImpactH) <= 5);
      const centreBS = centre.length ? mean(centre.map((s) => s.ballSpeed)) : null;

      if (offBS && centreBS) {
        const lossPct = ((centreBS - offBS) / centreBS) * 100;
        if (lossPct > 2) {
          const meanCarry = mean(clubShots.map((s) => s.carry).filter((c) => c != null));
          const carryLossYds = lossPct * 0.013 * meanCarry;
          out.push({
            level: lossPct > 5 ? 'bad' : 'warn',
            title: `${club} · STRIKE COST`,
            body: (
              <>
                Your off-centre strikes (&gt;10mm from face centre) average{' '}
                <span className="num">{convertSpeed(offBS, units.speed).toFixed(1)} {speedLabel(units.speed)}</span> ball
                speed vs{' '}
                <span className="num">{convertSpeed(centreBS, units.speed).toFixed(1)} {speedLabel(units.speed)}</span>{' '}
                on centred strikes. That's a <span className="num">{lossPct.toFixed(1)}%</span> loss — roughly{' '}
                <span className="num">
                  {convertDistance(carryLossYds, units.distance).toFixed(1)} {distLabel(units.distance)}
                </span>{' '}
                of carry per off-centre strike.
              </>
            ),
          });
        }
      }

      if (h.length >= 5 && Math.abs(meanH) > 4) {
        const side = meanH > 0 ? 'heel' : 'toe';
        out.push({
          level: 'warn',
          title: `${club} · STRIKE BIAS`,
          body: (
            <>
              Your average impact is{' '}
              <span className="num">{Math.abs(meanH).toFixed(1)}mm {side}-side</span> of centre.{' '}
              {side === 'toe'
                ? 'Toe strikes promote a draw bias and lose ball speed — check setup distance and posture.'
                : 'Heel strikes are the more common amateur miss, often caused by standing too close or early extension.'}
            </>
          ),
        });
      }

      if (v.length >= 5 && Math.abs(meanV) > 4) {
        const where = meanV > 0 ? 'high' : 'low';
        out.push({
          level: 'warn',
          title: `${club} · VERTICAL STRIKE`,
          body: (
            <>
              You're striking <span className="num">{Math.abs(meanV).toFixed(1)}mm {where}</span> on the face.{' '}
              {where === 'low'
                ? 'Low strikes mean steeper attack angle or stance changes — they spin more and fly lower than they should.'
                : 'High strikes give you more launch and less spin (gear effect) — fine on drivers, not ideal on irons.'}
            </>
          ),
        });
      }
    });

    // Dominant shape across all shots
    const shapeShots = shots.filter((s) => s.faceToTarget != null && s.clubPath != null);
    if (shapeShots.length >= 5) {
      const shapes = shapeShots.map((s) => bucketShape(classifyShape(s.faceToTarget, s.clubPath, rightHanded).name));
      const counts = {};
      shapes.forEach((sh) => {
        counts[sh] = (counts[sh] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      const pct = ((top[1] / shapes.length) * 100).toFixed(0);
      if (top[0] !== 'Straight' && parseInt(pct) > 30) {
        out.push({
          level: parseInt(pct) > 50 ? 'warn' : '',
          title: 'SHAPE TENDENCY',
          body: (
            <>
              Your dominant ball flight is <span className="num">{top[0]}</span> —{' '}
              <span className="num">{pct}%</span> of shots.{' '}
              {top[0].includes('Slice') || top[0].includes('Fade')
                ? 'This means your face is open relative to your path. Either close the face or swing more left for a RH player.'
                : top[0].includes('Hook') || top[0].includes('Draw')
                ? 'Your face is closed relative to your path. Check grip strength and release timing.'
                : ''}
            </>
          ),
        });
      }
    }

    // Smash factor below benchmark
    Object.entries(byClub).forEach(([club, clubShots]) => {
      const sm = summarize(clubShots, 'efficiency');
      const w = getWindow(club);
      if (sm && sm.mean < w.smash[1]) {
        out.push({
          level: sm.mean < w.smash[0] ? 'bad' : 'warn',
          title: `${club} · SMASH FACTOR`,
          body: (
            <>
              Average smash is <span className="num">{sm.mean.toFixed(3)}</span> vs typical good amateur range of{' '}
              <span className="num">{w.smash[1].toFixed(2)}–{w.smash[2].toFixed(2)}</span> for this club. Almost always
              a centred-strike problem first, equipment second.
            </>
          ),
        });
      }
    });

    return out.slice(0, 6);
  }, [shots, byClub, rightHanded, units]);

  if (!items.length) {
    return <div className="empty-state-sub" style={{ padding: 20 }}>Load more shots to unlock insights.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((ins, i) => (
        <Insight key={i} level={ins.level} title={ins.title}>
          {ins.body}
        </Insight>
      ))}
    </div>
  );
}
