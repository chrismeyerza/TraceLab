/**
 * Free-form tag helpers. Tags are user-defined string labels attached to
 * shots — anything: "windy", "after lesson", "tournament prep", "felt good".
 * Multiple per shot, filterable like clubs and equipment.
 *
 * Design choices:
 *   - Stored as strings in their first-seen casing ("Windy", not "windy")
 *   - Compared case-INsensitively for dedupe/filter membership, so the user
 *     can't fragment their tags by inconsistent capitalisation
 *   - Trimmed of leading/trailing whitespace on input; internal whitespace
 *     preserved ("after lesson" stays "after lesson")
 *   - No length limit — practical limit is whatever fits in a chip
 *   - No taxonomy, no parent/child structure, no required prefix; freeform
 *     means freeform
 *
 * The autocomplete pulls suggestions from the data — whatever tags currently
 * exist across all shots, that's the suggestion pool. No saved "tag library"
 * that diverges from reality.
 */

/** Normalise a single tag string for storage: trim, drop empties. Preserves
 *  user's casing for display. Returns null for empty/whitespace input. */
export function normaliseTag(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

/** Normalise to a canonical form used for case-insensitive comparison ONLY.
 *  Never stored; never displayed. Lower-case + collapse internal whitespace. */
export function canonicalTag(raw) {
  if (raw == null) return '';
  return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Add a tag to a shot's tag array. Case-insensitive dedupe; if the same tag
 *  (any casing) is already there, the array is returned unchanged. Otherwise
 *  the new tag is appended in the user's chosen casing. */
export function addTag(tags, raw) {
  const norm = normaliseTag(raw);
  if (!norm) return tags;
  const canon = canonicalTag(norm);
  const existing = (tags || []).find((t) => canonicalTag(t) === canon);
  if (existing) return tags || [];
  return [...(tags || []), norm];
}

/** Remove a tag (case-insensitive match) from a shot's tags array. */
export function removeTag(tags, raw) {
  const canon = canonicalTag(raw);
  return (tags || []).filter((t) => canonicalTag(t) !== canon);
}

/** Collect every distinct tag across a set of shots, dedupe case-insensitively
 *  by canonical form but display in first-seen casing. Returns sorted by usage
 *  count descending (most-used tags first), tiebreak alphabetical.
 *
 *  Returns an array of { tag, count } objects so the UI can show usage counts. */
export function collectTags(shots) {
  const map = new Map(); // canon -> { tag, count }
  for (const s of shots || []) {
    for (const t of s.tags || []) {
      const c = canonicalTag(t);
      if (!c) continue;
      if (map.has(c)) {
        map.get(c).count += 1;
      } else {
        map.set(c, { tag: t, count: 1 });
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

/** Does this shot have ANY of the given tags? (Used for filter semantics:
 *  OR within the TAGS row.) Empty selectedTags array means "no tag filter". */
export function shotHasAnyTag(shot, selectedTags) {
  if (!selectedTags || !selectedTags.length) return true;
  const shotCanons = new Set((shot.tags || []).map(canonicalTag));
  return selectedTags.some((t) => shotCanons.has(canonicalTag(t)));
}

/** Suggest existing tags that match a user's in-progress text input. Used by
 *  the autocomplete dropdown — substring match (case-insensitive), ordered by
 *  usage count descending. Limits to top 8 to keep the dropdown small. */
export function suggestTags(query, allTags) {
  const q = canonicalTag(query);
  if (!q) return allTags.slice(0, 8);
  return allTags
    .filter(({ tag }) => canonicalTag(tag).includes(q))
    .slice(0, 8);
}
