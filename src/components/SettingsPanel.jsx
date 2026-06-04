import { useEffect, useRef, useState } from 'react';
import BagPanel from './BagPanel';

/**
 * Settings popover hung off the gear icon in the TopBar. Currently houses
 * just the user list — selecting the active user, adding/editing/deleting
 * users. Future home for any other global app preferences.
 *
 * The panel anchors to the gear icon's position via an inline transform.
 * Closes on Escape, on click-outside, or when the user explicitly hits the
 * X close button.
 */
export default function SettingsPanel({
  users, activeUserId,
  onSelectUser, onEditUser, onAddUser, onDeleteUser,
  // Orphans: shots whose userId points at a user that no longer exists.
  // Typical after restoring a v1 backup on a fresh device. Pass null to
  // hide the orphans section entirely (e.g. while loading).
  orphanCount, onReattributeOrphans,
  // Bag editor — per-user equipment-by-club mapping. The panel renders
  // a BagPanel for the active user (only one bag is editable at a time
  // to keep the UI focused; users switch active player to edit their own).
  activeUser, activeBag, onSetBagEntry,
  userClubs, allClubLabels,
  missingEquipmentCount, onFillMissingEquipment,
  onClose,
}) {
  const ref = useRef();
  const [reattributing, setReattributing] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', onKey);
    // Defer to avoid catching the click that opened the panel
    const t = setTimeout(() => window.addEventListener('mousedown', onClick), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
      clearTimeout(t);
    };
  }, [onClose]);

  return (
    <div className="settings-panel" ref={ref}>
      <div className="settings-header">
        <div className="settings-title">Settings</div>
        <button className="settings-close" onClick={onClose}>×</button>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">Players</div>
        <div className="settings-user-list">
          {users.map((u) => {
            const active = u.id === activeUserId;
            return (
              <div key={u.id} className={`settings-user-row ${active ? 'active' : ''}`}>
                <button
                  className="settings-user-main"
                  onClick={() => onSelectUser(u.id)}
                  title={active ? 'Active player' : 'Switch to this player'}
                >
                  <div className="settings-user-name">
                    {active && <span className="settings-user-dot">●</span>}
                    {u.name}
                  </div>
                  <div className="settings-user-meta">
                    {u.handicap != null ? `HCP ${u.handicap}` : 'no handicap'}
                    {' · '}
                    {u.rightHanded ? 'RH' : 'LH'}
                  </div>
                </button>
                <div className="settings-user-actions">
                  <button
                    className="settings-user-action"
                    onClick={() => onEditUser(u.id)}
                    title="Edit player"
                  >
                    ✎
                  </button>
                  {users.length > 1 && (
                    <button
                      className="settings-user-action danger"
                      onClick={() => onDeleteUser(u.id)}
                      title="Delete player (does not delete their shots)"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn-secondary" onClick={onAddUser} style={{ marginTop: 10, width: '100%' }}>
          + Add player
        </button>
      </div>
      {activeUser && (
        <div className="settings-section">
          <div className="settings-section-title">Bag</div>
          <BagPanel
            userId={activeUser.id}
            userName={activeUser.name}
            bag={activeBag || {}}
            onSetEntry={onSetBagEntry}
            userClubs={userClubs || []}
            allClubLabels={allClubLabels || []}
            missingCount={missingEquipmentCount || 0}
            onFillMissing={onFillMissingEquipment}
          />
        </div>
      )}
      {orphanCount > 0 && (
        <div className="settings-section">
          <div className="settings-section-title">Data attribution</div>
          <div style={{
            padding: 10,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.4)',
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--text)',
            lineHeight: 1.5,
          }}>
            <div style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--amber)' }}>{orphanCount}</strong>{' '}
              shot{orphanCount === 1 ? '' : 's'} reference a player that doesn't
              exist on this device. Typical after restoring a backup from another
              device — the shots came along, but their player record didn't.
            </div>
            <button
              className="btn-secondary"
              style={{ width: '100%', padding: '6px 10px', fontSize: 11 }}
              disabled={reattributing}
              onClick={async () => {
                setReattributing(true);
                try {
                  await onReattributeOrphans();
                } finally {
                  setReattributing(false);
                }
              }}
              title="Reassign these shots to your active player"
            >
              {reattributing ? 'Re-attributing…' : `Re-attribute to active player`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
