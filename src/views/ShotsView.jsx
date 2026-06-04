import { useMemo, useState } from 'react';
import { clubColor, orderedClubs, normalizeClubName } from '../lib/clubs';
import { convertSpeed, convertDistance, speedLabel, distLabel } from '../lib/units';
import { formatPath } from '../lib/shape';
import { SHOT_TYPES, shotTypeLabel } from '../data/shotTypes';
import { EQUIPMENT_BRANDS, getBrandsForCategory } from '../data/equipment';
import { classifyStrike, strikeBandLabel, clubCategory } from '../data/benchmarks';
import { addTag, removeTag } from '../lib/tags';
import TagEditor from '../components/TagEditor';

/**
 * Shots view: raw editable table of every shot in the current filter scope.
 *
 * Three sub-tabs, each surfacing a different column set so no individual
 * table needs horizontal scrolling on a typical screen:
 *
 *   SUMMARY — the essentials (When, Club, Ball Spd, Smash, Carry, Total,
 *             Face-to-Path). Fast scan.
 *   BALL    — everything ball-flight related (12 cols). What the ball did
 *             after being struck — speeds, spin, launch, landing.
 *   CLUB    — everything club-impact related (12 cols). What the club did
 *             AT impact — path, face, AoA, loft, impact location.
 *
 * Shared across tabs:
 *   - Selection (checkboxes survive tab switching)
 *   - Bulk-action bar
 *   - Club column (always present, always editable inline)
 *   - Delete (per-row + bulk)
 *   - Sort: persists if the column exists in the new tab, else falls back
 *           to createdAt desc
 *
 * Editing model: click any club chip to open an inline ClubPicker — choose
 * a club from the canonical bag or type a custom label. Selected shots can
 * be bulk-relabelled from the action bar. Both update IndexedDB via the
 * onUpdateShot / onUpdateShots props passed in by App.
 */

// Column descriptors. `key` is also used for sorting; `label` is the header
// text. `num` styles the column as numeric (right-aligned). `render` produces
// the cell content from a shot record. `width` is optional and helps keep
// tables tidy when columns vary across tabs.
const makeColumns = (units, userName) => ({
  // ===== Always-present columns ======================================
  when: {
    key: 'createdAt',
    label: 'WHEN',
    render: (s) =>
      s.createdAt
        ? new Date(s.createdAt).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })
        : '—',
    style: { fontSize: 10, color: 'var(--text-dim)' },
  },
  // User column — shows which profile each shot belongs to. Resolved via the
  // userName lookup passed in from App. Falls back to "—" for shots with no
  // userId (shouldn't happen post-backfill, but robust to legacy data).
  user: {
    key: 'userId', label: 'PLAYER',
    render: (s) => userName(s.userId),
    style: { fontSize: 11, color: 'var(--text-dim)' },
  },
  // Shot type — Full / Pitch / Chip etc. Defaults to 'full'. The cell is a
  // plain label; editing happens via the dedicated picker (handled inline in
  // the row render, like the club chip).
  shotType: {
    key: 'shotType', label: 'TYPE',
    render: (s) => shotTypeLabel(s.shotType || 'full'),
    style: { fontSize: 11, color: 'var(--text-dim)' },
  },
  // Equipment — physical club. Null = untagged → shown as "—". Stop-gap
  // capture; the cell is a plain label, edited via the picker.
  equipment: {
    key: 'equipment', label: 'EQUIP',
    render: (s) => s.equipment || '—',
    style: { fontSize: 11, color: 'var(--text-dim)' },
  },
  // Free-form tags — array of user-defined strings. Cell shows them as
  // comma-separated; click opens the inline TagEditor for that shot.
  tags: {
    key: 'tags', label: 'TAGS',
    render: (s) => (s.tags && s.tags.length) ? s.tags.join(', ') : '—',
    style: { fontSize: 11, color: 'var(--text-dim)' },
  },
  // club rendered specially because it's the editable chip — handled inline
  // ===== Ball columns ================================================
  ballSpeed: {
    key: 'ballSpeed', label: 'BALL SPD', num: true,
    render: (s) => s.ballSpeed == null ? '—' : `${convertSpeed(s.ballSpeed, units.speed).toFixed(1)} ${speedLabel(units.speed)}`,
  },
  launchAngle: {
    key: 'launchAngle', label: 'LAUNCH', num: true,
    render: (s) => s.launchAngle == null ? '—' : `${s.launchAngle.toFixed(1)}°`,
  },
  pushPull: {
    key: 'pushPull', label: 'PUSH/PULL', num: true,
    render: (s) => s.pushPull == null ? '—' : `${s.pushPull > 0 ? '+' : ''}${s.pushPull.toFixed(1)}°`,
  },
  backSpin: {
    key: 'backSpin', label: 'BACK SPIN', num: true,
    render: (s) => s.backSpin == null ? '—' : Math.round(s.backSpin).toLocaleString(),
  },
  sideSpin: {
    key: 'sideSpin', label: 'SIDE SPIN', num: true,
    render: (s) => s.sideSpin == null ? '—' : `${s.sideSpin > 0 ? '+' : ''}${Math.round(s.sideSpin).toLocaleString()}`,
  },
  totalSpin: {
    key: 'totalSpin', label: 'TOTAL SPIN', num: true,
    render: (s) => s.totalSpin == null ? '—' : Math.round(s.totalSpin).toLocaleString(),
  },
  spinAxis: {
    key: 'spinAxis', label: 'SPIN AXIS', num: true,
    render: (s) => s.spinAxis == null ? '—' : `${s.spinAxis > 0 ? '+' : ''}${s.spinAxis.toFixed(1)}°`,
  },
  carry: {
    key: 'carry', label: 'CARRY', num: true,
    render: (s) => s.carry == null ? '—' : `${convertDistance(s.carry, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  totalDist: {
    key: 'totalDist', label: 'TOTAL', num: true,
    render: (s) => s.totalDist == null ? '—' : `${convertDistance(s.totalDist, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  runDistance: {
    key: 'runDistance', label: 'RUN', num: true,
    render: (s) => s.runDistance == null ? '—' : `${convertDistance(s.runDistance, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  offline: {
    key: 'offline', label: 'OFFLINE', num: true,
    render: (s) => s.offline == null ? '—' : `${s.offline > 0 ? '+' : ''}${convertDistance(s.offline, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  curvature: {
    key: 'curvature', label: 'CURVE', num: true,
    render: (s) => s.curvature == null ? '—' : `${s.curvature > 0 ? '+' : ''}${convertDistance(s.curvature, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  peakHeight: {
    key: 'peakHeight', label: 'PEAK HT', num: true,
    render: (s) => s.peakHeight == null ? '—' : `${convertDistance(s.peakHeight, units.distance).toFixed(1)} ${distLabel(units.distance)}`,
  },
  descentAngle: {
    key: 'descentAngle', label: 'DESCENT', num: true,
    render: (s) => s.descentAngle == null ? '—' : `${s.descentAngle.toFixed(1)}°`,
  },
  efficiency: {
    key: 'efficiency', label: 'SMASH', num: true,
    render: (s) => s.efficiency == null ? '—' : s.efficiency.toFixed(2),
  },
  // ===== Club columns ================================================
  clubSpeed: {
    key: 'clubSpeed', label: 'CLUB SPD', num: true,
    render: (s) => s.clubSpeed == null ? '—' : `${convertSpeed(s.clubSpeed, units.speed).toFixed(1)} ${speedLabel(units.speed)}`,
  },
  clubSpeedImpact: {
    key: 'clubSpeedImpact', label: 'CLUB SPD@IMP', num: true,
    render: (s) => s.clubSpeedImpact == null ? '—' : `${convertSpeed(s.clubSpeedImpact, units.speed).toFixed(1)} ${speedLabel(units.speed)}`,
  },
  angleOfAttack: {
    key: 'angleOfAttack', label: 'AoA', num: true,
    render: (s) => s.angleOfAttack == null ? '—' : `${s.angleOfAttack > 0 ? '+' : ''}${s.angleOfAttack.toFixed(1)}°`,
  },
  clubPath: {
    key: 'clubPath', label: 'PATH', num: true,
    render: (s) => formatPath(s.clubPath),
  },
  startLine: {
    key: 'startLine', label: 'START', num: true,
    render: (s) => {
      // Robust to shots stored before startLine was a derived field — fall
      // back to computing it from face + path on the fly.
      const v = s.startLine != null
        ? s.startLine
        : (s.faceToTarget != null && s.clubPath != null
            ? 0.75 * s.faceToTarget + 0.25 * s.clubPath
            : null);
      if (v == null) return '—';
      return `${v > 0 ? '+' : ''}${v.toFixed(1)}°`;
    },
    cellStyle: (s) => {
      const v = s.startLine != null
        ? s.startLine
        : (s.faceToTarget != null && s.clubPath != null
            ? 0.75 * s.faceToTarget + 0.25 * s.clubPath
            : null);
      return {
        color: v == null ? 'var(--text-dim)'
          : Math.abs(v) > 3 ? 'var(--amber)'
          : 'var(--text)',
      };
    },
  },
  faceToTarget: {
    key: 'faceToTarget', label: 'FACE→TGT', num: true,
    render: (s) => s.faceToTarget == null ? '—' : `${s.faceToTarget > 0 ? '+' : ''}${s.faceToTarget.toFixed(1)}°`,
  },
  faceToPath: {
    key: 'faceToPath', label: 'F→P', num: true,
    render: (s) => s.faceToPath == null ? '—' : `${s.faceToPath > 0 ? '+' : ''}${s.faceToPath.toFixed(1)}°`,
    cellStyle: (s) => ({
      color: s.faceToPath == null ? 'var(--text-dim)'
        : s.faceToPath > 1 ? 'var(--amber)'
        : s.faceToPath < -1 ? 'var(--blue)'
        : 'var(--green)',
    }),
  },
  loft: {
    key: 'loft', label: 'LOFT', num: true,
    render: (s) => s.loft == null ? '—' : `${s.loft.toFixed(1)}°`,
  },
  lie: {
    key: 'lie', label: 'LIE', num: true,
    render: (s) => s.lie == null ? '—' : `${s.lie > 0 ? '+' : ''}${s.lie.toFixed(1)}°`,
  },
  faceImpactH: {
    key: 'faceImpactH', label: 'IMPACT H', num: true,
    render: (s) => s.faceImpactH == null ? '—' : `${s.faceImpactH > 0 ? '+' : ''}${s.faceImpactH}`,
  },
  faceImpactV: {
    key: 'faceImpactV', label: 'IMPACT V', num: true,
    render: (s) => s.faceImpactV == null ? '—' : `${s.faceImpactV > 0 ? '+' : ''}${s.faceImpactV}`,
  },
  // Strike classification — H/V model (centred / low / high / heel-toe).
  // Sits next to the raw faceImpactH/V columns so the user can see what raw
  // (mm) → band derivation produced. Coloured by band: green for centred,
  // amber for low/high, red for heel/toe.
  strike: {
    key: 'strike', label: 'STRIKE',
    render: (s) => {
      const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
      return cl ? strikeBandLabel(cl.band) : '—';
    },
    cellStyle: (s) => {
      const cl = classifyStrike(s.club, s.faceImpactH, s.faceImpactV);
      if (!cl) return { color: 'var(--text-dim)' };
      return {
        fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600,
        color:
          cl.band === 'centred' ? 'var(--green)' :
          cl.band === 'heel-toe' ? 'var(--red)' :
          'var(--amber)',
      };
    },
  },
  spinLoft: {
    key: 'spinLoft', label: 'SPIN LOFT', num: true,
    render: (s) => s.spinLoft == null ? '—' : `${s.spinLoft.toFixed(1)}°`,
  },
  closureRate: {
    key: 'closureRate', label: 'CLOSURE', num: true,
    render: (s) => s.closureRate == null ? '—' : Math.round(s.closureRate).toLocaleString(),
  },
});

// Tab definitions reference column keys from makeColumns(). Order matters
// here — it's the on-screen left-to-right order.
const TABS = {
  summary: {
    label: 'Summary',
    cols: ['when', 'user', 'shotType', 'equipment', 'tags', 'ballSpeed', 'efficiency', 'carry', 'totalDist', 'faceToPath'],
  },
  ball: {
    label: 'Ball',
    // Smash factor lives on the Ball tab — it's an outcome of the strike,
    // expressed as ball/club speed ratio, and the user expects it here.
    cols: [
      'when', 'ballSpeed', 'efficiency', 'launchAngle', 'pushPull',
      'backSpin', 'sideSpin', 'totalSpin', 'spinAxis',
      'carry', 'totalDist', 'runDistance', 'offline', 'curvature',
      'peakHeight', 'descentAngle',
    ],
  },
  club: {
    label: 'Club',
    cols: [
      'when', 'clubSpeed', 'clubSpeedImpact', 'angleOfAttack',
      'clubPath', 'faceToTarget', 'startLine', 'faceToPath',
      'loft', 'spinLoft', 'lie', 'closureRate',
      'faceImpactH', 'faceImpactV', 'strike',
    ],
  },
};

export default function ShotsView({ shots, units, allClubs, users, availableTagsList, onUpdateShot, onUpdateShots, onDeleteShot }) {
  const [tab, setTab] = useState('summary');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null); // shotId for inline picker
  const [bulkLabelOpen, setBulkLabelOpen] = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false);
  const [bulkTagsDraft, setBulkTagsDraft] = useState([]);
  const [editingType, setEditingType] = useState(null); // shotId for inline type picker
  // editingEquip state removed in PR 4.18 — equipment is no longer per-shot
  // editable. Equipment comes from the user's bag (see Settings → Bag).
  const [editingTags, setEditingTags] = useState(null); // shotId for inline tag editor

  // userId → display name lookup. Memoised on the users list. Unknown ids
  // (e.g. a shot attributed to a since-deleted user) resolve to a dimmed
  // placeholder rather than blank, so orphaned attribution is visible.
  const userName = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => { map[u.id] = u.name; });
    return (id) => (id == null ? '—' : (map[id] || 'Unknown'));
  }, [users]);

  const columns = useMemo(() => makeColumns(units, userName), [units, userName]);
  const tabConfig = TABS[tab];

  // If user switches to a tab that doesn't include the current sortKey,
  // fall back gracefully. createdAt is always present so it's safe.
  const activeSortKey = useMemo(() => {
    const validKeys = new Set(tabConfig.cols.map((c) => columns[c].key));
    return validKeys.has(sortKey) ? sortKey : 'createdAt';
  }, [sortKey, tabConfig, columns]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...shots].sort((a, b) => {
      const av = a[activeSortKey];
      const bv = b[activeSortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [shots, activeSortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const selectAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((s) => s.id)));
  };

  // Render a column header with sort indicator
  const renderHeader = (col) => (
    <th
      key={col.key}
      onClick={() => toggleSort(col.key)}
      className={col.num ? 'num' : ''}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {col.label}
      {activeSortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Shots.</span> The raw record.
        </h1>
        <div className="page-meta">
          <div>{shots.length} SHOTS</div>
          <div>{selected.size > 0 ? `${selected.size} SELECTED` : 'CLICK A COLUMN TO SORT · CLICK A CLUB TO RELABEL'}</div>
        </div>
      </div>

      <div className="shots-tabs">
        {Object.entries(TABS).map(([key, t]) => (
          <button
            key={key}
            className={`shots-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t.label}
            <span className="shots-tab-count">· {t.cols.length} cols</span>
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 14, background: 'var(--bg-elev-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text)' }}>
              {selected.size} shot{selected.size === 1 ? '' : 's'} selected
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn-secondary" onClick={() => { setBulkLabelOpen(true); setBulkTypeOpen(false) }}>
              Reassign club
            </button>
            <button className="btn-secondary" onClick={() => { setBulkTypeOpen(true); setBulkLabelOpen(false) }}>
              Set type
            </button>
            <button className="btn-secondary" onClick={() => { setBulkTagsOpen(true); setBulkLabelOpen(false); setBulkTypeOpen(false); setBulkTagsDraft([]); }}>
              Set tags
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                if (!confirm(`Delete ${selected.size} shot${selected.size === 1 ? '' : 's'}? This can't be undone.`)) return;
                for (const id of selected) onDeleteShot(id);
                setSelected(new Set());
              }}
            >
              Delete
            </button>
            <button className="btn-secondary" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
          {bulkLabelOpen && (
            <ClubPicker
              clubs={allClubs}
              onPick={async (newClub) => {
                const updates = [...selected].map((id) => ({ id, patch: { club: newClub } }));
                await onUpdateShots(updates);
                setBulkLabelOpen(false);
                setSelected(new Set());
              }}
              onClose={() => setBulkLabelOpen(false)}
              label={`Reassign ${selected.size} shot${selected.size === 1 ? '' : 's'} as:`}
            />
          )}
          {bulkTypeOpen && (
            <TypePicker
              onPick={async (type) => {
                const updates = [...selected].map((id) => ({ id, patch: { shotType: type } }));
                await onUpdateShots(updates);
                setBulkTypeOpen(false);
                setSelected(new Set());
              }}
              onClose={() => setBulkTypeOpen(false)}
              label={`Set type for ${selected.size} shot${selected.size === 1 ? '' : 's'}:`}
            />
          )}
          {bulkTagsOpen && (
            <BulkTagsPanel
              draft={bulkTagsDraft}
              setDraft={setBulkTagsDraft}
              suggestionPool={availableTagsList || []}
              shotCount={selected.size}
              onApplyAdd={async () => {
                const updates = [...selected].map((id) => {
                  const shot = shots.find((s) => s.id === id);
                  const next = (bulkTagsDraft || []).reduce(
                    (acc, t) => addTag(acc, t),
                    shot?.tags || []
                  );
                  return { id, patch: { tags: next } };
                });
                await onUpdateShots(updates);
                setBulkTagsOpen(false);
                setBulkTagsDraft([]);
                setSelected(new Set());
              }}
              onApplyReplace={async () => {
                const updates = [...selected].map((id) => ({
                  id, patch: { tags: [...(bulkTagsDraft || [])] },
                }));
                await onUpdateShots(updates);
                setBulkTagsOpen(false);
                setBulkTagsDraft([]);
                setSelected(new Set());
              }}
              onClose={() => { setBulkTagsOpen(false); setBulkTagsDraft([]); }}
            />
          )}
        </div>
      )}

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: tabConfig.cols.length * 70 + 200 }}>
            <thead>
              <tr>
                <th style={{ width: 24 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={selectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                {/* When column comes first, then Club (special), then the rest */}
                {renderHeader(columns.when)}
                <th onClick={() => toggleSort('club')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  CLUB{activeSortKey === 'club' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
                {tabConfig.cols.filter((c) => c !== 'when').map((c) => renderHeader(columns[c]))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} style={selected.has(s.id) ? { background: 'rgba(74,222,128,0.06)' } : {}}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={columns.when.style}>{columns.when.render(s)}</td>
                  <td>
                    <button
                      onClick={() => setEditing(editing === s.id ? null : s.id)}
                      className="club-chip-edit"
                      style={{
                        '--cc': clubColor(s.club),
                        background: `${clubColor(s.club)}22`,
                        color: clubColor(s.club),
                      }}
                      title="Click to reassign this shot to a different club"
                    >
                      {s.club}
                      <span className="club-chip-edit-pencil">✎</span>
                    </button>
                    {editing === s.id && (
                      <ClubPicker
                        clubs={allClubs}
                        current={s.club}
                        onPick={async (newClub) => {
                          await onUpdateShot(s.id, { club: newClub });
                          setEditing(null);
                        }}
                        onClose={() => setEditing(null)}
                        label="Change club to:"
                        compact
                      />
                    )}
                  </td>
                  {tabConfig.cols.filter((c) => c !== 'when').map((c) => {
                    const col = columns[c];
                    const style = col.cellStyle ? col.cellStyle(s) : (col.style || {});
                    // shotType and equipment are inline-editable: clicking the
                    // cell opens a small picker beneath it.
                    if (c === 'shotType') {
                      return (
                        <td key={col.key} style={{ ...style, cursor: 'pointer' }}
                            onClick={() => { setEditingType(editingType === s.id ? null : s.id); setEditingTags(null); }}
                            title="Click to set shot type">
                          <span style={{ borderBottom: '1px dotted var(--text-faint)' }}>{col.render(s)}</span>
                          {editingType === s.id && (
                            <TypePicker
                              current={s.shotType || 'full'}
                              onPick={async (type) => { await onUpdateShot(s.id, { shotType: type }); setEditingType(null); }}
                              onClose={() => setEditingType(null)}
                              label="Set shot type:"
                            />
                          )}
                        </td>
                      );
                    }
                    // Equipment column intentionally read-only as of PR 4.18.
                    // Equipment is now stamped from the user's bag at import
                    // and on club reassignment — not edited per-shot. To
                    // change equipment you set it once in your bag (Settings
                    // → Bag) and it applies to future imports and any
                    // reassignment. Existing shots keep their stamped value
                    // (snapshot semantic).
                    if (c === 'tags') {
                      const isEditing = editingTags === s.id;
                      return (
                        <td key={col.key}
                            style={{ ...style, cursor: isEditing ? 'default' : 'pointer', minWidth: 180 }}
                            onClick={() => {
                              if (!isEditing) {
                                setEditingTags(s.id);
                                setEditingType(null);
                               
                              }
                            }}
                            title={isEditing ? '' : 'Click to edit tags'}>
                          {isEditing ? (
                            <TagEditor
                              value={s.tags || []}
                              onChange={(next) => onUpdateShot(s.id, { tags: next })}
                              suggestionPool={availableTagsList || []}
                              placeholder="Add tag…"
                              compact
                            />
                          ) : (
                            <span style={{ borderBottom: '1px dotted var(--text-faint)' }}>{col.render(s)}</span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key} className={col.num ? 'num' : ''} style={style}>
                        {col.render(s)}
                      </td>
                    );
                  })}
                  <td>
                    <button
                      className="btn-danger"
                      style={{ padding: '2px 6px', fontSize: 9 }}
                      onClick={() => {
                        if (!confirm(`Delete this ${s.club} shot from ${new Date(s.createdAt).toLocaleString()}?`)) return;
                        onDeleteShot(s.id);
                      }}
                    >
                      DEL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-sub">No shots match the current filters.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Inline club picker. Shows a chip per club (full bag) for the user to select.
 * Also offers a free-text input for clubs not yet in the dataset (e.g. you've
 * been hitting 7-irons but now you're labelling one shot as your 6-iron for
 * the first time). New labels are normalized through normalizeClubName.
 */
function ClubPicker({ clubs, onPick, onClose, label, current, compact }) {
  const [custom, setCustom] = useState('');
  const canonical = orderedClubs(['Dr','3w','5w','7w','2h','3h','4h','5h','2i','3i','4i','5i','6i','7i','8i','9i','PW','GW','SW','LW']);
  const merged = orderedClubs([...new Set([...canonical, ...(clubs || [])])]);
  const submitCustom = () => {
    const c = normalizeClubName(custom.trim());
    if (c) onPick(c);
  };
  return (
    <div
      style={{
        marginTop: compact ? 4 : 8,
        padding: compact ? 8 : 12,
        background: 'var(--bg-elev-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {merged.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            disabled={c === current}
            style={{
              padding: '4px 10px', borderRadius: 3,
              fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
              background: c === current ? 'var(--bg-elev-2)' : `${clubColor(c)}22`,
              color: c === current ? 'var(--text-dim)' : clubColor(c),
              border: `1px solid ${c === current ? 'var(--border)' : 'transparent'}`,
              cursor: c === current ? 'not-allowed' : 'pointer',
              opacity: c === current ? 0.5 : 1,
            }}
            title={c === current ? 'Already labelled this' : ''}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Or type a custom label (e.g. 50°)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
          style={{
            flex: 1, padding: '5px 10px',
            background: 'var(--bg-elev-1)',
            border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text)',
            fontFamily: 'JetBrains Mono', fontSize: 11,
          }}
        />
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 9 }} onClick={submitCustom} disabled={!custom.trim()}>
          USE
        </button>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 9 }} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

/**
 * Shot-type picker. Simple chip grid of the fixed SHOT_TYPES enum. Used for
 * both bulk-setting (from the action bar) and inline per-shot editing.
 */
function TypePicker({ onPick, onClose, label, current }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 8, padding: 12,
        background: 'var(--bg-elev-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {SHOT_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => onPick(t.key)}
            disabled={t.key === current}
            className={`chip ${t.key === current ? 'active' : ''}`}
            style={t.key === current ? {
              background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c',
            } : {}}
          >
            {t.label}
          </button>
        ))}
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 9, marginLeft: 6 }} onClick={onClose}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

/**
 * Equipment picker — curated brand → model taxonomy filtered to the shot's
 * club category. A 7-iron only shows iron brands; a driver only shows
 * driver brands. Prevents nonsense tagging (you can't tag a wedge as
 * "Callaway Rogue ST" — that's a driver).
 *
 * Two-step: pick a brand, then a model (or the bare brand). A "Clear tag"
 * option sets equipment back to null. No free text — that's the deferred
 * "proper" version.
 *
 * Props:
 *   onPick(value | null)  — called when user picks a model, bare brand, or clears
 *   onClose               — called when user cancels (or backgrounds)
 *   label                 — small label shown at top
 *   current               — currently-assigned equipment string (or null)
 *   category              — 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge'
 *                           used to filter brand list. Falls back to 'iron'
 *                           if missing/unknown.
 */
function EquipmentPicker({ onPick, onClose, label, current, category }) {
  const brands = getBrandsForCategory(category || 'iron');
  // If a tag is already set, open straight to its brand's model list so the
  // current selection is immediately visible (and highlighted).
  const currentBrand = current
    ? brands.find((b) => current.startsWith(b.brand))?.brand || null
    : null;
  const [brand, setBrand] = useState(currentBrand);
  const brandObj = brands.find((b) => b.brand === brand);

  const categoryLabel = {
    driver: 'Driver', wood: 'Fairway wood', hybrid: 'Hybrid',
    iron: 'Iron', wedge: 'Wedge',
  }[category || 'iron'] || 'Iron';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 8, padding: 12,
        background: 'var(--bg-elev-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
        <span style={{ marginLeft: 8, color: 'var(--green)', fontWeight: 600 }}>
          · {categoryLabel} equipment
        </span>
      </div>
      {!brand ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {brands.map((b) => {
            const isCurrentBrand = current && current.startsWith(b.brand);
            return (
              <button
                key={b.brand}
                onClick={() => setBrand(b.brand)}
                className={`chip ${isCurrentBrand ? 'active' : ''}`}
                style={isCurrentBrand ? {
                  background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c',
                } : {}}
              >
                {b.brand}{isCurrentBrand ? ' ✓' : ''}
              </button>
            );
          })}
          <button
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: 9, marginLeft: 6 }}
            onClick={() => onPick(null)}
            title="Remove the equipment tag from these shots"
          >
            CLEAR TAG
          </button>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 9 }} onClick={onClose}>
            CANCEL
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: 9 }}
              onClick={() => setBrand(null)}
            >
              ‹ BRANDS
            </button>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>
              {brand}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button
              onClick={() => onPick(brand)}
              className={`chip ${current === brand ? 'active' : ''}`}
              style={current === brand ? { background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c' } : {}}
            >
              {brand} (unspecified){current === brand ? ' ✓' : ''}
            </button>
            {brandObj?.models.map((m) => {
              const full = `${brand} ${m}`;
              const isCurrent = current === full;
              return (
                <button
                  key={m}
                  onClick={() => onPick(full)}
                  className={`chip ${isCurrent ? 'active' : ''}`}
                  style={isCurrent ? { background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c' } : {}}
                >
                  {m}{isCurrent ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk tag editor panel. Lets the user build up a set of tags and then choose
 * how to apply them across the selected shots:
 *
 *   ADD       — append these tags to each shot's existing tags (with dedupe)
 *   REPLACE   — overwrite each shot's tags entirely with this set
 *
 * The distinction matters because "add" is the safe, non-destructive operation
 * (the user can always remove again), and "replace" lets the user clear and
 * reset a session's tagging in one step. Most workflows are add; replace is
 * the escape hatch.
 *
 * Reuses TagEditor for the actual input + autocomplete UI, with no shot to
 * mutate — the panel maintains its own draft array via the parent.
 */
function BulkTagsPanel({ draft, setDraft, suggestionPool, shotCount, onApplyAdd, onApplyReplace, onClose }) {
  return (
    <div
      style={{
        marginTop: 8, padding: 12,
        background: 'var(--bg-elev-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        Tags for {shotCount} shot{shotCount === 1 ? '' : 's'}:
      </div>
      <div style={{ marginBottom: 10 }}>
        <TagEditor
          value={draft}
          onChange={setDraft}
          suggestionPool={suggestionPool}
          placeholder="Type tag and press Enter…"
        />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          onClick={onApplyAdd}
          disabled={draft.length === 0}
          title="Add these tags to each shot, keeping existing tags"
          style={{ padding: '5px 12px', fontSize: 10 }}
        >
          ADD TO SHOTS
        </button>
        <button
          className="btn-secondary"
          onClick={onApplyReplace}
          title="Replace each shot's tags with this set (also clears existing tags)"
          style={{ padding: '5px 12px', fontSize: 10 }}
        >
          REPLACE
        </button>
        <button
          className="btn-secondary"
          onClick={onClose}
          style={{ padding: '5px 12px', fontSize: 10 }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
