import { useRef, useState } from 'react';
import { clubColor } from '../lib/clubs';

/**
 * Sessions view: drop new exports, browse history, delete individual sessions
 * or wipe everything. Sessions are ordered newest-first.
 */
export default function SessionsView({ sessions, onFile, importStatus, onDeleteSession, onClearAll, onPinSession }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);
  const totalShots = sessions.reduce((a, s) => a + s.count, 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Sessions.</span> Your data, your history.
        </h1>
        <div className="page-meta">
          <div>{sessions.length} SESSIONS</div>
          <div>{totalShots.toLocaleString()} TOTAL SHOTS</div>
        </div>
      </div>

      <div className="two-col uneven" style={{ marginBottom: 20 }}>
        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          style={{ padding: 32 }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
          }}
        >
          <div className="dropzone-icon">⊕</div>
          <div className="dropzone-title">Add a session</div>
          <div className="dropzone-sub">Drop your Foresight export · duplicates skipped automatically</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
          />
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Data management</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
            All shots are stored locally in your browser. They never leave your device. Delete individual sessions or
            wipe everything below.
          </div>
          <button className="btn-danger" onClick={onClearAll}>
            Clear all data
          </button>
        </div>
      </div>

      {importStatus && (
        <div
          className={`insight ${
            importStatus.status === 'error' ? 'bad' : importStatus.status === 'success' ? '' : 'warn'
          }`}
          style={{ marginBottom: 20 }}
        >
          <div className="insight-title">{importStatus.status}</div>
          <div className="insight-body">{importStatus.message}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">All sessions</div>
          <div className="card-subtitle">Newest first</div>
        </div>
        <div style={{ margin: '0 -20px' }}>
          <div className="session-row header">
            <div>DATE</div>
            <div>LABEL</div>
            <div>CLUBS</div>
            <div>SHOTS</div>
            <div>SESSION ID</div>
            <div></div>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-sub">No sessions yet. Drop a file above.</div>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="session-row">
                <div>
                  {s.date
                    ? new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </div>
                <div style={{ color: 'var(--text)' }}>{s.label}</div>
                <div className="clubs">
                  {s.clubs.map((c) => (
                    <span
                      key={c}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        background: `${clubColor(c)}22`,
                        color: clubColor(c),
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div>{s.count}</div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{s.id.slice(0, 14)}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: 9 }}
                    onClick={() => onPinSession(s)}
                    title="Filter all views to this session"
                  >
                    VIEW
                  </button>
                  <button
                    className="btn-danger"
                    style={{ padding: '3px 8px', fontSize: 9 }}
                    onClick={() => onDeleteSession(s.id)}
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
