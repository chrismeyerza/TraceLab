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
  selectedTypes, showTypes, availableTypes,
  selectedEquipment, selectedTags,
}) {
  const isFilteringClubs = selectedClubs && allClubs && selectedClubs.length !== allClubs.length;
  const isFilteringTime = timeFilter && timeFilter !== 'all';
  const isPinned = !!pinnedSession;
  // Type filter counts as "active" when there's actually something to
  // narrow — i.e. either non-full shots exist (so "Full only" is genuinely
  // excluding things), or the user has changed the selection from the
  // default. When the entire dataset is Full and the filter is just on
  // Full, that's the baseline and we don't show a redundant chip.
  const hasNonFull = availableTypes && availableTypes.some((t) => t !== 'full');
  const isOnlyFullSelected = selectedTypes && selectedTypes.length === 1 && selectedTypes[0] === 'full';
  const isFilteringTypes = showTypes && selectedTypes && (
    !isOnlyFullSelected || hasNonFull
  );
  const isFilteringEquipment = (selectedEquipment?.length || 0) > 0;
  const isFilteringTags = (selectedTags?.length || 0) > 0;
  const anyFilter = isFilteringClubs || isFilteringTime || isPinned || isFilteringTypes ||
                    isFilteringEquipment || isFilteringTags;

  // No filters active — keep it quiet. The shot count is visible in the page
  // header anyway, no need to duplicate that information here.
  if (!anyFilter) return null;

  const timeLabel = {
    all: 'All time',
    last: 'Last session',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
  }[timeFilter];

  const typeLabels = {
    full: 'Full', '3-quarter': '3/4', half: 'Half', pitch: 'Pitch',
    chip: 'Chip', bunker: 'Bunker', flop: 'Flop', other: 'Other',
  };

  // Build the chip stack in a deterministic order so the user's eye can
  // anticipate where each piece of context sits.
  const chips = [];
  if (isFilteringClubs) chips.push({ key: 'clubs', label: selectedClubs.join(', '), tone: 'club' });
  if (isFilteringTime) chips.push({ key: 'time', label: timeLabel, tone: 'time' });
  if (isPinned) chips.push({ key: 'pin', label: `Session: ${pinnedSession.label}`, tone: 'pin' });
  if (isFilteringTypes) {
    const label = selectedTypes.map((t) => typeLabels[t] || t).join(', ');
    chips.push({ key: 'types', label, tone: 'type' });
  }
  if (isFilteringEquipment) {
    chips.push({ key: 'equip', label: `Equip: ${selectedEquipment.join(', ')}`, tone: 'equip' });
  }
  if (isFilteringTags) {
    chips.push({ key: 'tags', label: `Tags: ${selectedTags.join(', ')}`, tone: 'tags' });
  }

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
