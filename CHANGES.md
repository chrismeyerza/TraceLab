# Changes — Equipment filtering + free-form tags (PR 4.15)

Tags become first-class filters. Two new filter rows in the FilterBar, two
new per-shot fields are now filterable, and a whole new free-form tagging
concept arrives. Version bumped to **1.6.0**.

## What this adds

### Equipment is now filterable

Equipment was stop-gap capture before (visible in the EQUIP column but
filtered nowhere). Now:
- **EQUIPMENT filter row** in the FilterBar — appears when at least one
  shot has an equipment tag
- Click a chip to focus on shots with that equipment
- Cmd/Ctrl-click to add to the selection (multiple equipment shown together)
- The brand+model list is still the curated stop-gap (Titleist/Ping/Mizuno
  etc) — no free-text entry for equipment yet, that's a different decision
  you flagged you want to think through

### Free-form tags (new concept)

A completely separate tagging system. Each shot can carry an arbitrary
list of user-defined string labels:

- `windy`, `after lesson with John`, `tournament prep`, `range`, `felt good`,
  `tested new ball`, anything you want — pure free text
- Multiple tags per shot
- **Stored as an array** on each shot (`tags: string[]`)
- Distinct from equipment because tags are user-defined and many-per-shot;
  equipment is curated and one-per-shot

### Tag normalisation (anti-fragmentation)

The big risk of free text is that "windy" and "Windy" and "  windy " all
become different tags and your filter row gets cluttered. Handled:

- **Trim** leading/trailing whitespace on input (internal spaces preserved
  — "after lesson" stays "after lesson")
- **Case-insensitive dedupe** — `Windy` and `windy` collapse to one tag
- **First-seen casing wins** for display — if you typed `Windy` first,
  that's how it appears
- **Autocomplete** suggests existing tags as you type, so you pick the
  existing `Windy` rather than re-typing `windy`

### Filter semantics

Confirmed pattern across all rows:

- **Within a row: OR** — `7i` + `8i` selected = show shots that are 7i OR 8i
- **Across rows: AND** — `Equipment=Titleist` AND `Tag=windy` = both must match
- **Empty selection in a row** = "no filter on this row" (all shots pass it)
- ALL chip in each row clears the row back to no-filter

### Where you tag

**Per-shot inline editing** — click the TAGS cell in the Shots view → Summary
tab. Opens an inline TagEditor with:
- Existing tags shown as removable chips
- Text input with autocomplete dropdown
- Press Enter to add, click × to remove
- Backspace on empty input removes the last chip
- Arrow keys + Enter to navigate suggestions

**Bulk tagging** — select multiple shots → "Set tags" button → opens a
panel with two apply modes:
- **ADD TO SHOTS** (safe, non-destructive) — appends tags to each selected
  shot's existing tags, dedupe-aware
- **REPLACE** — overwrites each selected shot's tags with this set entirely.
  Use this to clear-and-reset.

Both modes use the same autocomplete pool, so you can quickly apply
existing tags consistently.

## The new filter rows

EQUIPMENT row (only when data has equipment):
```
EQUIPMENT  [ALL] [Mizuno Pro 241] [Titleist T150] [Ping i230]
```

TAGS row (only when data has tags), with usage counts:
```
TAGS  [ALL] [Windy 12] [After lesson 4] [Tournament prep 2] [Range 18]
```

ScopeSummary chips:
- Blue `Equip: Titleist T150` chip when equipment filter is active
- Purple `Tags: Windy, After lesson` chip when tags filter is active

## Files modified

| File | What changed |
|---|---|
| `src/lib/tags.js` | **NEW** — normaliseTag, canonicalTag, addTag, removeTag, collectTags, shotHasAnyTag, suggestTags |
| `src/components/TagEditor.jsx` | **NEW** — chip list + autocomplete input, used both inline and in bulk |
| `src/lib/parser.js` | Defaults `tags: []` on every parsed shot |
| `src/lib/storage.js` | `migrateShotMeta` bumped to v2, backfills tags=[] on legacy shots |
| `src/App.jsx` | `selectedEquipment` + `selectedTags` filter state; availableEquipment + availableTagsList derivations; filter logic in filteredShots + shotsForEditing; passes new props to FilterBar/ScopeSummary/ShotsView |
| `src/components/FilterBar.jsx` | EQUIPMENT + TAGS rows; generic OR-row click handler; updated clearAll |
| `src/components/ScopeSummary.jsx` | Equip + Tags chips with tone-equip and tone-tags colours |
| `src/views/ShotsView.jsx` | TAGS column on Summary tab with inline TagEditor; Set tags bulk action; BulkTagsPanel component |
| `src/index.css` | Tag editor styles (chips, input, suggestion dropdown); tone-equip and tone-tags scope chip colours |
| `package.json` | 1.5.0 → 1.6.0 |

## Verified

- Production build clean
- Tags library smoke-tested: normalisation strips whitespace, case-
  insensitive dedupe collapses duplicates, first-seen casing preserved,
  autocomplete substring-matches case-insensitively
- Filter semantics: OR within row, AND across rows

## How you'd use it

Example workflow — tag a windy session:

1. Apply, restart the app
2. Sessions → import the session, or just navigate to existing shots
3. Shots view → select all shots from that session (header checkbox)
4. "Set tags" → type "Windy" → Enter → ADD TO SHOTS
5. The new TAGS row appears in the FilterBar with `Windy 24` (or however many)
6. Click `Windy` to filter analysis views to that session's shots only
7. Add more tags over time — `Range`, `Tournament prep`, `After lesson`,
   whatever's useful

You can compose: filter to `Equipment = Mizuno Pro 241` AND `Tags = Windy`
and see how your gamer iron performed in those conditions specifically.

## What's intentionally NOT in this PR

- **No tag management UI** (rename tag globally, delete tag from all shots,
  merge two tags). Deferred — see if you need it before building. The
  autocomplete should mean typos are rare.
- **No equipment free text** — equipment is still the curated brand+model
  picker only. Adding free-text equipment is the next big decision; that
  was the workflow you said you want to think through.
- **No tag taxonomy / parent-child / required prefixes** — pure freeform.

## What's next

- **Proper equipment system** — free text + autocomplete + filtering for
  equipment, possibly user-managed bags. Same machinery as tags but with
  different semantics (one-per-shot)
- Column reordering in Shots view (backlog)
- Per-club swing fingerprint view (backlog)
