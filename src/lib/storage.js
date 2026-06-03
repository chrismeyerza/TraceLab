// Persistent shot storage via IndexedDB. Holds tens of thousands of shots
// comfortably. Data lives in the user's browser only — no server, no sync.
//
// NOTE on DB_NAME: kept as 'foresight-analytics' (the original name from v1.1)
// to avoid migrating every existing user's data to a fresh DB on rebrand. The
// name is internal — never user-visible — so the legacy value is harmless.

const DB_NAME = 'foresight-analytics';
const DB_VERSION = 2; // bumped from 1 — see onupgradeneeded
const STORE_SHOTS = 'shots';
const STORE_META = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;
      // v0 -> v1: initial schema
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE_SHOTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('club', 'club', { unique: false });
        store.createIndex('dedup', 'dedup', { unique: true });
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      // v1 -> v2: drop the UNIQUE constraint on dedup. Two reasons:
      //   1. The new dedup formula (timestamp + ballSpeed, no club) reduces
      //      uniqueness — collisions are still vanishingly rare in practice
      //      but the index shouldn't enforce strict uniqueness anymore.
      //   2. Editing a shot's club label used to cascade-break the dedup key
      //      (old key included club). Now we recompute keys in the migration
      //      below; the unique constraint would block legitimate updates.
      // We achieve this by deleting and recreating the index without `unique`.
      if (oldVersion < 2) {
        const tx = e.target.transaction;
        const store = tx.objectStore(STORE_SHOTS);
        if (store.indexNames.contains('dedup')) {
          store.deleteIndex('dedup');
        }
        store.createIndex('dedup', 'dedup', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllShots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readonly');
    const req = tx.objectStore(STORE_SHOTS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Compute the canonical dedup key for a shot. Format used since v1.2:
 *   "{ISO timestamp}|{ballSpeed}"
 * Deliberately omits club — that lets a user relabel a mislabelled shot
 * without changing its identity, so re-importing the original CSV still
 * dedupes correctly.
 */
export function makeDedupKey(shot) {
  return `${shot.createdAt}|${shot.ballSpeed}`;
}

/**
 * Insert shots, skipping those whose dedup key already exists in storage.
 * Unlike the previous version, we no longer rely on the unique-index constraint
 * (which the v2 migration removed). Instead we check the existing dedup set
 * before adding. Slightly more work per import but defensible: it gives us
 * control over the dedup logic in JS rather than relying on a DB constraint
 * that we'd have to keep in sync.
 *
 * Returns { added, skipped }.
 */
export async function addShots(shots) {
  const db = await openDB();
  // Build a set of existing dedup keys first, so the insert loop is just an
  // O(1) lookup per shot. Cheap even for 100k+ shots.
  const existing = await getAllShots();
  const seen = new Set(existing.map((s) => s.dedup));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    let added = 0;
    let skipped = 0;
    let pending = shots.length;
    if (pending === 0) {
      resolve({ added, skipped });
      return;
    }
    shots.forEach((shot) => {
      if (seen.has(shot.dedup)) {
        skipped++;
        if (--pending === 0) resolve({ added, skipped });
        return;
      }
      seen.add(shot.dedup);
      const req = store.add(shot);
      req.onsuccess = () => {
        added++;
        if (--pending === 0) resolve({ added, skipped });
      };
      req.onerror = (e) => {
        // Shouldn't fire in normal use now that uniqueness isn't enforced,
        // but guard for it anyway (e.g. quota exceeded, corrupt record).
        skipped++;
        e.preventDefault();
        if (--pending === 0) resolve({ added, skipped });
      };
    });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Export the entire shot store as a portable JSON file. Format:
 *
 *   {
 *     tracelab: { version: 1, exportedAt: "...", shotCount: N },
 *     shots: [ {...}, ... ]
 *   }
 *
 * The `tracelab` envelope lets us recognise our own files at import time and
 * supports future schema migrations. We strip the IndexedDB-assigned `id`
 * field on export so re-import gets fresh auto-incremented IDs (which is what
 * we want — IDs are local to a DB instance, they shouldn't pin across machines).
 *
 * Returns a Blob ready to be saved via the browser's download mechanism.
 */
/**
 * Export the entire shot store as a portable JSON file. Format (v2):
 *
 *   {
 *     tracelab: { version: 2, exportedAt: "...", shotCount: N, userCount: M },
 *     users:  [ {...}, ... ],   // player profiles (id preserved so shots link)
 *     shots:  [ {...}, ... ],   // shot records (id stripped — DB-local)
 *   }
 *
 * v2 added users so cross-device restore (where the new browser has no
 * profiles) brings player identity along. The user `id` is preserved on
 * export and import because the shots' `userId` field references it —
 * regenerating ids on restore would orphan attribution.
 *
 * Backwards compatible: importer accepts v1 (shots only) and v2 (shots +
 * users) payloads. The `tracelab` envelope is the recognition marker.
 *
 * Returns a Blob ready to be saved via the browser's download mechanism.
 */
export async function exportAllShotsAsJson() {
  const shots = await getAllShots();
  // Users come from localStorage, read lazily here so the storage module
  // doesn't need to import the users module (avoids a circular dep).
  let users = [];
  try {
    const raw = localStorage.getItem('tracelab_users');
    if (raw) users = JSON.parse(raw) || [];
  } catch {
    users = [];
  }
  const payload = {
    tracelab: {
      version: 2,
      exportedAt: new Date().toISOString(),
      shotCount: shots.length,
      userCount: users.length,
    },
    users,
    shots: shots.map(({ id, ...rest }) => rest),
  };
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Auto-generated filename for an export: tracelab-export-YYYYMMDD-HHMM.tracelab.json
 * Lets the user tell at a glance when the file was made and that it's ours.
 */
export function makeExportFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `tracelab-export-${stamp}.tracelab.json`;
}

/**
 * Validate and import a JSON payload produced by exportAllShotsAsJson.
 * Returns { added, skipped, total, usersAdded } on success.
 *
 * Accepts v1 (shots-only) and v2 (shots + users) backups.
 *
 * Dedupe semantics for shots: identical to addShots() — skips any incoming
 * shot whose dedup key already exists locally. So importing a file
 * containing shots you already have is a no-op for those shots; you never
 * lose local edits (e.g. club relabels) to existing data.
 *
 * For users (v2 only): each incoming user is merged into localStorage.
 * - If a user with the same id already exists, the incoming one is skipped
 *   (local edits take precedence; the imported version is treated as the
 *   older copy).
 * - If a user with the same id does not exist, the user is added verbatim
 *   with id preserved (so any shots referencing that userId still link).
 *
 * Throws on:
 *   - JSON parse failure
 *   - Missing/wrong envelope (not a TraceLab export)
 *   - Unknown schema version (forward-compat guard)
 *   - Non-array `shots` field
 */
export async function importShotsFromJson(jsonText) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Not valid JSON — is this really a TraceLab export?');
  }
  if (!payload || typeof payload !== 'object' || !payload.tracelab) {
    throw new Error('Missing TraceLab envelope. This file does not look like a TraceLab export.');
  }
  const ver = payload.tracelab.version;
  if (ver !== 1 && ver !== 2) {
    throw new Error(`Unknown export schema version: ${ver}. This build understands versions 1 and 2.`);
  }
  if (!Array.isArray(payload.shots)) {
    throw new Error('Invalid file: shots field is missing or not an array.');
  }

  // Merge users first (v2 only) — so that when shots come in carrying
  // userId references, the users they point to already exist locally.
  let usersAdded = 0;
  if (ver === 2 && Array.isArray(payload.users)) {
    let existing = [];
    try {
      const raw = localStorage.getItem('tracelab_users');
      if (raw) existing = JSON.parse(raw) || [];
    } catch { existing = []; }
    const existingIds = new Set(existing.map((u) => u.id));
    const incoming = payload.users.filter((u) => u && u.id && !existingIds.has(u.id));
    if (incoming.length > 0) {
      const merged = [...existing, ...incoming];
      localStorage.setItem('tracelab_users', JSON.stringify(merged));
      // Set active user to the first incoming one if there's no active user
      // currently. Caller flow: fresh device with no profile → restore →
      // user becomes the active player without an extra modal.
      if (!localStorage.getItem('tracelab_active_user')) {
        localStorage.setItem('tracelab_active_user', incoming[0].id);
      }
      usersAdded = incoming.length;
    }
  }

  const total = payload.shots.length;
  if (total === 0) {
    return { added: 0, skipped: 0, total: 0, usersAdded };
  }
  // Strip any id field present in the file (shouldn't be — we strip on
  // export — but belt and braces; an old file or hand-edited one might
  // include it, and addShots would honour it which we don't want).
  const sanitised = payload.shots.map(({ id, ...rest }) => rest);
  const { added, skipped } = await addShots(sanitised);
  return { added, skipped, total, usersAdded };
}

export async function clearAllShots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    tx.objectStore(STORE_SHOTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    const idx = store.index('sessionId');
    const req = idx.openCursor(IDBKeyRange.only(sessionId));
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) {
        cur.delete();
        cur.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete a single shot by its IndexedDB id.
 */
export async function deleteShot(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    tx.objectStore(STORE_SHOTS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update fields on an existing shot. Reads the current record, merges `patch`
 * on top, and writes back. If the patch changes `club` (the most common case
 * for relabel), the dedup key is NOT regenerated — by design, dedup uses only
 * timestamp + ballSpeed since v1.2, so club edits are safe.
 *
 * Returns the updated shot, or null if the id wasn't found.
 */
export async function updateShot(id, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result;
      if (!current) {
        resolve(null);
        return;
      }
      const updated = { ...current, ...patch };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update many shots at once. Same semantics as updateShot but in a single
 * transaction — atomic, faster, and won't leave the DB in a half-updated state
 * if anything fails. `updates` is an array of {id, patch} objects.
 */
export async function updateShots(updates) {
  if (!updates.length) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    const results = [];
    let pending = updates.length;
    updates.forEach(({ id, patch }) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const current = getReq.result;
        if (!current) {
          if (--pending === 0) resolve(results);
          return;
        }
        const updated = { ...current, ...patch };
        const putReq = store.put(updated);
        putReq.onsuccess = () => {
          results.push(updated);
          if (--pending === 0) resolve(results);
        };
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * One-off migration: rewrite all existing shots' dedup keys using the new
 * formula (timestamp + ballSpeed, no club). Necessary because pre-v1.2 records
 * have dedup keys that include club — if we left them, re-importing a CSV
 * for a session whose shots have been relabelled would create duplicates,
 * since the old key embeds the OLD club label and the new shots would be
 * computed with the (probably different) NEW label.
 *
 * Safe to run multiple times: idempotent. Returns the count of records touched.
 */
export async function migrateDedupKeys() {
  const META_KEY = 'dedup-migration-v2';
  const db = await openDB();
  // Check whether the migration has already run
  const already = await new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(META_KEY);
    req.onsuccess = () => resolve(req.result?.value === true);
    req.onerror = () => resolve(false);
  });
  if (already) return 0;

  const shots = await getAllShots();
  const touched = [];
  for (const s of shots) {
    const newKey = `${s.createdAt}|${s.ballSpeed}`;
    if (s.dedup !== newKey) {
      touched.push({ ...s, dedup: newKey });
    }
  }
  if (touched.length) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SHOTS);
      for (const s of touched) store.put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  // Mark migration as done
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: META_KEY, value: true });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return touched.length;
}

/**
 * Backfill shotType + equipment + tags on shots imported before those fields
 * existed. Every legacy shot becomes shotType='full' (so existing analysis
 * baselines are unchanged), equipment=null (untagged), tags=[] (no tags).
 * Idempotent via a meta flag; safe to call on every boot.
 *
 * Note: the meta key got bumped to v2 when we added tags so existing users
 * who already ran the v1 migration get a top-up for the new field.
 */
export async function migrateShotMeta() {
  const META_KEY = 'shotmeta-migration-v2';
  const db = await openDB();
  const already = await new Promise((resolve) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(META_KEY);
    req.onsuccess = () => resolve(req.result?.value === true);
    req.onerror = () => resolve(false);
  });
  if (already) return 0;

  const shots = await getAllShots();
  const touched = [];
  for (const s of shots) {
    const patch = {};
    if (s.shotType == null) patch.shotType = 'full';
    if (!('equipment' in s)) patch.equipment = null;
    if (!Array.isArray(s.tags)) patch.tags = [];
    if (Object.keys(patch).length) touched.push({ ...s, ...patch });
  }
  if (touched.length) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SHOTS);
      for (const s of touched) store.put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: META_KEY, value: true });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return touched.length;
}
