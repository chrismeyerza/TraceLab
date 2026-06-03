import { useRef } from 'react';

/**
 * First-launch welcome modal. Shown when the app loads on a fresh browser /
 * device — no users in localStorage and no shots in IndexedDB. Offers two
 * paths so a returning user on a new device doesn't get forced into
 * creating a duplicate profile:
 *
 *   1. RESTORE — pick a TraceLab backup .json. Brings player profiles AND
 *      shots in one step. User lands in the app already configured.
 *   2. CREATE — set up a fresh profile from scratch. The same flow as
 *      before (auto-seed Chris Meyer, then open the edit modal).
 *
 * The modal is non-dismissable: the user MUST pick a path because they
 * can't use the app without a profile. There's no cancel.
 *
 * Note: the actual restore happens in App.handleBackupImport; this modal
 * just calls the parent handlers that route to the right place.
 */
export default function WelcomeModal({ onRestore, onCreate }) {
  const fileRef = useRef();
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onRestore(f);
  };
  return (
    <div className="modal-overlay">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Welcome to TraceLab</div>
          <div className="modal-subtitle">
            How would you like to start?
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="welcome-card" onClick={() => fileRef.current?.click()}>
              <div className="welcome-card-title">Restore from backup</div>
              <div className="welcome-card-body">
                Already use TraceLab on another device? Pick your exported{' '}
                <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11 }}>.tracelab.json</code> file to restore
                your player profile and all your shots in one step.
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.tracelab.json,application/json"
                style={{ display: 'none' }}
                onChange={onFile}
              />
            </div>
            <div className="welcome-card" onClick={onCreate}>
              <div className="welcome-card-title">Set up a new profile</div>
              <div className="welcome-card-body">
                First time using TraceLab? Create your player profile and start importing sessions.
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div style={{ flex: 1, fontSize: 11, color: 'var(--text-faint)' }}>
            Your data stays in this browser. No accounts, no sync.
          </div>
        </div>
      </div>
    </div>
  );
}
