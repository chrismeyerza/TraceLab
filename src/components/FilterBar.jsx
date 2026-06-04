import { useState } from 'react';
import { clubColor } from '../lib/clubs';
import { SHOT_TYPES, SHOT_TYPE_KEYS, shotTypeLabel } from '../data/shotTypes';
import TagManagementPanel from './TagManagementPanel';

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
  showTypes, availableTypes, selectedTypes, setSelectedTypes,
  showEquipment, availableEquipment, selectedEquipment, setSelectedEquipment,
  showTags, availableTagsList, selectedTags, setSelectedTags,
  onRenameTag, onDeleteTag,
}) {
  // The "Manage tags" popover is opened from a button on the TAGS filter
  // row. Local state — closing on outside click is handled inside the panel.
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
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

  const typesActive = showTypes && selectedTypes.length === 1 && selectedTypes[0] === 'full'
    ? false  // default state (full-only) doesn't count as "active"
    : showTypes && !(selectedTypes.length === SHOT_TYPE_KEYS.length);
  const equipmentActive = showEquipment && (selectedEquipment?.length || 0) > 0;
  const tagsActive = showTags && (selectedTags?.length || 0) > 0;

  const isAnyFilterActive =
    (selected.length !== clubs.length) ||
    (timeFilter !== 'all') ||
    !!pinnedSession ||
    typesActive ||
    equipmentActive ||
    tagsActive;

  const clearAll = () => {
    setSelected(clubs);
    setTimeFilter('all');
    setPinnedSession(null);
    if (showTypes) setSelectedTypes(['full']); // reset to clean baseline
    if (showEquipment) setSelectedEquipment([]);
    if (showTags) setSelectedTags([]);
  };

  // Generic "OR within row, AND across rows" click handler — same pattern
  // for both EQUIPMENT and TAGS chip rows. Plain click focuses on one;
  // re-clicking the sole selection clears the row (ALL); cmd-click toggles
  // additively. Matches the existing CLUBS / TYPES behaviour for a
  // consistent interaction model across every filter row.
  const makeOrClickHandler = (selectedArr, setSelectedFn) => (val, e) => {
    const isAdditive = e && (e.metaKey || e.ctrlKey);
    if (isAdditive) {
      if (selectedArr.includes(val)) {
        setSelectedFn(selectedArr.filter((x) => x !== val));
      } else {
        setSelectedFn([...selectedArr, val]);
      }
    } else {
      if (selectedArr.length === 1 && selectedArr[0] === val) {
        setSelectedFn([]); // clear row → "all"
      } else {
        setSelectedFn([val]);
      }
    }
  };
  const clickEquipment = makeOrClickHandler(selectedEquipment || [], setSelectedEquipment);
  const clickTag = makeOrClickHandler(selectedTags || [], setSelectedTags);

  // Shot-type chip click. Same focus/additive model as clubs: plain click
  // focuses on just that type, cmd/ctrl-click toggles it into the selection.
  const clickType = (key, e) => {
    const isAdditive = e && (e.metaKey || e.ctrlKey);
    if (isAdditive) {
      if (selectedTypes.includes(key)) {
        if (selectedTypes.length > 1) setSelectedTypes(selectedTypes.filter((x) => x !== key));
      } else {
        setSelectedTypes([...selectedTypes, key]);
      }
    } else {
      if (selectedTypes.length === 1 && selectedTypes[0] === key) {
        // re-click sole selection → expand to all known types (not just
        // the ones currently present in the data, so the user can
        // pre-select types they're about to start tagging)
        setSelectedTypes(SHOT_TYPE_KEYS);
      } else {
        setSelectedTypes([key]);
      }
    }
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
            <div
              className="chip pin-chip"
              title={`Session pinned: ${pinnedSession.label}`}
              style={{
                background: 'var(--blue)',
                borderColor: 'var(--blue)',
                color: '#0a0e0c',
                boxShadow: '0 0 0 1px var(--bg-elev-1), 0 0 0 2px var(--blue)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px 2px 8px',
              }}
            >
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10 }}>
                📌 {pinnedSession.label}
              </span>
              <button
                type="button"
                onClick={() => setPinnedSession(null)}
                title="Unpin this session"
                aria-label="Unpin session"
                style={{
                  background: 'rgba(0,0,0,0.18)',
                  border: 'none',
                  color: '#0a0e0c',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  lineHeight: '14px',
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
      {showTypes && (
        <div className="filter-bar">
          <span className="filter-label">TYPES</span>
          <div className="chip-row">
            <button
              className={`chip ${selectedTypes.length === SHOT_TYPE_KEYS.length ? 'active' : ''}`}
              onClick={() => setSelectedTypes(SHOT_TYPE_KEYS)}
              title="Show all shot types"
            >
              ALL
            </button>
            {/*
              Render every shot type, not just the ones that currently exist
              in the data. Otherwise the user can't filter to "show me my
              pitches" until they've already tagged at least one — chicken
              and egg. Types with zero shots are visually dimmed so the user
              can see at a glance which categories actually have data.
            */}
            {SHOT_TYPES.map((t) => {
              const hasShots = availableTypes.includes(t.key);
              return (
                <button
                  key={t.key}
                  className={`chip ${selectedTypes.includes(t.key) ? 'active' : ''}`}
                  onClick={(e) => clickType(t.key, e)}
                  title={hasShots
                    ? "Click to focus on just this type · Cmd/Ctrl-click to add to selection"
                    : `No shots tagged ${t.label} yet`}
                  style={hasShots ? {} : { opacity: 0.45 }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showEquipment && (
        <div className="filter-bar">
          <span className="filter-label">EQUIPMENT</span>
          <div className="chip-row">
            <button
              className={`chip ${(selectedEquipment?.length || 0) === 0 ? 'active' : ''}`}
              onClick={() => setSelectedEquipment([])}
              title="Show shots with any equipment (or no tag)"
            >
              ALL
            </button>
            {availableEquipment.map((eq) => (
              <button
                key={eq}
                className={`chip ${selectedEquipment?.includes(eq) ? 'active' : ''}`}
                onClick={(e) => clickEquipment(eq, e)}
                title="Click to focus on just this equipment · Cmd/Ctrl-click to add to selection"
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      )}
      {showTags && (
        <div className={`filter-bar ${tagManagerOpen ? 'has-manage-panel' : ''}`} style={{ position: 'relative' }}>
          <span className="filter-label">TAGS</span>
          <div className="chip-row">
            <button
              className={`chip ${(selectedTags?.length || 0) === 0 ? 'active' : ''}`}
              onClick={() => setSelectedTags([])}
              title="Show shots with any tag (or none)"
            >
              ALL
            </button>
            {availableTagsList.map(({ tag, count }) => (
              <button
                key={tag}
                className={`chip ${selectedTags?.includes(tag) ? 'active' : ''}`}
                onClick={(e) => clickTag(tag, e)}
                title={`${count} shot${count === 1 ? '' : 's'} · Click to focus · Cmd/Ctrl-click to add`}
              >
                {tag} <span style={{ opacity: 0.55, fontSize: '0.85em', marginLeft: 4 }}>{count}</span>
              </button>
            ))}
            <button
              className="chip"
              onClick={() => setTagManagerOpen((v) => !v)}
              title="Rename or delete tags globally"
              style={{ marginLeft: 6, opacity: 0.8 }}
            >
              MANAGE…
            </button>
          </div>
          {tagManagerOpen && (
            <TagManagementPanel
              tagsList={availableTagsList}
              onRename={(oldTag, newTag) => onRenameTag(oldTag, newTag)}
              onDelete={(tag) => onDeleteTag(tag)}
              onClose={() => setTagManagerOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
