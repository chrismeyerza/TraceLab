import { useState } from 'react';
import { clubCategory } from '../data/benchmarks';
import { getBrandsForCategory } from '../data/equipment';

/**
 * Bag editor — renders the active user's per-club equipment mapping as a
 * list of rows, each with an inline picker. Lives inside the Settings
 * panel; renders only when there's an active user (otherwise there's no
 * bag to edit).
 *
 * Per the PR 4.18 design:
 *   - Only clubs that already exist in the user's data appear by default
 *     (you can't have a 2i row in the bag until you've hit a 2i)
 *   - An "Add club to bag" affordance lets the user pre-populate clubs
 *     that haven't been hit yet — useful before a first import
 *   - Each row uses the category-aware EquipmentPicker (a wedge row only
 *     shows wedge brands etc.)
 *   - Editing the bag does NOT change existing shots' equipment.
 *     Equipment is stamped at import / club-reassign time only.
 *
 * Props:
 *   userId         — the user whose bag we're editing
 *   userName       — for the header label
 *   bag            — current bag record { [club]: equipment }
 *   onSetEntry     — (club, equipment) => void, updates the bag (null clears)
 *   userClubs      — clubs the user has actually hit (sorted by canonical
 *                    order via clubs.js — caller is responsible)
 *   allClubLabels  — full list of standard club labels for the "add" dropdown
 *   onFillMissing  — () => void, runs the "fill missing equipment from bag"
 *                    action (covers existing shots whose equipment is null
 *                    but whose club now has a bag entry). Hidden if there's
 *                    nothing to fill.
 *   missingCount   — how many of the user's shots are missing equipment
 *                    (for the "fill missing" button label)
 */
export default function BagPanel({
  userId, userName, bag,
  onSetEntry, onSetEntriesBulk,
  userClubs, allClubLabels,
  onFillMissing, missingCount,
  onOverwriteFromBag, overwriteCount,
}) {
  const [editingClub, setEditingClub] = useState(null); // which club row is open
  const [addingClub, setAddingClub] = useState(false);
  // Bulk-tag mode: lets the user apply one equipment string across many
  // clubs at once (e.g. tag the whole iron set as Ping G400 in one go).
  // The picker is filtered by category — same category-aware constraint
  // as the inline picker.
  const [bulkOpen, setBulkOpen] = useState(false);

  // Rows to render: union of clubs the user has hit AND clubs in the bag
  // (a bag entry can exist for a club without shots yet, if the user
  // pre-populated it via Add). Sort by the user's club-order preference.
  const rowClubs = (() => {
    const set = new Set([...(userClubs || []), ...Object.keys(bag || {})]);
    // Use the order from userClubs first (which respects clubs.js canonical
    // ordering for clubs that exist in data), then append bag-only clubs
    // alphabetically. Good enough — most clubs will be in both sets.
    const ordered = [...(userClubs || [])];
    for (const c of Object.keys(bag || {})) {
      if (!ordered.includes(c)) ordered.push(c);
    }
    return ordered;
  })();

  // Available clubs to ADD = standard labels minus those already in
  // userClubs or the bag. The user can still type/pick something arbitrary
  // if desired, but the dropdown surfaces standard options first.
  const addable = (allClubLabels || []).filter(
    (c) => !rowClubs.includes(c)
  );

  return (
    <div className="bag-panel">
      <div className="bag-header">
        <div>
          <div className="bag-title">{userName ? `${userName}'s bag` : 'Bag'}</div>
          <div className="bag-subtitle">
            Equipment is set per club. New shots get tagged automatically.
          </div>
        </div>
      </div>

      {rowClubs.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>
          No clubs yet. Once you import some shots, your clubs appear here so
          you can tag equipment.
        </div>
      ) : (
        <div className="bag-list">
          {rowClubs.map((club) => {
            const entry = bag[club] || null;
            const isEditing = editingClub === club;
            const category = clubCategory(club);
            const brands = getBrandsForCategory(category);
            return (
              <div key={club} className={`bag-row ${isEditing ? 'editing' : ''}`}>
                <div className="bag-row-club">{club}</div>
                <div className="bag-row-equip">
                  {isEditing ? (
                    <BagInlinePicker
                      category={category}
                      brands={brands}
                      current={entry}
                      onPick={(eq) => {
                        onSetEntry(club, eq);
                        setEditingClub(null);
                      }}
                      onClose={() => setEditingClub(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="bag-row-value"
                      onClick={() => setEditingClub(club)}
                      title="Click to change"
                    >
                      {entry || <span style={{ color: 'var(--text-faint)' }}>set equipment</span>}
                    </button>
                  )}
                </div>
                {entry && !isEditing && (
                  <button
                    type="button"
                    className="settings-user-action danger"
                    onClick={() => onSetEntry(club, null)}
                    title="Remove from bag"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk: set one equipment across multiple clubs at once */}
      {rowClubs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {!bulkOpen ? (
            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setBulkOpen(true)}
              title="Tag many clubs with the same equipment in one step"
            >
              Set equipment across multiple clubs
            </button>
          ) : (
            <BulkBagPanel
              bag={bag}
              rowClubs={rowClubs}
              onApply={(clubs, equipment) => {
                if (onSetEntriesBulk) {
                  onSetEntriesBulk(clubs, equipment);
                } else {
                  // Fallback if caller didn't supply bulk handler
                  clubs.forEach((c) => onSetEntry(c, equipment));
                }
                setBulkOpen(false);
              }}
              onClose={() => setBulkOpen(false)}
            />
          )}
        </div>
      )}

      {/* Add club to bag */}
      <div style={{ marginTop: 8 }}>
        {!addingClub ? (
          <button
            className="btn-secondary"
            style={{ width: '100%' }}
            onClick={() => setAddingClub(true)}
            disabled={addable.length === 0}
            title={addable.length === 0
              ? 'All standard clubs are already in your bag or in your data'
              : 'Add a club to your bag (e.g. before importing)'}
          >
            + Add club to bag
          </button>
        ) : (
          <div style={{
            padding: 10,
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Pick a club to add:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {addable.map((c) => (
                <button
                  key={c}
                  className="chip"
                  onClick={() => {
                    setEditingClub(c);
                    setAddingClub(false);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              className="btn-secondary"
              style={{ marginTop: 8, padding: '3px 10px', fontSize: 10 }}
              onClick={() => setAddingClub(false)}
            >
              CANCEL
            </button>
          </div>
        )}
      </div>

      {/* Fill missing equipment from bag */}
      {missingCount > 0 && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: 'rgba(96,165,250,0.08)',
          border: '1px solid rgba(96,165,250,0.4)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text)',
          lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: 'var(--blue)' }}>{missingCount}</strong>{' '}
            shot{missingCount === 1 ? '' : 's'} have no equipment tagged but
            their club is now in your bag.
          </div>
          <button
            className="btn-secondary"
            style={{ width: '100%', padding: '6px 10px', fontSize: 11 }}
            onClick={onFillMissing}
            title="Stamp these shots with the current bag's equipment for their club"
          >
            Fill missing equipment from bag
          </button>
        </div>
      )}

      {/* Overwrite equipment from bag — more aggressive than Fill Missing.
          Rewrites every shot's equipment from the current bag, overwriting
          existing stamped values. Used when the bag has been corrected after
          shots were imported with a wrong equipment value (e.g. seeded
          incorrectly during the v1.8 migration). Destructive — wipes the
          snapshot semantic for the affected shots, so a clear confirmation. */}
      {overwriteCount > 0 && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text)',
          lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: 'var(--amber)' }}>{overwriteCount}</strong>{' '}
            shot{overwriteCount === 1 ? '' : 's'} are tagged with equipment
            that doesn't match the current bag. Useful when you've corrected
            a bag entry and want existing shots to follow.
          </div>
          <button
            className="btn-secondary"
            style={{ width: '100%', padding: '6px 10px', fontSize: 11 }}
            onClick={() => {
              if (confirm(
                'Overwrite equipment on ' + overwriteCount + ' shot' + (overwriteCount === 1 ? '' : 's') +
                '?\n\nThis will replace their current equipment tags with whatever your bag says for their club. ' +
                'Use this when the bag is now correct and you want existing shots to match.'
              )) {
                onOverwriteFromBag();
              }
            }}
            title="Replace existing equipment values with what the bag says now"
          >
            Overwrite equipment from bag
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Bulk-tag panel. Pick equipment first; the available clubs to apply it
 * to are auto-filtered to that equipment's category (you can't apply an
 * iron model to a wedge slot). User then checks which clubs to apply to
 * (defaulting to no checks — explicit selection).
 *
 * Renders inline inside BagPanel; closes on apply / cancel.
 */
function BulkBagPanel({ bag, rowClubs, onApply, onClose }) {
  const [equipment, setEquipment] = useState(null);
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // Eligible clubs: those in the current bag rows that match the chosen
  // equipment's category. Until equipment is picked, no clubs render.
  const eligibleClubs = category
    ? rowClubs.filter((c) => clubCategory(c) === category)
    : [];

  return (
    <div style={{
      padding: 10,
      background: 'var(--bg-elev-3)',
      border: '1px solid var(--border-strong)',
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        Bulk tag — set one equipment across many clubs
      </div>

      {/* Step 1: category */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        1. Pick equipment category:
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {['driver', 'wood', 'hybrid', 'iron', 'wedge'].map((cat) => (
          <button
            key={cat}
            className={`chip ${category === cat ? 'active' : ''}`}
            onClick={() => { setCategory(cat); setEquipment(null); setSelected(new Set()); }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Step 2: equipment picker — same category-aware flow as elsewhere */}
      {category && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            2. Pick equipment:
          </div>
          <BagInlinePicker
            category={category}
            brands={getBrandsForCategory(category)}
            current={equipment}
            onPick={(eq) => setEquipment(eq)}
            onClose={() => { /* keep open inside bulk mode */ }}
          />
        </>
      )}

      {/* Step 3: apply-to clubs (checkboxes) */}
      {equipment && eligibleClubs.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, marginBottom: 4 }}>
            3. Apply <span style={{ color: 'var(--text)', fontWeight: 600 }}>{equipment}</span> to:
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {eligibleClubs.map((c) => (
              <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.has(c)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(c); else next.delete(c);
                    setSelected(next);
                  }}
                />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 600 }}>{c}</span>
                {bag[c] && (
                  <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                    (was {bag[c]})
                  </span>
                )}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              className="btn-secondary"
              style={{ padding: '3px 10px', fontSize: 10 }}
              onClick={() => setSelected(new Set(eligibleClubs))}
            >
              SELECT ALL
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '3px 10px', fontSize: 10 }}
              onClick={() => setSelected(new Set())}
            >
              CLEAR
            </button>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button
          className="btn-primary"
          disabled={!equipment || selected.size === 0}
          onClick={() => onApply([...selected], equipment)}
          style={{ padding: '5px 12px', fontSize: 10 }}
          title={!equipment ? 'Pick equipment first' : selected.size === 0 ? 'Select at least one club' : 'Apply equipment to selected clubs'}
        >
          APPLY TO {selected.size} CLUB{selected.size === 1 ? '' : 'S'}
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

/**
 * Inline bag-row picker. Same brand-then-model two-step as the existing
 * EquipmentPicker but rendered compact for inline use inside a settings row.
 * Filtered to the row's club category so a wedge row only shows wedge brands.
 */
function BagInlinePicker({ category, brands, current, onPick, onClose }) {
  const currentBrand = current
    ? brands.find((b) => current.startsWith(b.brand))?.brand || null
    : null;
  const [brand, setBrand] = useState(currentBrand);
  const brandObj = brands.find((b) => b.brand === brand);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: 8,
        background: 'var(--bg-elev-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 4,
        width: '100%',
      }}
    >
      {!brand ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {brands.map((b) => {
            const isCurrent = current && current.startsWith(b.brand);
            return (
              <button
                key={b.brand}
                className={`chip ${isCurrent ? 'active' : ''}`}
                onClick={() => setBrand(b.brand)}
              >
                {b.brand}{isCurrent ? ' ✓' : ''}
              </button>
            );
          })}
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 9, marginLeft: 4 }} onClick={() => onPick(null)}>
            CLEAR
          </button>
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: 9 }} onClick={onClose}>
            CANCEL
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: 9 }} onClick={() => setBrand(null)}>
              ‹ BRANDS
            </button>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700 }}>
              {brand}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              className={`chip ${current === brand ? 'active' : ''}`}
              onClick={() => onPick(brand)}
            >
              {brand} (unspecified){current === brand ? ' ✓' : ''}
            </button>
            {brandObj?.models.map((m) => {
              const full = `${brand} ${m}`;
              return (
                <button
                  key={m}
                  className={`chip ${current === full ? 'active' : ''}`}
                  onClick={() => onPick(full)}
                >
                  {m}{current === full ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
