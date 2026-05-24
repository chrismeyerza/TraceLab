import { useRef, useState } from 'react';

/**
 * First-run experience shown when the user has zero shots. Drag-and-drop zone
 * for the first Foresight export, plus a brief feature pitch underneath.
 */
export default function EmptyState({ onFile, importStatus }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="accent">Get more</span> from every shot.
        </h1>
        <div className="page-meta">
          <div>FORESIGHT GCQUAD MAX · FSX PLAY</div>
          <div>SESSION-OVER-SESSION ANALYTICS</div>
        </div>
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
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
        <div className="dropzone-title">Drop your first Foresight export</div>
        <div className="dropzone-sub">.csv, .xlsx or .xls · drag here or click to browse</div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
        />
      </div>

      {importStatus && (
        <div
          className={`insight ${
            importStatus.status === 'error' ? 'bad' : importStatus.status === 'success' ? '' : 'warn'
          }`}
          style={{ marginTop: 20 }}
        >
          <div className="insight-title">{importStatus.status}</div>
          <div className="insight-body">{importStatus.message}</div>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">What you get</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <FeatureBlock
              num="01"
              title="Strike Heatmaps"
              desc="Per-club impact location with ball-speed loss overlay. See exactly what your toe-misses cost you."
            />
            <FeatureBlock
              num="02"
              title="Flight Windows"
              desc="Launch, spin, descent and peak height plotted against tour-optimal zones. Are you flighting it right?"
            />
            <FeatureBlock
              num="03"
              title="Shape & Delivery"
              desc="Face, path and the gap between them. The 9-ball-flight matrix. Your actual shot dispersion."
            />
            <FeatureBlock
              num="04"
              title="Build Over Time"
              desc="Drop in each new session. Everything aggregates. Tens of thousands of shots, all yours, all local."
            />
          </div>
        </div>
      </div>
    </>
  );
}

function FeatureBlock({ num, title, desc }) {
  return (
    <div style={{ padding: 14 }}>
      <div className="mono" style={{ fontSize: 10, color: 'var(--green)', letterSpacing: '0.14em', marginBottom: 6 }}>
        {num}
      </div>
      <div className="display" style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}
