import { useState, useEffect, useMemo } from 'react';
import { orderedClubs } from './lib/clubs';
import { loadUnits, saveUnits } from './lib/units';
import {
  getAllShots, addShots, clearAllShots, deleteSession,
  deleteShot, updateShot, updateShots, migrateDedupKeys,
} from './lib/storage';
import { parseForesightFile } from './lib/parser';
import TopBar from './components/TopBar';
import FilterBar from './components/FilterBar';
import ScopeSummary from './components/ScopeSummary';
import EmptyState from './components/EmptyState';
import ConfirmDialog from './components/ConfirmDialog';
import OverviewView from './views/OverviewView';
import StrikeView from './views/StrikeView';
import FlightView from './views/FlightView';
import DistanceView from './views/DistanceView';
import ShapeView from './views/ShapeView';
import ShotsView from './views/ShotsView';
import SessionsView from './views/SessionsView';

/**
 * Top-level component. Owns all global state:
 *   - shots (loaded from IndexedDB on mount, with one-off migration applied)
 *   - current view
 *   - filters: clubs (multi-select), time period (single-select), pinned session
 *   - units (yds/mph vs m/km-h, persisted in localStorage)
 *   - import status, confirmation dialogs
 *
 * The filteredShots memo intersects all three filters with AND semantics, then
 * passes that derived set down to every analytical view. The Shots view also
 * receives the same filtered set so editing happens in scope.
 */
export default function App() {
  const [shots, setShots] = useState([]);
  const [view, setView] = useState('sessions');
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all');
  const [pinnedSession, setPinnedSession] = useState(null); // {id, label} or null
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

  // Initial load. Runs the dedup-key migration on first load after upgrade,
  // then reads everything fresh so the in-memory state reflects the migrated
  // dedup values. Migration is idempotent so re-runs are harmless.
  useEffect(() => {
    (async () => {
      try {
        await migrateDedupKeys();
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

  // Default-select every club when data first loads. Also reset when the
  // underlying club set changes (e.g. after a bulk relabel that introduces
  // a new club or removes an old one).
  useEffect(() => {
    if (allClubs.length === 0) return;
    // Keep selection if every selected club is still present; otherwise reset
    const stillValid = selectedClubs.filter((c) => allClubs.includes(c));
    if (stillValid.length === 0) setSelectedClubs(allClubs);
    else if (stillValid.length !== selectedClubs.length) setSelectedClubs(stillValid);
  }, [allClubs.join(',')]); // depend on the actual club list, not array identity

  /**
   * Decide whether a shot's createdAt timestamp falls inside the active time
   * window. Returns true for everything if no filter, or if a shot has no
   * timestamp (we don't want to silently drop those).
   */
  const inTimeWindow = (shot, sessionsForLast) => {
    if (timeFilter === 'all') return true;
    if (!shot.createdAt) return true;
    const t = new Date(shot.createdAt).getTime();
    if (timeFilter === '30d') return t >= Date.now() - 30 * 86400000;
    if (timeFilter === '90d') return t >= Date.now() - 90 * 86400000;
    if (timeFilter === 'last') return sessionsForLast.has(shot.sessionId);
    return true;
  };

  // Derive sessions from shots (group by sessionId). Done before filteredShots
  // because filteredShots needs the "newest session" set for the 'last' filter.
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

  // For 'last session' filter: keep just the newest session's id.
  const newestSessionIds = useMemo(() => {
    const s = new Set();
    if (sessions[0]) s.add(sessions[0].id);
    return s;
  }, [sessions]);

  const filteredShots = useMemo(() => {
    return shots.filter((s) => {
      if (selectedClubs.length && !selectedClubs.includes(s.club)) return false;
      if (pinnedSession && s.sessionId !== pinnedSession.id) return false;
      if (!inTimeWindow(s, newestSessionIds)) return false;
      return true;
    });
  }, [shots, selectedClubs, timeFilter, pinnedSession, newestSessionIds]);

  async function handleFile(file) {
    setImportStatus({ status: 'loading', message: `Parsing ${file.name}...` });
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const data = isCsv ? await file.text() : await file.arrayBuffer();
      const { sessionLabel, shots: newShots } = parseForesightFile(data, file.name);
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
    setPinnedSession(null);
    setConfirmClear(false);
  }

  async function handleDeleteSession(id) {
    await deleteSession(id);
    const all = await getAllShots();
    setShots(all);
    // If the deleted session was pinned, unpin
    if (pinnedSession?.id === id) setPinnedSession(null);
    setConfirmDelete(null);
  }

  async function handleDeleteShot(id) {
    await deleteShot(id);
    setShots((curr) => curr.filter((s) => s.id !== id));
  }

  async function handleUpdateShot(id, patch) {
    const updated = await updateShot(id, patch);
    if (updated) setShots((curr) => curr.map((s) => (s.id === id ? updated : s)));
  }

  async function handleUpdateShots(updates) {
    const result = await updateShots(updates);
    if (result.length) {
      const byId = new Map(result.map((r) => [r.id, r]));
      setShots((curr) => curr.map((s) => byId.get(s.id) || s));
    }
  }

  function handlePinSession(s) {
    setPinnedSession({ id: s.id, label: s.label });
    setView('overview'); // jump to overview so the user sees the filtered data
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
              <>
                <FilterBar
                  clubs={allClubs}
                  selected={selectedClubs}
                  setSelected={setSelectedClubs}
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                  pinnedSession={pinnedSession}
                  setPinnedSession={setPinnedSession}
                />
                <ScopeSummary
                  shotsShown={filteredShots.length}
                  totalShots={totalShots}
                  selectedClubs={selectedClubs}
                  allClubs={allClubs}
                  timeFilter={timeFilter}
                  pinnedSession={pinnedSession}
                />
              </>
            )}
            {view === 'overview' && (
              <OverviewView shots={filteredShots} sessions={sessions} rightHanded={rightHanded} units={units} />
            )}
            {view === 'strike' && <StrikeView shots={filteredShots} units={units} />}
            {view === 'flight' && <FlightView shots={filteredShots} units={units} />}
            {view === 'distance' && <DistanceView shots={filteredShots} units={units} />}
            {view === 'shape' && <ShapeView shots={filteredShots} rightHanded={rightHanded} />}
            {view === 'shots' && (
              <ShotsView
                shots={filteredShots}
                units={units}
                allClubs={allClubs}
                onUpdateShot={handleUpdateShot}
                onUpdateShots={handleUpdateShots}
                onDeleteShot={handleDeleteShot}
              />
            )}
            {view === 'sessions' && (
              <SessionsView
                sessions={sessions}
                onFile={handleFile}
                importStatus={importStatus}
                onDeleteSession={(id) => setConfirmDelete(id)}
                onClearAll={() => setConfirmClear(true)}
                onPinSession={handlePinSession}
              />
            )}
          </>
        )}

        <div className="footer">
          <div>TRACELAB · LOCAL DATA · NO SYNC</div>
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
