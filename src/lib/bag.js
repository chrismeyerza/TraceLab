/**
 * Player bag — per-user mapping from club label → equipment string.
 *
 * Conceptual model (PR 4.18):
 *   - Each user has a bag (one per user, lives in localStorage)
 *   - The bag is a record { [clubLabel]: equipmentString }, e.g.
 *       { Dr: 'Callaway Rogue ST', '7i': 'Ping i230', '54°': 'Vokey SM11' }
 *   - Equipment on a shot is STAMPED FROM THE BAG at import time and on
 *     club reassignment — it is NOT a per-shot edit any more. The shot
 *     stores whatever the bag said at that moment.
 *   - The bag changes only via explicit user action in Settings. Old shots
 *     are NEVER retroactively updated when the bag changes — equipment is
 *     a snapshot. This is the key invariant that makes the model work:
 *     "compare new irons vs old" just means filtering by equipment.
 *
 * Storage layout in localStorage:
 *   tracelab_bag_<userId> -> JSON string of the bag record
 *   (one key per user; users can have different bags)
 *
 * No migration runs in this file — see seedBagFromShots() in this module
 * and the App.jsx boot path which calls it once per user on first run
 * after PR 4.18.
 */

const BAG_KEY_PREFIX = 'tracelab_bag_';

function bagKeyFor(userId) {
  if (!userId) return null;
  return `${BAG_KEY_PREFIX}${userId}`;
}

/** Read a user's bag from localStorage. Returns {} if none exists or on
 *  parse errors (defensive — corrupt local data shouldn't break the app). */
export function getBag(userId) {
  const key = bagKeyFor(userId);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Write a user's bag to localStorage. */
export function setBag(userId, bag) {
  const key = bagKeyFor(userId);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(bag || {}));
}

/** Look up the equipment for a given club in a user's bag. Returns the
 *  equipment string or null if the club isn't in the bag. */
export function getBagEntry(userId, club) {
  if (!club) return null;
  const bag = getBag(userId);
  return bag[club] || null;
}

/** Set the equipment for one club in a user's bag. Pass equipment=null to
 *  clear (remove the entry entirely so the club is "not in bag"). */
export function setBagEntry(userId, club, equipment) {
  const bag = getBag(userId);
  if (equipment == null) {
    delete bag[club];
  } else {
    bag[club] = equipment;
  }
  setBag(userId, bag);
}

/** Delete an entire user's bag (used when deleting a user). */
export function deleteBag(userId) {
  const key = bagKeyFor(userId);
  if (key) localStorage.removeItem(key);
}

/**
 * Seed a user's bag from existing shot data using "majority wins per club."
 *
 * Used once during the v1.8.0 migration so users who already have shots
 * with equipment tags don't lose them — instead their existing tagging
 * becomes the starting bag.
 *
 * Logic:
 *   - For each club the user has shots for, count how often each equipment
 *     value appears (excluding null).
 *   - The most-used equipment string becomes the bag entry for that club.
 *   - Clubs with no tagged shots stay out of the bag.
 *   - Existing bag entries are NEVER overwritten — this function only fills
 *     gaps. So calling it multiple times is safe; bag edits made between
 *     migrations are preserved.
 *
 * Returns the number of clubs newly seeded.
 */
export function seedBagFromShots(userId, shots) {
  if (!userId) return 0;
  const bag = getBag(userId);
  // Tally equipment counts per club for this user's shots only
  const tallies = {}; // { [club]: { [equipment]: count } }
  for (const s of shots || []) {
    if (s.userId !== userId) continue;
    if (!s.club || !s.equipment) continue;
    if (bag[s.club]) continue; // existing bag entry wins
    if (!tallies[s.club]) tallies[s.club] = {};
    tallies[s.club][s.equipment] = (tallies[s.club][s.equipment] || 0) + 1;
  }
  let seeded = 0;
  for (const [club, counts] of Object.entries(tallies)) {
    // Majority wins; tie-break alphabetically (stable, predictable)
    const ordered = Object.entries(counts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
    if (ordered.length) {
      bag[club] = ordered[0][0];
      seeded++;
    }
  }
  if (seeded) setBag(userId, bag);
  return seeded;
}

/**
 * Stamp a shot with equipment from the user's current bag, mutating in
 * place. If the club isn't in the bag, equipment is set to null. Used by
 * the parser (import time) and club-reassignment paths.
 *
 * Does NOT overwrite existing equipment on the shot when a bag entry is
 * absent — leaves what's there. This protects historic data: if a shot
 * was stamped previously and the bag has since lost the entry, we don't
 * blank it out by accident.
 *
 * Actually, on reflection: we WANT reassignment to update equipment when
 * the new club has a bag entry. So the rule is:
 *   - Bag has entry for new club → stamp it (replace whatever was there)
 *   - Bag has no entry for new club → leave existing equipment alone
 *
 * The second branch protects historic data; the first delivers the
 * "equipment follows the club" behaviour.
 */
export function stampEquipmentFromBag(shot, userId) {
  if (!shot || !userId || !shot.club) return shot;
  const entry = getBagEntry(userId, shot.club);
  if (entry) {
    shot.equipment = entry;
  }
  // Else: leave shot.equipment as-is
  return shot;
}
