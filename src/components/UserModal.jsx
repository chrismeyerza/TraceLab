import { useState, useEffect } from 'react';

/**
 * Modal for capturing user details. Used in three contexts:
 *
 *   mode="firstLaunch"  — no users exist; required on app start. No cancel.
 *   mode="add"          — user clicked "Add user" in settings. Cancellable.
 *   mode="edit"         — editing an existing user. Pre-fills, has Save.
 *
 * Fields: name (required), handicap (0-54, optional), dominant hand (RH/LH).
 *
 * Validation is light: name must be non-empty; handicap (if entered) must be
 * a non-negative number. We don't enforce uniqueness on name — two users
 * can have the same display name as long as ids differ.
 */
export default function UserModal({ mode, initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [handicap, setHandicap] = useState(
    initial?.handicap == null ? '' : String(initial.handicap)
  );
  const [rightHanded, setRightHanded] = useState(
    initial?.rightHanded !== false // default true
  );

  // Focus the name field on open
  useEffect(() => {
    const el = document.getElementById('user-modal-name');
    if (el) setTimeout(() => el.focus(), 30);
  }, []);

  const isFirstLaunch = mode === 'firstLaunch' || mode === 'firstLaunchEdit';
  const trimmedName = name.trim();
  const handicapValid =
    handicap === '' || (!isNaN(Number(handicap)) && Number(handicap) >= 0 && Number(handicap) <= 54);
  const canSubmit = trimmedName.length > 0 && handicapValid;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: trimmedName,
      handicap: handicap === '' ? null : Number(handicap),
      rightHanded,
    });
  };

  return (
    <div className="modal-overlay" onClick={isFirstLaunch ? undefined : onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">
            {isFirstLaunch ? 'Welcome to TraceLab' :
             mode === 'edit' ? 'Edit user' : 'Add user'}
          </div>
          {isFirstLaunch && (
            <div className="modal-subtitle">
              We've set up a profile for you — just confirm your handicap and dominant hand. You can change the name or add more users any time.
            </div>
          )}
        </div>
        <div className="modal-body">
          <label className="form-row">
            <div className="form-label">Name</div>
            <input
              id="user-modal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
              placeholder="Your name"
              className="form-input"
            />
          </label>
          <label className="form-row">
            <div className="form-label">Handicap <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional, 0–54)</span></div>
            <input
              type="number"
              min="0"
              max="54"
              step="0.1"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
              placeholder="e.g. 12.4"
              className="form-input"
            />
            {!handicapValid && (
              <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>
                Handicap should be a number between 0 and 54.
              </div>
            )}
          </label>
          <div className="form-row">
            <div className="form-label">Dominant hand</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`chip ${rightHanded ? 'active' : ''}`}
                onClick={() => setRightHanded(true)}
                style={rightHanded ? {
                  background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c',
                  boxShadow: '0 0 0 1px var(--bg-elev-1), 0 0 0 2px var(--green)',
                } : {}}
              >
                RIGHT-HANDED
              </button>
              <button
                type="button"
                className={`chip ${!rightHanded ? 'active' : ''}`}
                onClick={() => setRightHanded(false)}
                style={!rightHanded ? {
                  background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c',
                  boxShadow: '0 0 0 1px var(--bg-elev-1), 0 0 0 2px var(--green)',
                } : {}}
              >
                LEFT-HANDED
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {!isFirstLaunch && (
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            className="btn-primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            {isFirstLaunch ? 'Get started' : mode === 'edit' ? 'Save changes' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}
