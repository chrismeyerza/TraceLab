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
  onSetEntry,
  userClubs, allClubLabels,
  onFillMissing, missingCount,
}) {
  const [editingClub, setEditingClub] = useState(null); // which club row is open
  const [addingClub, setAddingClub] = useState(false);

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
