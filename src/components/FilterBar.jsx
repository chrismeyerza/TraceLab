import { clubColor } from '../lib/clubs';

/**
 * Filter bar with two stacked rows:
 *   1. CLUBS — chip per club (toggle multi-select). "ALL" selects every club.
 *      Clicking the only remaining active chip re-selects ALL — friendlier
 *      than the old behaviour, which silently refused to deselect the last
 *      chip and left the user wondering what was broken.
 *   2. WHEN — time-period chips. Mutually exclusive (single-select).
 *
 * The Clear button on the right resets all three filters at once (clubs,
 * time, session pin) — the single keystroke a user needs when they want to
 * see everything fresh.
 *
 * Both filters AND together in App.jsx: a shot is shown only if it matches
 * the active clubs AND the active time period AND (if pinned) the session.
 */
const TIME_OPTIONS = [
  { key: 'all',  label: 'All time' },
  { key: 'last', label: 'Last session' },
  { key: '30d',  label: 'Last 30 days' },
  { key: '90d',  label: 'Last 90 days' },
];

export default function FilterBar({
  clubs, selected, setSelected,
  timeFilter, setTimeFilter,
  pinnedSession, setPinnedSession,
}) {
  // Click behaviour matches list-selection conventions everywhere else:
  //  Plain click   → focus on ONLY this club (replaces the entire selection)
  //  Cmd / Ctrl    → toggle this club in/out of the existing selection (additive)
  // The "focus" mode is by far the more common workflow ("just show me 7i")
  // and the old behaviour required nine clicks to achieve it. The additive
  // toggle is still reachable via modifier for users who want to pick several
  // clubs at once.
  const clickClub = (c, e) => {
    const isAdditive = e && (e.metaKey || e.ctrlKey);
    if (isAdditive) {
      // Cmd/Ctrl-click → toggle in/out of selection. Guard against emptying
      // it entirely (would show no data — usually accidental).
      if (selected.includes(c)) {
        if (selected.length > 1) setSelected(selected.filter((x) => x !== c));
      } else {
        setSelected([...selected, c]);
      }
    } else {
      // Plain click → focus on just this club. If they re-click the chip
      // that's already the sole selection, reset to ALL (escape hatch).
      if (selected.length === 1 && selected[0] === c) {
        setSelected(clubs);
      } else {
        setSelected([c]);
      }
    }
  };

  const isAnyFilterActive =
    (selected.length !== clubs.length) ||
    (timeFilter !== 'all') ||
    !!pinnedSession;

  const clearAll = () => {
    setSelected(clubs);
    setTimeFilter('all');
    setPinnedSession(null);
  };

  return (
    <div className="filter-bar-stack">
      <div className="filter-bar">
        <span className="filter-label">CLUBS</span>
        <div className="chip-row">
          <button
            className={`chip ${selected.length === clubs.length ? 'active' : ''}`}
            onClick={() => setSelected(clubs)}
          >
            ALL
          </button>
          {clubs.map((c) => (
            <button
              key={c}
              className={`chip ${selected.includes(c) ? 'active' : ''}`}
              onClick={(e) => clickClub(c, e)}
              title="Click to focus on just this club · Cmd/Ctrl-click to add to selection"
              style={
                selected.includes(c)
                  ? {
                      background: clubColor(c),
                      borderColor: clubColor(c),
                      color: '#0a0e0c',
                      boxShadow: `0 0 0 1px var(--bg-elev-1), 0 0 0 2px ${clubColor(c)}`,
                    }
                  : {}
              }
            >
              {c}
            </button>
          ))}
        </div>
        {isAnyFilterActive && (
          <button
            className="btn-secondary"
            onClick={clearAll}
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 10 }}
            title="Reset clubs, time, and any pinned session"
          >
            Clear all filters
          </button>
        )}
      </div>
      <div className="filter-bar">
        <span className="filter-label">WHEN</span>
        <div className="chip-row">
          {TIME_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`chip ${timeFilter === o.key ? 'active' : ''}`}
              onClick={() => setTimeFilter(o.key)}
            >
              {o.label}
            </button>
          ))}
          {pinnedSession && (
            <button
              className="chip active"
              onClick={() => setPinnedSession(null)}
              title="Click to clear the session filter"
              style={{
                background: 'var(--blue)',
                borderColor: 'var(--blue)',
                color: '#0a0e0c',
                boxShadow: '0 0 0 1px var(--bg-elev-1), 0 0 0 2px var(--blue)',
              }}
            >
              {pinnedSession.label} ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
