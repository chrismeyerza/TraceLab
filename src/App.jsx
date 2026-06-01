import { useState, useEffect, useMemo } from 'react';
import { orderedClubs } from './lib/clubs';
import { loadUnits, saveUnits } from './lib/units';
import {
  getAllShots, addShots, clearAllShots, deleteSession,
  deleteShot, updateShot, updateShots, migrateDedupKeys, migrateShotMeta,
  exportAllShotsAsJson, makeExportFilename, importShotsFromJson,
} from './lib/storage';
import { parseForesightFile } from './lib/parser';
import {
  getUsers, getActiveUserId, setActiveUserId,
  addUser, updateUser, deleteUser, backfillShotUsers,
} from './lib/users';
import { collectTags, shotHasAnyTag } from './lib/tags';
import TopBar from './components/TopBar';
import FilterBar from './components/FilterBar';
import ScopeSummary from './components/ScopeSummary';
import EmptyState from './components/EmptyState';
import ConfirmDialog from './components/ConfirmDialog';
import UserModal from './components/UserModal';
import SettingsPanel from './components/SettingsPanel';
import ImportUserModal from './components/ImportUserModal';
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
  // Shot-type filter. Defaults to full-only so analysis baselines stay clean
  // (the whole point of shot typing). User widens via the TYPES filter row,
  // which only appears once the data actually contains non-full shots.
  const [selectedTypes, setSelectedTypes] = useState(['full']);
  // Equipment filter: list of equipment strings (e.g. "Titleist T150") that
  // the user wants to see. Empty array = no equipment filter (all shots).
  // Same OR-within-row semantics as clubs.
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  // Free-form tag filter: list of tag strings. Empty = no tag filter.
  // OR-within-row (a shot matches if it has ANY of the selected tags).
  const [selectedTags, setSelectedTags] = useState([]);
  const [pinnedSession, setPinnedSession] = useState(null); // {id, label} or null
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [units, setUnits] = useState(loadUnits);

  // User state. `users` is the full list; `activeUserId` is whichever one
  // is currently selected. Both initialised from localStorage on mount.
  // `rightHanded` is now derived per-user — lefties get correctly-mirrored
  // Shape classification automatically.
  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserIdState] = useState(null);
  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );
  const rightHanded = activeUser?.rightHanded ?? true;

  // Modal & flow states
  const [showSettings, setShowSettings] = useState(false);
  const [userModalMode, setUserModalMode] = useState(null); // 'add' | 'edit' | null
  const [userModalInitial, setUserModalInitial] = useState(null);
  // Pending CSV/XLSX import waiting for user attribution. Holds the parsed
  // shots and metadata until the user picks who they belong to.
  const [pendingImport, setPendingImport] = useState(null);

  const toggleUnits = () => {
    const next = units.distance === 'yds' ? { distance: 'm', speed: 'kmh' } : { distance: 'yds', speed: 'mph' };
    setUnits(next);
    saveUnits(next);
  };

  const refreshUsers = () => {
    setUsers(getUsers());
    setActiveUserIdState(getActiveUserId());
  };

  // Initial load. User setup happens first so the first-launch modal can
  // fire immediately if needed. Shots still load — they'll be backfilled to
  // the user's id once the first-launch modal completes (see handleCreateUser).
  useEffect(() => {
    (async () => {
      try {
        await migrateDedupKeys();
        await migrateShotMeta();
        const existing = getUsers();
        setUsers(existing);
        setActiveUserIdState(getActiveUserId());
        const all = await getAllShots();
        if (existing.length === 0) {
          // First launch: auto-seed a default user so the experience is
          // "confirm/complete your profile" rather than "fill in a blank
          // form". The user becomes active immediately, existing shots get
          // backfilled to them, and we open the edit modal pre-filled so the
          // person can set handicap + hand (and change the name if they want).
          const seeded = addUser({ name: 'Chris Meyer', handicap: null, rightHanded: true });
          await backfillShotUsers(getAllShots, updateShots, seeded.id);
          const reloaded = await getAllShots();
          setShots(reloaded);
          setUsers(getUsers());
          setActiveUserIdState(getActiveUserId());
          // Open the edit modal on the seeded user so they can complete it.
          setUserModalInitial(seeded);
          setUserModalMode('firstLaunchEdit');
        } else {
          setShots(all);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allClubs = useMemo(() => orderedClubs([...new Set(shots.map((s) => s.club))]), [shots]);

  // Distinct shot types present in the data. The TYPES filter row is shown
  // whenever there are any shots — even with only Full shots, we display the
  // row with just the Full chip so the user can SEE that the default
  // analysis filter is "Full only" rather than discovering it implicitly.
  // (Earlier we hid the row when all shots were Full; that made the
  // auto-filtering invisible. Honest UI surfaces the filter.)
  const availableTypes = useMemo(() => {
    const set = new Set(shots.map((s) => s.shotType || 'full'));
    return [...set];
  }, [shots]);
  const showTypes = shots.length > 0;

  // Distinct equipment values present in the data. EQUIPMENT row appears
  // only when at least one shot has equipment set — no point showing an
  // empty filter row. Sorted alphabetically so the chip order is stable.
  const availableEquipment = useMemo(() => {
    const set = new Set();
    for (const s of shots) {
      if (s.equipment) set.add(s.equipment);
    }
    return [...set].sort();
  }, [shots]);
  const showEquipment = availableEquipment.length > 0;

  // Distinct free-form tags across the dataset, with usage counts. Used both
  // by the FilterBar (chip row) and by the TagEditor's autocomplete pool.
  // Hidden until at least one tag exists, same pattern.
  const availableTagsList = useMemo(() => collectTags(shots), [shots]);
  const showTags = availableTagsList.length > 0;

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
      // Shot-type filter. A shot's type defaults to 'full' if unset (legacy
      // shots pre-migration, though migration should have backfilled them).
      const type = s.shotType || 'full';
      if (selectedTypes.length && !selectedTypes.includes(type)) return false;
      // Equipment filter (OR within row, AND across rows). Empty selection
      // means "no equipment filter" — show all regardless of equipment value.
      if (selectedEquipment.length && !selectedEquipment.includes(s.equipment)) return false;
      // Free-form tag filter (OR within row). shotHasAnyTag treats empty
      // selectedTags as "no filter" → returns true for every shot.
      if (!shotHasAnyTag(s, selectedTags)) return false;
      return true;
    });
  }, [shots, selectedClubs, timeFilter, pinnedSession, newestSessionIds, selectedTypes, selectedEquipment, selectedTags]);

  // The Shots view is a DATA EDITOR, not an analysis surface. It must show
  // every shot in the club/time/session scope regardless of shot-type, so the
  // user can SEE and tag shots. Applying the type filter here caused a
  // confusing bug: reclassifying a shot to a non-selected type made it vanish
  // (looked like the edit "didn't stick"). So Shots gets everything-but-type.
  // Equipment and free-form tag filters DO apply here — those are filters
  // the user actively engages, unlike the silent type=full default.
  const shotsForEditing = useMemo(() => {
    return shots.filter((s) => {
      if (selectedClubs.length && !selectedClubs.includes(s.club)) return false;
      if (pinnedSession && s.sessionId !== pinnedSession.id) return false;
      if (!inTimeWindow(s, newestSessionIds)) return false;
      if (selectedEquipment.length && !selectedEquipment.includes(s.equipment)) return false;
      if (!shotHasAnyTag(s, selectedTags)) return false;
      return true;
    });
  }, [shots, selectedClubs, timeFilter, pinnedSession, newestSessionIds, selectedEquipment, selectedTags]);

  /**
   * Step 1 of import: parse the file and pause. We don't write to storage
   * yet — we first need to know which user the shots should be attributed
   * to. The ImportUserModal opens; on resolve, commitImport finishes.
   *
   * Edge case: if there's only one user, we skip the modal and attribute
   * automatically. No point in prompting.
   */
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
      setImportStatus(null);
      const currentUsers = getUsers();
      if (currentUsers.length <= 1) {
        // Single-user case — attribute and finish in one step.
        const userId = currentUsers[0]?.id || getActiveUserId();
        await commitImport(newShots, sessionLabel, userId);
      } else {
        // Multi-user case — pause and ask.
        setPendingImport({ fileName: file.name, sessionLabel, shots: newShots });
      }
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: 'Failed to parse file: ' + e.message });
    }
  }

  /**
   * Step 2 of import: actually write the shots with a userId stamp.
   * Called after the ImportUserModal resolves with a chosen user.
   */
  async function commitImport(newShots, sessionLabel, userId) {
    setImportStatus({ status: 'loading', message: 'Importing…' });
    try {
      const stamped = newShots.map((s) => ({ ...s, userId }));
      const { added, skipped } = await addShots(stamped);
      const all = await getAllShots();
      setShots(all);
      setImportStatus({
        status: 'success',
        message: `Imported ${added} shots from ${sessionLabel}${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`,
      });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: 'Import failed: ' + e.message });
    }
  }

  /** Resolution from the ImportUserModal. */
  async function handleImportUserResolution(resolution) {
    if (!pendingImport) return;
    if (resolution.kind === 'useExisting') {
      const { shots: newShots, sessionLabel } = pendingImport;
      setPendingImport(null);
      await commitImport(newShots, sessionLabel, resolution.userId);
    } else if (resolution.kind === 'createNew') {
      // Stash the pending import; open the add-user modal. When the user
      // submits, the new user is created and we'll auto-commit to them.
      setUserModalMode('add');
      setUserModalInitial(null);
    }
  }

  async function handleClearAll() {
    await clearAllShots();
    setShots([]);
    setSelectedClubs([]);
    setPinnedSession(null);
    setConfirmClear(false);
  }

  /**
   * Export the entire shot store as a JSON backup file. Uses the standard
   * browser anchor-and-click pattern: build a Blob, create an object URL,
   * synthesize a download click, then revoke the URL. No data leaves the
   * device (no upload, no server).
   */
  async function handleExport() {
    setImportStatus({ status: 'loading', message: 'Preparing export…' });
    try {
      const blob = await exportAllShotsAsJson();
      const filename = makeExportFilename();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so the download has time to kick off.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setImportStatus({
        status: 'success',
        message: `Exported ${shots.length} shots to ${filename}`,
      });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: 'Export failed: ' + e.message });
    }
  }

  /**
   * Import a TraceLab JSON backup. Reads the file as text, hands off to
   * importShotsFromJson which validates the envelope and merges shots
   * with the existing dedupe rules (skip-existing, never overwrite).
   *
   * Note: this is a DIFFERENT path from handleFile (the CSV/XLSX import).
   * That one parses raw launch-monitor exports; this one restores a
   * previously-exported TraceLab backup. Same dedupe behaviour at the
   * storage layer, different parsing.
   */
  async function handleBackupImport(file) {
    setImportStatus({ status: 'loading', message: `Reading ${file.name}…` });
    try {
      const text = await file.text();
      const { added, skipped, total } = await importShotsFromJson(text);
      const all = await getAllShots();
      setShots(all);
      const detail =
        total === 0
          ? 'Backup file contained no shots'
          : skipped === 0
          ? `Imported ${added} shots`
          : added === 0
          ? `All ${total} shots already in your database — nothing to import`
          : `Imported ${added} new shots · skipped ${skipped} duplicates`;
      setImportStatus({ status: 'success', message: detail });
      setTimeout(() => setImportStatus(null), 6000);
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: e.message || 'Import failed' });
    }
  }

  async function handleDeleteSession(id) {
    await deleteSession(id);
    const all = await getAllShots();
    setShots(all);
    // If the deleted session was pinned, unpin
    if (pinnedSession?.id === id) setPinnedSession(null);
    setConfirmDelete(null);
  }

  // ===== User management handlers =======================================

  /**
   * Called by UserModal on submit. Resolves three different intent paths:
   *   - firstLaunch  → create + backfill existing shots to this user
   *   - add          → create. If there's a pending import, attribute it
   *                    to the new user automatically (smooth flow from
   *                    ImportUserModal → AddUser → Import)
   *   - edit         → update existing
   */
  async function handleUserSubmit(formData) {
    // First-launch edit: the user was already auto-seeded and shots already
    // backfilled during boot. This submit just completes their profile
    // (handicap, hand, possibly a name change).
    if (userModalMode === 'firstLaunchEdit' && userModalInitial?.id) {
      updateUser(userModalInitial.id, formData);
      refreshUsers();
      setUserModalMode(null);
      setUserModalInitial(null);
      return;
    }
    if (userModalMode === 'edit' && userModalInitial?.id) {
      updateUser(userModalInitial.id, formData);
      refreshUsers();
      setUserModalMode(null);
      setUserModalInitial(null);
      return;
    }
    if (userModalMode === 'add') {
      const created = addUser(formData);
      refreshUsers();
      setUserModalMode(null);
      setUserModalInitial(null);
      // If we got here from the ImportUserModal "Create new user" path,
      // the newly-created user is the intended attribution target.
      if (pendingImport) {
        const { shots: newShots, sessionLabel } = pendingImport;
        setPendingImport(null);
        await commitImport(newShots, sessionLabel, created.id);
      }
    }
  }

  function handleSelectUser(id) {
    setActiveUserId(id);
    refreshUsers();
  }

  function handleEditUser(id) {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setUserModalInitial(u);
    setUserModalMode('edit');
  }

  function handleDeleteUserConfirmed(id) {
    if (!confirm(`Delete this user? Their shots stay in the database but become unattributed.`)) return;
    deleteUser(id);
    refreshUsers();
  }

  function handleAddUserFromSettings() {
    setUserModalInitial(null);
    setUserModalMode('add');
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
        activeUser={activeUser}
        settingsOpen={showSettings}
        onOpenSettings={() => setShowSettings((v) => !v)}
      />

      {showSettings && (
        <SettingsPanel
          users={users}
          activeUserId={activeUserId}
          onSelectUser={handleSelectUser}
          onEditUser={handleEditUser}
          onAddUser={handleAddUserFromSettings}
          onDeleteUser={handleDeleteUserConfirmed}
          onClose={() => setShowSettings(false)}
        />
      )}

      {userModalMode && (
        <UserModal
          mode={userModalMode}
          initial={userModalInitial}
          onSubmit={handleUserSubmit}
          onCancel={
            userModalMode === 'firstLaunchEdit'
              ? undefined
              : () => {
                  setUserModalMode(null);
                  setUserModalInitial(null);
                }
          }
        />
      )}

      {pendingImport && (
        <ImportUserModal
          users={users}
          activeUserId={activeUserId}
          fileName={pendingImport.fileName}
          onResolve={handleImportUserResolution}
          onCancel={() => {
            setPendingImport(null);
            setImportStatus(null);
          }}
        />
      )}

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
                  showTypes={showTypes}
                  availableTypes={availableTypes}
                  selectedTypes={selectedTypes}
                  setSelectedTypes={setSelectedTypes}
                  showEquipment={showEquipment}
                  availableEquipment={availableEquipment}
                  selectedEquipment={selectedEquipment}
                  setSelectedEquipment={setSelectedEquipment}
                  showTags={showTags}
                  availableTagsList={availableTagsList}
                  selectedTags={selectedTags}
                  setSelectedTags={setSelectedTags}
                />
                <ScopeSummary
                  shotsShown={filteredShots.length}
                  totalShots={totalShots}
                  selectedClubs={selectedClubs}
                  allClubs={allClubs}
                  timeFilter={timeFilter}
                  pinnedSession={pinnedSession}
                  selectedTypes={selectedTypes}
                  showTypes={showTypes}
                  availableTypes={availableTypes}
                  selectedEquipment={selectedEquipment}
                  selectedTags={selectedTags}
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
                shots={shotsForEditing}
                units={units}
                allClubs={allClubs}
                users={users}
                availableTagsList={availableTagsList}
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
                onExport={handleExport}
                onBackupImport={handleBackupImport}
                shotCount={shots.length}
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
