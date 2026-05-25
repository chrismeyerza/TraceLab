/**
 * Visible line summarising what data the user is currently looking at.
 * Renders as a small bar at the top of every analytical view so the user
 * always knows whether they're seeing all their data or a narrowed slice.
 *
 * Strategically not shown when the scope is "everything" (no club filter,
 * no time filter, no pinned session) — in that case adding visual noise
 * would just be clutter.
 */
export default function ScopeSummary({
  shotsShown, totalShots,
  selectedClubs, allClubs,
  timeFilter, pinnedSession,
}) {
  const isFilteringClubs = selectedClubs && allClubs && selectedClubs.length !== allClubs.length;
  const isFilteringTime = timeFilter && timeFilter !== 'all';
  const isPinned = !!pinnedSession;
  const anyFilter = isFilteringClubs || isFilteringTime || isPinned;

  // No filters active — keep it quiet. The shot count is visible in the page
  // header anyway, no need to duplicate that information here.
  if (!anyFilter) return null;

  const timeLabel = {
    all: 'All time',
    last: 'Last session',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
  }[timeFilter];

  // Build the chip stack in a deterministic order so the user's eye can
  // anticipate where each piece of context sits.
  const chips = [];
  if (isFilteringClubs) chips.push({ key: 'clubs', label: selectedClubs.join(', '), tone: 'club' });
  if (isFilteringTime) chips.push({ key: 'time', label: timeLabel, tone: 'time' });
  if (isPinned) chips.push({ key: 'pin', label: `Session: ${pinnedSession.label}`, tone: 'pin' });

  const pct = totalShots > 0 ? Math.round((shotsShown / totalShots) * 100) : 0;
  return (
    <div className="scope-summary">
      <span className="scope-summary-count">
        Showing <strong>{shotsShown.toLocaleString()}</strong> of {totalShots.toLocaleString()} shots
        <span className="scope-summary-pct"> · {pct}%</span>
      </span>
      <span className="scope-summary-sep">·</span>
      {chips.map((c, i) => (
        <span key={c.key} className={`scope-summary-chip tone-${c.tone}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}
