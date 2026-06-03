import { useState } from 'react';

/**
 * User deletion confirmation modal. When deleting a player who owns shots,
 * the user is presented with a real choice — not just a yes/no:
 *
 *   - **Reassign**: move all this user's shots to another existing player.
 *     Data preserved, only the user profile removed.
 *   - **Delete with shots**: nuke the user AND all their shots. Explicit
 *     destructive option for cases where the data was a mistake (e.g. test
 *     imports, sample data).
 *   - **Cancel**: do nothing.
 *
 * For users with zero shots, the panel simplifies to a single Delete /
 * Cancel pair — no reassign question because there's nothing to reassign.
 *
 * The "Delete with shots" option requires confirming again (typing the
 * user's name) — high-friction by design because it's truly destructive.
 */
export default function DeleteUserModal({
  user,           // the user to delete
  shotCount,      // how many shots they own
  otherUsers,     // [{ id, name }] — possible reassignment targets
  onReassign,     // (targetUserId) => Promise
  onDeleteWithShots, // () => Promise
  onCancel,
}) {
  const [reassignTo, setReassignTo] = useState(otherUsers[0]?.id || null);
  const [confirmText, setConfirmText] = useState('');
  const [mode, setMode] = useState('choose'); // 'choose' | 'confirmingDestroy'

  if (shotCount === 0) {
    // Simple case — no shots, no choice needed
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <div className="modal-header">
            <div className="modal-title">Delete {user.name}?</div>
            <div className="modal-subtitle">
              {user.name} owns no shots. Deleting this player removes only the profile.
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="btn-danger" onClick={onDeleteWithShots}>Delete player</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'confirmingDestroy') {
    const expectedText = user.name;
    const canDelete = confirmText.trim() === expectedText;
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <div className="modal-title" style={{ color: 'var(--red)' }}>
              Delete {user.name} and {shotCount} shot{shotCount === 1 ? '' : 's'}?
            </div>
            <div className="modal-subtitle">
              This permanently deletes the player profile AND every shot
              attributed to them. The data cannot be recovered.
            </div>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-label">Type "{expectedText}" to confirm</div>
              <input
                type="text"
                className="form-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedText}
                autoFocus
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => { setMode('choose'); setConfirmText(''); }}>
              Back
            </button>
            <button
              className="btn-danger"
              onClick={onDeleteWithShots}
              disabled={!canDelete}
            >
              Permanently delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default "choose" view — user owns shots, ask what to do
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Delete {user.name}?</div>
          <div className="modal-subtitle">
            {user.name} owns <strong style={{ color: 'var(--text-strong)' }}>{shotCount}</strong>{' '}
            shot{shotCount === 1 ? '' : 's'}. What should happen to their data?
          </div>
        </div>
        <div className="modal-body">
          {otherUsers.length > 0 ? (
            <div className="form-row">
              <div className="form-label">Reassign their shots to (recommended)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {otherUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setReassignTo(u.id)}
                    className={`chip ${reassignTo === u.id ? 'active' : ''}`}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      ...(reassignTo === u.id ? {
                        background: 'var(--green)', borderColor: 'var(--green)', color: '#0a0e0c',
                      } : {}),
                    }}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              No other players exist to reassign these shots to. You can
              still delete the shots along with the profile, but the data
              will be gone.
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={() => setMode('confirmingDestroy')}
            title="Permanently delete the player AND all their shots"
          >
            Delete with shots…
          </button>
          {otherUsers.length > 0 && (
            <button
              className="btn-primary"
              onClick={() => onReassign(reassignTo)}
              disabled={!reassignTo}
              title="Move all shots to the selected player, then delete this profile"
            >
              Reassign &amp; delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
