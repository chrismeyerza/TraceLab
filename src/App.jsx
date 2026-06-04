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
  surveyOrphanedShots, reattributeOrphans,
} from './lib/users';
import {
  getBag, setBagEntry, getBagEntry,
  seedBagFromShots, stampEquipmentFromBag, deleteBag,
} from './lib/bag';
import { collectTags, shotHasAnyTag, renameTagInShots, deleteTagFromShots } from './lib/tags';
import TopBar from './components/TopBar';
import FilterBar from './components/FilterBar';
import ScopeSummary from './components/ScopeSummary';
import EmptyState from './components/EmptyState';
import ConfirmDialog from './components/ConfirmDialog';
import UserModal from './components/UserModal';
import WelcomeModal from './components/WelcomeModal';
import DeleteUserModal from './components/DeleteUserModal';
import SettingsPanel from './components/SettingsPanel';
import ImportUserModal from './components/ImportUserModal';
import OverviewView from './views/OverviewView';
import StrikeView from './views/StrikeView';
import FlightView from './views/FlightView';
import DistanceView from './views/DistanceView';
import ShapeView from './views/ShapeView';
import TrendsView from './views/TrendsView';
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
  // First-launch welcome screen — shown when no users exist. Offers two
  // paths: restore from backup or create a fresh profile.
  const [showWelcome, setShowWelcome] = useState(false);
  // User to delete — when set, shows the cascade-aware DeleteUserModal which
  // surveys the user's shot count and offers reassign / delete-with-shots /
  // cancel. Replaces the previous naive native confirm() flow.
  const [userToDelete, setUserToDelete] = useState(null);
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
  // Initial load. User setup happens first so the welcome / first-launch
  // flow can fire immediately. On a truly fresh device (no users, no shots),
  // show the WelcomeModal — two paths, restore vs create. If shots exist
  // but no users, we treat it as a partial state and offer first-launch
  // create-profile (the user can still restore from backup later).
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
          // Show the welcome screen with the two paths. Don't seed anything
          // yet — wait for the user's choice. This avoids the "duplicate
          // Chris Meyer" problem when restoring on a new device.
          setShowWelcome(true);
        } else {
          // PR 4.18 bag-seeding migration. For any user without a bag yet,
          // build one from their existing shots' equipment values (majority
          // wins per club). Idempotent: seedBagFromShots only fills gaps,
          // existing bag entries are never overwritten. A localStorage flag
          // marks the migration as having run once for each user so we
          // don't repeatedly try to top up after the user deletes a bag
          // entry deliberately.
          for (const u of existing) {
            const flagKey = `tracelab_bag_seeded_${u.id}`;
            if (!localStorage.getItem(flagKey)) {
              seedBagFromShots(u.id, all);
              localStorage.setItem(flagKey, '1');
            }
          }
        }
        setShots(all);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Active user's bag. Kept in a state slice so edits trigger re-renders;
  // the underlying source of truth is still localStorage via lib/bag.js.
  // Refreshed any time the bag is mutated, the active user changes, or
  // users change.
  const [activeBag, setActiveBagState] = useState({});
  useEffect(() => {
    if (activeUserId) setActiveBagState(getBag(activeUserId));
    else setActiveBagState({});
  }, [activeUserId, users]);

  const allClubs = useMemo(() => orderedClubs([...new Set(shots.map((s) => s.club))]), [shots]);

  // Clubs the active user has hit (subset of allClubs). The bag panel
  // shows one row per club the user has data for, so this is the input.
  const activeUserClubs = useMemo(() => {
    if (!activeUserId) return [];
    const set = new Set();
    for (const s of shots) {
      if (s.userId === activeUserId && s.club) set.add(s.club);
    }
    return orderedClubs([...set]);
  }, [shots, activeUserId]);

  // Standard club labels for the "Add club to bag" dropdown. Reasonable
  // default set covering most golfers; users can pre-populate before they
  // hit a club for the first time.
  const standardClubLabels = useMemo(
    () => ['Dr', '3w', '5w', '7w', '2h', '3h', '4h', '5h',
           '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
           'PW', 'GW', '50°', '52°', '54°', '56°', '58°', '60°',
           'SW', 'LW'],
    []
  );

  // How many of the active user's shots have null equipment but their club
  // is now in the bag → the "fill missing" action would fix them.
  const missingEquipmentCount = useMemo(() => {
    if (!activeUserId) return 0;
    let count = 0;
    for (const s of shots) {
      if (s.userId !== activeUserId) continue;
      if (s.equipment) continue; // already tagged
      if (!s.club) continue;
      if (activeBag[s.club]) count++;
    }
    return count;
  }, [shots, activeUserId, activeBag]);

  // How many of the active user's shots are tagged with equipment that
  // doesn't match the current bag — these are candidates for the
  // "Overwrite equipment from bag" destructive action.
  const overwriteCount = useMemo(() => {
    if (!activeUserId) return 0;
    let count = 0;
    for (const s of shots) {
      if (s.userId !== activeUserId) continue;
      if (!s.club) continue;
      const entry = activeBag[s.club];
      if (!entry) continue;
      if (s.equipment !== entry) count++;
    }
    return count;
  }, [shots, activeUserId, activeBag]);

  // Count shots whose userId points at a user that doesn't exist on this
  // device. Surfaces in Settings when > 0 so the user can one-click reassign
  // them to the active player. Typical state after restoring a v1 backup
  // (which didn't include user records) on a fresh device.
  const orphanCount = useMemo(
    () => surveyOrphanedShots(shots, users).totalOrphans,
    [shots, users]
  );

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

  // For the Trends view specifically: same filters EXCEPT the pinned-session
  // narrowing. Pin is meaningful for Trends as the "today" reference point
  // (Section 01 — Today vs baseline), but applying it as a filter would
  // collapse the drift chart to a single session and make baselines trivial.
  // So Trends gets a shot set that honours WHEN/types/equipment/tags/clubs
  // (the user's explicit narrowing intent) but ignores pin.
  const unpinnedFilteredShots = useMemo(() => {
    return shots.filter((s) => {
      if (selectedClubs.length && !selectedClubs.includes(s.club)) return false;
      // Intentionally NO pin check here.
      if (!inTimeWindow(s, newestSessionIds)) return false;
      const type = s.shotType || 'full';
      if (selectedTypes.length && !selectedTypes.includes(type)) return false;
      if (selectedEquipment.length && !selectedEquipment.includes(s.equipment)) return false;
      if (!shotHasAnyTag(s, selectedTags)) return false;
      return true;
    });
  }, [shots, selectedClubs, timeFilter, newestSessionIds, selectedTypes, selectedEquipment, selectedTags]);

  // The Shots view used to bypass the shot-type filter via a separate
  // `shotsForEditing` memo, because reclassifying a shot's type made it
  // immediately vanish (the type filter wasn't visible at the time, so the
  // disappearance looked like the edit silently failed). Now that the TYPES
  // filter row is always visible and reachable from any view, that defence
  // is no longer needed — the user can see what's filtering the list and
  // adjust. Shots view uses the same filteredShots as the analysis views.

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
      // Stamp each shot with the user's current bag entry for that club.
      // This is the core PR 4.18 behaviour: equipment is bag-driven, not
      // edited per-shot. Shots whose club isn't in the bag get equipment=null.
      const stamped = newShots.map((s) => {
        const next = { ...s, userId };
        stampEquipmentFromBag(next, userId);
        return next;
      });
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
      const { added, skipped, total, usersAdded } = await importShotsFromJson(text);
      const all = await getAllShots();
      setShots(all);
      // Refresh users in case the backup brought new player profiles in
      // (v2 backup format includes users).
      refreshUsers();
      const shotsDetail =
        total === 0
          ? 'no shots'
          : skipped === 0
          ? `${added} shots imported`
          : added === 0
          ? `${total} shots already in your database`
          : `${added} new shots · ${skipped} duplicates skipped`;
      const usersDetail = usersAdded ? ` · ${usersAdded} player${usersAdded === 1 ? '' : 's'} restored` : '';
      setImportStatus({ status: 'success', message: shotsDetail + usersDetail });
      setTimeout(() => setImportStatus(null), 6000);
    } catch (e) {
      console.error(e);
      setImportStatus({ status: 'error', message: e.message || 'Import failed' });
    }
  }

  /**
   * Welcome modal — restore path. User dropped a backup file. Run the
   * import, then close the welcome screen. If the backup brought users
   * along, we're done (player profile is restored). If it didn't (a v1
   * shots-only backup), we still need to create a profile, so we fall
   * through to the create-profile flow.
   */
  async function handleWelcomeRestore(file) {
    await handleBackupImport(file);
    // Re-check after the import resolved
    const usersAfter = getUsers();
    if (usersAfter.length === 0) {
      // v1 backup or backup with no users — fall through to create flow
      handleWelcomeCreate();
    } else {
      setShowWelcome(false);
    }
  }

  /**
   * Welcome modal — create path. Same as the previous first-launch flow:
   * seed a default user, backfill any existing shots to them, then open
   * the edit modal pre-filled so they can complete handicap / hand /
   * change the name.
   */
  async function handleWelcomeCreate() {
    const seeded = addUser({ name: 'Chris Meyer', handicap: null, rightHanded: true });
    await backfillShotUsers(getAllShots, updateShots, seeded.id);
    const reloaded = await getAllShots();
    setShots(reloaded);
    refreshUsers();
    setUserModalInitial(seeded);
    setUserModalMode('firstLaunchEdit');
    setShowWelcome(false);
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

  /**
   * Begin the user-deletion flow. Doesn't delete immediately — opens the
   * DeleteUserModal which surveys the shot count and presents the choice
   * between reassign, delete-with-shots, and cancel. The actual delete
   * happens in handleReassignAndDelete or handleDeleteWithShots.
   */
  function handleDeleteUserConfirmed(id) {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setUserToDelete(u);
  }

  /**
   * Reassign every shot owned by userToDelete to targetUserId, then delete
   * the user profile. Safe option — no data is lost, only the player
   * identity is consolidated.
   */
  async function handleReassignAndDelete(targetUserId) {
    if (!userToDelete) return;
    const owned = shots.filter((s) => s.userId === userToDelete.id);
    if (owned.length) {
      const updates = owned.map((s) => ({ id: s.id, patch: { userId: targetUserId } }));
      await updateShots(updates);
      const reloaded = await getAllShots();
      setShots(reloaded);
    }
    // If the active user is the one being deleted, switch active to target
    if (activeUserId === userToDelete.id) {
      setActiveUserId(targetUserId);
      setActiveUserIdState(targetUserId);
    }
    deleteBag(userToDelete.id);
    deleteUser(userToDelete.id);
    refreshUsers();
    setUserToDelete(null);
  }

  /**
   * Delete every shot owned by userToDelete, then delete the user. The
   * destructive option — only used when the user (and their data) was a
   * genuine mistake. DeleteUserModal already required the user to type
   * the player's name to reach this handler, so no further confirm here.
   */
  async function handleDeleteWithShots() {
    if (!userToDelete) return;
    const owned = shots.filter((s) => s.userId === userToDelete.id);
    for (const s of owned) {
      await deleteShot(s.id);
    }
    const reloaded = await getAllShots();
    setShots(reloaded);
    // If we just deleted the active user, fall back to whichever player
    // is still around. If none remain, the next reload will show the
    // welcome screen — which is the right state.
    if (activeUserId === userToDelete.id) {
      const remaining = getUsers().filter((u) => u.id !== userToDelete.id);
      if (remaining.length) {
        setActiveUserId(remaining[0].id);
        setActiveUserIdState(remaining[0].id);
      }
    }
    deleteBag(userToDelete.id);
    deleteUser(userToDelete.id);
    refreshUsers();
    setUserToDelete(null);
  }

  function handleAddUserFromSettings() {
    setUserModalInitial(null);
    setUserModalMode('add');
  }

  /**
   * Move all orphaned shots (userId missing OR pointing at a user that
   * doesn't exist in localStorage) onto the active user. The Settings
   * panel surfaces this when orphanCount > 0 so the user can fix the
   * attribution in one click.
   */
  async function handleReattributeOrphans() {
    if (!activeUserId) return;
    const moved = await reattributeOrphans(getAllShots, updateShots, users, activeUserId);
    if (moved) {
      const reloaded = await getAllShots();
      setShots(reloaded);
    }
  }

  /**
   * Bag edit — change one club's equipment in the active user's bag.
   * Does NOT retroactively update existing shots; the bag change applies
   * to future imports and future club reassignments. This is the PR 4.18
   * snapshot semantic: equipment is what the bag said at the time the
   * shot was stamped.
   *
   * If you want existing shots to pick up the new bag entry, use the
   * "Fill missing equipment from bag" action (handleFillMissing below),
   * which only fills NULL equipment fields — never overwrites a shot's
   * existing stamped value.
   */
  function handleSetBagEntry(club, equipment) {
    if (!activeUserId) return;
    setBagEntry(activeUserId, club, equipment);
    setActiveBagState(getBag(activeUserId));
  }

  /**
   * Bulk version: set the same equipment string across a list of clubs in
   * one operation. Used by the "Set equipment across multiple clubs"
   * panel — most golfers buy iron sets, not individual irons, so being
   * able to tag 5i through PW with one click is a real workflow.
   *
   * Same semantics as the single set: no retroactive updates to existing
   * shots; future imports / reassignments get the new bag value.
   */
  function handleSetBagEntriesBulk(clubs, equipment) {
    if (!activeUserId) return;
    for (const c of clubs) setBagEntry(activeUserId, c, equipment);
    setActiveBagState(getBag(activeUserId));
  }

  /**
   * Stamp every "missing-equipment" shot from the current bag. A shot
   * qualifies if its userId matches the active user, its equipment is null,
   * its club has an entry in the bag. Shots already tagged stay as-is —
   * the bag never retroactively overwrites stamped equipment.
   */
  async function handleFillMissingEquipment() {
    if (!activeUserId) return;
    const bag = getBag(activeUserId);
    const updates = [];
    for (const s of shots) {
      if (s.userId !== activeUserId) continue;
      if (s.equipment) continue;
      if (!s.club) continue;
      const entry = bag[s.club];
      if (!entry) continue;
      updates.push({ id: s.id, patch: { equipment: entry } });
    }
    if (updates.length) {
      // Use the raw lib updateShots so we don't go through
      // augmentPatchWithBagEquipment, which would clobber our equipment
      // value with a re-lookup (would still produce the same answer, but
      // it's cleaner to bypass).
      await updateShots(updates);
      const reloaded = await getAllShots();
      setShots(reloaded);
    }
  }

  /**
   * Overwrite equipment on every shot where the stamped value disagrees
   * with the bag's current entry for that club. Used when the user has
   * corrected a bag entry after shots were already stamped wrong (e.g.
   * the migration seeded a club to the wrong equipment).
   *
   * Destructive — wipes the snapshot semantic for the affected shots. The
   * UI confirms before calling this handler.
   */
  async function handleOverwriteFromBag() {
    if (!activeUserId) return;
    const bag = getBag(activeUserId);
    const updates = [];
    for (const s of shots) {
      if (s.userId !== activeUserId) continue;
      if (!s.club) continue;
      const entry = bag[s.club];
      if (!entry) continue; // no bag entry → don't touch
      if (s.equipment === entry) continue; // already matches
      updates.push({ id: s.id, patch: { equipment: entry } });
    }
    if (updates.length) {
      await updateShots(updates);
      const reloaded = await getAllShots();
      setShots(reloaded);
    }
  }

  /**
   * Global tag rename — every shot carrying `oldTag` (case-insensitive)
   * gets it replaced with `newTag`. If `newTag` already exists on a shot
   * alongside the old one, addTag's dedupe collapses them. So renaming
   * functions as both rename and merge depending on whether the target
   * already exists.
   */
  async function handleRenameTag(oldTag, newTag) {
    const updates = renameTagInShots(shots, oldTag, newTag);
    if (updates.length) await handleUpdateShots(updates);
  }

  /** Global tag delete — strip the tag from every shot that carries it. */
  async function handleDeleteTag(tag) {
    const updates = deleteTagFromShots(shots, tag);
    if (updates.length) await handleUpdateShots(updates);
  }

  async function handleDeleteShot(id) {
    await deleteShot(id);
    setShots((curr) => curr.filter((s) => s.id !== id));
  }

  /**
   * Augment a patch so that when it changes a shot's `club`, the
   * `equipment` field is automatically updated to match the new club's
   * entry in the user's bag. If the new club isn't in the bag, equipment
   * is set to null (the explicit "no equipment for this club yet" state).
   *
   * Implements the PR 4.18 invariant: equipment follows the club via the
   * bag. The user never edits equipment per-shot; reassigning a shot to
   * a different club auto-updates its equipment to whatever the bag says
   * for that club at that moment.
   *
   * Skips augmentation when:
   *   - patch doesn't change club (nothing to do)
   *   - patch already specifies equipment (caller wins, escape hatch)
   *   - shot has no userId (can't look up which user's bag)
   */
  function augmentPatchWithBagEquipment(shot, patch) {
    if (!patch || !('club' in patch)) return patch;
    if ('equipment' in patch) return patch;
    if (!shot?.userId) return patch;
    const entry = getBagEntry(shot.userId, patch.club);
    // entry === null if the new club isn't in the bag → set equipment=null
    // explicitly so the shot reflects "no equipment for this club".
    return { ...patch, equipment: entry };
  }

  async function handleUpdateShot(id, patch) {
    const shot = shots.find((s) => s.id === id);
    const finalPatch = augmentPatchWithBagEquipment(shot, patch);
    const updated = await updateShot(id, finalPatch);
    if (updated) setShots((curr) => curr.map((s) => (s.id === id ? updated : s)));
  }

  async function handleUpdateShots(updates) {
    // Augment each update individually — each shot may belong to a different
    // user, so the bag lookup is per-shot.
    const finalUpdates = updates.map(({ id, patch }) => {
      const shot = shots.find((s) => s.id === id);
      return { id, patch: augmentPatchWithBagEquipment(shot, patch) };
    });
    const result = await updateShots(finalUpdates);
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

      {showWelcome && (
        <WelcomeModal
          onRestore={handleWelcomeRestore}
          onCreate={handleWelcomeCreate}
        />
      )}

      {userToDelete && (
        <DeleteUserModal
          user={userToDelete}
          shotCount={shots.filter((s) => s.userId === userToDelete.id).length}
          otherUsers={users.filter((u) => u.id !== userToDelete.id)}
          onReassign={handleReassignAndDelete}
          onDeleteWithShots={handleDeleteWithShots}
          onCancel={() => setUserToDelete(null)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          users={users}
          activeUserId={activeUserId}
          onSelectUser={handleSelectUser}
          onEditUser={handleEditUser}
          onAddUser={handleAddUserFromSettings}
          onDeleteUser={handleDeleteUserConfirmed}
          orphanCount={orphanCount}
          onReattributeOrphans={handleReattributeOrphans}
          activeUser={activeUser}
          activeBag={activeBag}
          onSetBagEntry={handleSetBagEntry}
          onSetBagEntriesBulk={handleSetBagEntriesBulk}
          userClubs={activeUserClubs}
          allClubLabels={standardClubLabels}
          missingEquipmentCount={missingEquipmentCount}
          onFillMissingEquipment={handleFillMissingEquipment}
          overwriteCount={overwriteCount}
          onOverwriteFromBag={handleOverwriteFromBag}
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
                  onRenameTag={handleRenameTag}
                  onDeleteTag={handleDeleteTag}
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
            {view === 'trends' && (
              <TrendsView
                shots={filteredShots}
                allShots={unpinnedFilteredShots}
                allClubs={allClubs}
                units={units}
                pinnedSession={pinnedSession}
              />
            )}
            {view === 'shots' && (
              <ShotsView
                shots={filteredShots}
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
