# Changes — Shot-type tagging + equipment capture (PR 4.13)

Two new per-shot fields. Shot-type is fully wired (tag, filter, analysis-aware).
Equipment is stop-gap capture only (tag + display, no filter/analysis yet) —
the proper equipment system is deferred until you've thought through the
workflow.

## Shot type (full treatment)

### The problem
A 50° wedge hit full (~90y), as a pitch (~50y), and as a chip (~25y) is the
same club doing three different jobs. Aggregated together, the club looks
wildly inconsistent. Foresight doesn't distinguish them — so we capture intent
separately.

### What's in place
- **New `shotType` field** on every shot. Enum: Full · 3/4 · Half · Pitch ·
  Chip · Bunker · Flop · Other. Defaults to `full` on import.
- **Analysis defaults to full-only.** The app-level shot filter defaults to
  `['full']`, so Distance / Strike / Flight / Shape / Overview all show full
  shots only out of the box — baselines stay clean. No per-view changes
  needed; it's enforced at the `filteredShots` level.
- **TYPES filter row** in the FilterBar. Same focus/additive interaction as
  clubs (plain click focuses, Cmd/Ctrl-click toggles). **Hidden until the
  data actually contains non-full shots** — no noise when everything's full.
- **Scope summary shows the type filter** (purple chip) so you always know
  when non-full shots are excluded or when you've narrowed to a type.
- **Migration** backfills `shotType: 'full'` on all existing shots
  (idempotent, runs once on boot).

### Tagging
- **Bulk**: select shots in the Shots view → "Set type" → pick from the chip
  grid. This is the main path (you tag a range of pitches from a session).
- **Inline**: click the TYPE cell on any row in the Summary tab → per-shot
  picker.

## Equipment (stop-gap capture)

### What's in place
- **New `equipment` field**. Null = untagged. Stores strings like
  "Titleist T150", "Ping i230", or bare "Mizuno".
- **Fixed brand→model picker** — a curated, hardcoded taxonomy (see
  `data/equipment.js`): 8 brands (Titleist, Ping, Mizuno, Callaway,
  TaylorMade, Srixon, Cobra, Wilson), up to 4 representative current iron
  models each, compiled from public 2024-2026 lineup data. Two-step pick:
  brand → model (or bare brand, or "Clear tag").
- **Shown in the Summary tab** EQUIP column.
- **Bulk + inline tagging**, same pattern as shot type.

### What's deliberately NOT here
- **No free text.** The fixed list means no typo-fragmentation, but also no
  arbitrary names yet. That's the deferred "proper" version.
- **No equipment filter.** Captured and visible only. Filtering comes with
  the proper system once you've decided how you want to use it.
- **No analysis effect.** Equipment doesn't change any view's numbers yet.

The fixed brand list is explicitly a stop-gap so equipment can be captured
now without committing to the full design.

## Summary tab is now wider

The Summary tab columns are now: When · User · Type · Equip · Ball Spd ·
Smash · Carry · Total · F→P. It's the scan tab, so the extra width is
acceptable; Ball and Club tabs are unchanged.

## Files modified

| File | What changed |
|---|---|
| `src/data/shotTypes.js` | **NEW** — shot type enum + label helper |
| `src/data/equipment.js` | **NEW** — curated brand/model taxonomy |
| `src/lib/parser.js` | Defaults `shotType: 'full'` and `equipment: null` on import |
| `src/lib/storage.js` | New `migrateShotMeta()` backfill migration |
| `src/App.jsx` | `selectedTypes` filter state (default full); shot-type filtering in filteredShots; availableTypes detection; runs migrateShotMeta on boot |
| `src/components/FilterBar.jsx` | TYPES filter row (hidden until non-full exists); type focus/additive click logic; clearAll resets types |
| `src/components/ScopeSummary.jsx` | Shows type filter as a purple chip |
| `src/views/ShotsView.jsx` | TYPE + EQUIP columns on Summary tab; bulk Set type / Set equipment actions; inline cell editing; TypePicker + EquipmentPicker components |
| `src/index.css` | tone-type scope chip colour |

## Verified

- Production build clean
- Shot type + equipment data modules smoke-tested: labels resolve, unknown
  equipment rejected, 37 equipment options across 8 brands
- Migration idempotent (meta-flag guarded)
- Export/import (PR 4.11) carries the new fields automatically (preserves all
  shot fields); legacy backups import then get migrated on boot

## How you'll use it

After applying, a wedge session workflow:

1. Import the session (all shots default to Full)
2. Go to Shots → Summary tab
3. Select the pitch shots (checkboxes)
4. "Set type" → Pitch
5. Now your Distance/Strike/etc views show only full shots by default; your
   50° full carry is clean. Switch the TYPES filter to Pitch to analyse
   pitches separately.

For equipment, same flow with "Set equipment" → pick brand → model. It'll
show in the EQUIP column but won't filter anything yet.

## What's next

- The **proper equipment system** when you've thought it through (free text +
  autocomplete, or user-managed bags, plus filtering + analysis integration)
- **PR 4.14** — per-club swing fingerprint view
