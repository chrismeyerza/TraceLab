import { useEffect, useRef, useState } from 'react';

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
  onClose,
}) {
  const ref = useRef();

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
        <div className="settings-section-title">Users</div>
        <div className="settings-user-list">
          {users.map((u) => {
            const active = u.id === activeUserId;
            return (
              <div key={u.id} className={`settings-user-row ${active ? 'active' : ''}`}>
                <button
                  className="settings-user-main"
                  onClick={() => onSelectUser(u.id)}
                  title={active ? 'Active user' : 'Switch to this user'}
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
                    title="Edit user"
                  >
                    ✎
                  </button>
                  {users.length > 1 && (
                    <button
                      className="settings-user-action danger"
                      onClick={() => onDeleteUser(u.id)}
                      title="Delete user (does not delete their shots)"
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
          + Add user
        </button>
      </div>
    </div>
  );
}
