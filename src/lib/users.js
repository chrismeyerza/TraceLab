/**
 * User profiles. Stored in localStorage, not IndexedDB — they're tiny, rarely
 * change, and need to be available synchronously at boot before any shot
 * loading happens. Each user has:
 *
 *   id            uuid-ish string, stable forever
 *   name          display string ("Chris Meyer")
 *   handicap      number (0-54) — used as a future segmentation axis,
 *                 doesn't currently affect rendering
 *   rightHanded   boolean — drives Shape classification orientation, so
 *                 lefties get correctly-mirrored draw/fade labelling
 *   createdAt     ISO timestamp
 *
 * The active user id sits alongside the users list. Every new shot gets
 * tagged with the active user's id at import time. Existing pre-migration
 * shots get backfilled to the first user (see ensureUserSchema).
 *
 * The model is deliberately user-first rather than session-first: a session
 * is just a group of shots created in one go; a user is the persistent
 * identity those shots belong to.
 */
const USERS_KEY = 'tracelab_users';
const ACTIVE_KEY = 'tracelab_active_user';

/** Generate a tiny stable id. Not cryptographically anything — just a name. */
function newId() {
  return 'u_' + Math.random().toString(36).slice(2, 10);
}

/** Read all users. Returns [] if the key is missing or corrupt. */
export function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the users array. */
function setUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Currently active user id (string), or null if none set yet. */
export function getActiveUserId() {
  return localStorage.getItem(ACTIVE_KEY);
}

/** Set the active user. Pass null to clear. */
export function setActiveUserId(id) {
  if (id == null) localStorage.removeItem(ACTIVE_KEY);
  else localStorage.setItem(ACTIVE_KEY, id);
}

/** Convenience: get the full active-user object, or null. */
export function getActiveUser() {
  const id = getActiveUserId();
  if (!id) return null;
  return getUsers().find((u) => u.id === id) || null;
}

/**
 * Create a new user. `name` is required; handicap/rightHanded optional with
 * sensible defaults. Returns the created user. If there's no active user
 * yet, the new one becomes active automatically (good for first-launch flow).
 */
export function addUser({ name, handicap = null, rightHanded = true }) {
  const users = getUsers();
  const user = {
    id: newId(),
    name: (name || 'New User').trim(),
    handicap: handicap === '' || handicap == null ? null : Number(handicap),
    rightHanded: !!rightHanded,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  setUsers(users);
  if (!getActiveUserId()) setActiveUserId(user.id);
  return user;
}

/**
 * Update an existing user. Pass any subset of fields. Returns the updated
 * user or null if id not found.
 */
export function updateUser(id, patch) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const updated = {
    ...users[idx],
    ...patch,
    handicap: patch.handicap === '' || patch.handicap == null
      ? (users[idx].handicap ?? null)
      : Number(patch.handicap),
  };
  users[idx] = updated;
  setUsers(users);
  return updated;
}

/**
 * Delete a user by id. Refuses to delete the last remaining user (would
 * leave shots orphaned). Returns true on success, false otherwise.
 *
 * Note: this DOES NOT delete the user's shots — they remain in IndexedDB
 * with a now-orphaned userId. Surfacing them later under a "no user" filter
 * is fine; trying to cascade-delete would be a destructive surprise.
 */
export function deleteUser(id) {
  const users = getUsers();
  if (users.length <= 1) return false;
  const filtered = users.filter((u) => u.id !== id);
  setUsers(filtered);
  if (getActiveUserId() === id) {
    setActiveUserId(filtered[0]?.id || null);
  }
  return true;
}

/**
 * Backfill: set userId on every shot in IndexedDB that doesn't already
 * have one. Runs once on app start after schema migration. The provided
 * `fallbackUserId` is used for any shot without a stored userId.
 *
 * Idempotent — safe to call repeatedly. Returns the number of shots
 * actually touched.
 */
export async function backfillShotUsers(getAllShots, updateShotsBulk, fallbackUserId) {
  const all = await getAllShots();
  const needs = all.filter((s) => !s.userId);
  if (!needs.length) return 0;
  const updates = needs.map((s) => ({ id: s.id, patch: { userId: fallbackUserId } }));
  await updateShotsBulk(updates);
  return needs.length;
}

/**
 * Survey orphaned shots: shots whose userId either is missing OR points to
 * a user that no longer exists in localStorage. Returns a breakdown by
 * orphan-userId so the UI can show "96 shots reference an unknown player
 * (u_ek8ap1hw); 12 shots have no player assigned".
 *
 * This is the typical post-import situation when you bring shots in from
 * a v1 backup and the user records didn't come along — the shots' userIds
 * point at user records that don't exist on the receiving device.
 *
 * Returns { totalOrphans, byUserId: { [missingId|'__none__']: count } }.
 */
export function surveyOrphanedShots(shots, users) {
  const knownIds = new Set(users.map((u) => u.id));
  const byUserId = {};
  let totalOrphans = 0;
  for (const s of shots) {
    if (!s.userId) {
      byUserId.__none__ = (byUserId.__none__ || 0) + 1;
      totalOrphans++;
    } else if (!knownIds.has(s.userId)) {
      byUserId[s.userId] = (byUserId[s.userId] || 0) + 1;
      totalOrphans++;
    }
  }
  return { totalOrphans, byUserId };
}

/**
 * Reassign all orphaned shots (no userId or unknown userId) to the given
 * target user. Returns the number of shots touched.
 */
export async function reattributeOrphans(getAllShots, updateShotsBulk, users, targetUserId) {
  const all = await getAllShots();
  const knownIds = new Set(users.map((u) => u.id));
  const orphans = all.filter((s) => !s.userId || !knownIds.has(s.userId));
  if (!orphans.length) return 0;
  const updates = orphans.map((s) => ({ id: s.id, patch: { userId: targetUserId } }));
  await updateShotsBulk(updates);
  return orphans.length;
}
