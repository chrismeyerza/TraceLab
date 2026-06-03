import { useState } from 'react';

/**
 * Prompt the user to attribute an incoming session to a person before the
 * shots get imported. Three resolutions:
 *
 *   "useExisting"   — pick one of the existing users
 *   "createNew"     — caller opens the new-user flow
 *   "cancel"        — abandon the import
 *
 * Default selection is the currently-active user, on the principle that most
 * imports are "more of mine". Quick path for that common case: hit Enter.
 */
export default function ImportUserModal({ users, activeUserId, fileName, onResolve, onCancel }) {
  const [selectedId, setSelectedId] = useState(activeUserId || users[0]?.id);

  const submit = () => {
    if (selectedId) onResolve({ kind: 'useExisting', userId: selectedId });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">Whose shots are these?</div>
          <div className="modal-subtitle">
            Importing <strong style={{ color: 'var(--text-strong)' }}>{fileName}</strong>. Attribute these shots to a player.
          </div>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-label">Existing players</div>
            <div className="settings-user-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {users.map((u) => (
                <button
                  key={u.id}
                  className={`settings-user-main ${selectedId === u.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(u.id)}
                  style={{
                    width: '100%',
                    background: selectedId === u.id ? 'rgba(74,222,128,0.10)' : 'transparent',
                    border: selectedId === u.id ? '1px solid var(--green)' : '1px solid var(--border)',
                    marginBottom: 6,
                    padding: 10,
                  }}
                >
                  <div className="settings-user-name">
                    {selectedId === u.id && <span className="settings-user-dot">●</span>}
                    {u.name}
                  </div>
                  <div className="settings-user-meta">
                    {u.handicap != null ? `HCP ${u.handicap}` : 'no handicap'}
                    {' · '}
                    {u.rightHanded ? 'RH' : 'LH'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => onResolve({ kind: 'createNew' })}
          >
            + Create new player
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!selectedId}
          >
            Import as this user
          </button>
        </div>
      </div>
    </div>
  );
}
