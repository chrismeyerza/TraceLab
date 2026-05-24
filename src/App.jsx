import { useState, useEffect, useMemo } from 'react';
import { orderedClubs } from './lib/clubs';
import { loadUnits, saveUnits } from './lib/units';
import { getAllShots, addShots, clearAllShots, deleteSession } from './lib/storage';
import { parseForesightFile } from './lib/parser';
import TopBar from './components/TopBar';
import FilterBar from './components/FilterBar';
import EmptyState from './components/EmptyState';
import ConfirmDialog from './components/ConfirmDialog';
import OverviewView from './views/OverviewView';
import StrikeView from './views/StrikeView';
import FlightView from './views/FlightView';
import ShapeView from './views/ShapeView';
import SessionsView from './views/SessionsView';

/**
 * Top-level component. Owns all global state:
 *   - shots (loaded from IndexedDB on mount)
 *   - current view (overview/strike/flight/shape/sessions)
 *   - selected clubs (filter)
 *   - units (yds/mph vs m/km-h, persisted in localStorage)
 *   - import status and confirmation dialogs
 */
export default function App() {
  const [shots, setShots] = useState([]);
  const [view, setView] = useState('overview');
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [rightHanded] = useState(true); // TODO: settings toggle
  const [units, setUnits] = useState(loadUnits);

  const toggleUnits = () => {
    const next = units.distance === 'yds' ? { distance: 'm', speed: 'kmh' } : { distance: 'yds', speed: 'mph' };
    setUnits(next);
    saveUnits(next);
  };

  // Initial load from IndexedDB
  useEffect(() => {
    (async () => {
      try {
        const all = await getAllShots();
        setShots(all);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allClubs = useMemo(() => orderedClubs([...new Set(shots.map((s) => s.club))]), [shots]);

  // Default-select every club when data first loads
  useEffect(() => {
    if (allClubs.length && selectedClubs.length === 0) {
      setSelectedClubs(allClubs);
    }
  }, [allClubs, selectedClubs.length]);

  const filteredShots = useMemo(() => {
    if (!selectedClubs.length) return shots;
    return shots.filter((s) => selectedClubs.includes(s.club));
  }, [shots, selectedClubs]);

  // Derive sessions from shots (group by sessionId)
  const sessions = useMemo(() => {
    const m = new Map();
    shots.forEach((s) => {
      if (!m.has(s.sessionId)) {
        m.set(s.sessionId, {
          id: s.sessionId,
          label: s.sessionLabel,
          date: s.createdAt,
          clubs: new Set(),
          count: 0,
        });
      }
      const sess = m.get(s.sessionId);
      sess.clubs.add(s.club);
      sess.count++;
      if (s.createdAt && (!sess.date || s.createdAt < sess.date)) sess.date = s.createdAt;
    });
    return [...m.values()]
      .map((s) => ({ ...s, clubs: orderedClubs([...s.clubs]) }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [shots]);

  async function handleFile(file) {
    setImportStatus({ status: 'loading', message: `Parsing ${file.name}...` });
    try {
      const buf = await file.arrayBuffer();
      const { sessionLabel, shots: newShots } = parseForesightFile(buf, file.name);
      if (newShots.length === 0) {
        setImportStatus({ status: 'error', message: 'No shots found in file' });
        return;
      }
      const { added, skipped } = await addShots(newShots);
      const all = await getAllShots();
      setShots(all);
      setImportStatus({
        status: 'success',
        message: `Imported ${added} shots from ${sessionLabel}${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`,
      });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: 'Failed to parse file: ' + e.message });
    }
  }

  async function handleClearAll() {
    await clearAllShots();
    setShots([]);
    setSelectedClubs([]);
    setConfirmClear(false);
  }

  async function handleDeleteSession(id) {
    await deleteSession(id);
    const all = await getAllShots();
    setShots(all);
    setConfirmDelete(null);
  }

  const totalSessions = sessions.length;
  const totalShots = shots.length;
  const lastSessionDate = sessions[0]?.date
    ? new Date(sessions[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <>
      <TopBar
        view={view}
        setView={setView}
        units={units}
        toggleUnits={toggleUnits}
        totalSessions={totalSessions}
        totalShots={totalShots}
        lastSessionDate={lastSessionDate}
      />

      <main className="main">
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-sub">Loading...</div>
          </div>
        ) : totalShots === 0 ? (
          <EmptyState onFile={handleFile} importStatus={importStatus} />
        ) : (
          <>
            {view !== 'sessions' && allClubs.length > 0 && (
              <FilterBar clubs={allClubs} selected={selectedClubs} setSelected={setSelectedClubs} />
            )}
            {view === 'overview' && (
              <OverviewView shots={filteredShots} sessions={sessions} rightHanded={rightHanded} units={units} />
            )}
            {view === 'strike' && <StrikeView shots={filteredShots} units={units} />}
            {view === 'flight' && <FlightView shots={filteredShots} units={units} />}
            {view === 'shape' && <ShapeView shots={filteredShots} rightHanded={rightHanded} />}
            {view === 'sessions' && (
              <SessionsView
                sessions={sessions}
                onFile={handleFile}
                importStatus={importStatus}
                onDeleteSession={(id) => setConfirmDelete(id)}
                onClearAll={() => setConfirmClear(true)}
              />
            )}
          </>
        )}

        <div className="footer">
          <div>FORESIGHT ANALYTICS · LOCAL DATA · NO SYNC</div>
          <div>
            <span className="v">●</span> ALL DATA STORED IN BROWSER · {totalShots.toLocaleString()} SHOTS
          </div>
        </div>
      </main>

      {confirmClear && (
        <ConfirmDialog
          title="Clear all data?"
          body={`This will permanently delete all ${totalShots.toLocaleString()} shots across ${totalSessions} sessions. This cannot be undone.`}
          confirmLabel="Delete Everything"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete session?"
          body="This will permanently delete this session and all its shots."
          confirmLabel="Delete Session"
          onConfirm={() => handleDeleteSession(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
