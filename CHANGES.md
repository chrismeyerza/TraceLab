# Changes — Export & Import backup (PR 4.11)

A clean, local, file-based backup-and-restore mechanism. Solves two
real problems:

1. **Multi-machine workflow.** Your Mac and your other machine have
   diverged shot data. You can now Export from one, Restore on the other.
2. **No backups.** IndexedDB is the only place your shots live. Browser
   data wipe, profile corruption, switching browsers — any of these and
   the data was gone. Now you can carry a snapshot off.

## How it works

### Export

A button in the Sessions view → Data Management → Backup & Restore section.
Click it, get a download named like:

```
tracelab-export-20260527-0830.tracelab.json
```

The `.tracelab.json` extension makes it obvious which app produced it.
The timestamp is when the export was made. The file is plain JSON that
you can read in any text editor.

Schema:

```json
{
  "tracelab": {
    "version": 1,
    "exportedAt": "2026-05-27T08:30:00.000Z",
    "shotCount": 247
  },
  "shots": [ { ... }, { ... }, ... ]
}
```

The `tracelab` envelope is the recognisability marker — it's how Import
knows a file is actually one of ours, not random JSON. The `version`
field is the migration hook: when the shot schema changes in the future,
import can migrate older files automatically.

IndexedDB auto-increment IDs are stripped on export. They're database-local;
they should not pin across machines.

### Restore

A button next to Export. Pick a `.tracelab.json` file → it's validated
(envelope present, version known, shots array OK) → merged into the
current database.

**Dedupe behaviour: skip-existing.** Each shot has a stable dedup key
(`timestamp|ballSpeed`, no club). Any incoming shot whose key already
exists in your database is **skipped** — your local edits (e.g. club
relabels) are never overwritten by the imported version.

Result message tells you exactly what happened:

- `Imported 47 new shots` — clean addition
- `Imported 12 new shots · skipped 35 duplicates` — partial overlap
- `All 47 shots already in your database — nothing to import` — full
  duplicate file

### Validation

The import path throws a clear error on:

- File isn't valid JSON
- Missing `tracelab` envelope (random JSON, not one of ours)
- Unknown schema version (forward-compat guard — if a future TraceLab
  exports v2, this build refuses cleanly rather than corrupting data)
- `shots` field is missing or not an array

Errors surface in the same status banner that import errors use. The
user sees them; nothing silently fails.

### What's NOT in this PR

- **No cloud sync.** This is purely local file-based. Cloud comes later.
- **No replace-mode.** Import always merges. If you want to wipe and
  reload, use Clear All Data first, then Import.
- **No preview before import.** I considered showing a diff table
  before merging, but the skip-existing semantics make the merge safe
  by default. Can add a preview later if it turns out to matter.
- **No auto-export.** No background backups, no scheduled snapshots.
  User-triggered only.
- **Settings not exported.** Just the shots. Unit preferences are
  per-browser; they don't need to round-trip with the data.

## Files modified

| File | What changed |
|---|---|
| `src/lib/storage.js` | New `exportAllShotsAsJson()`, `makeExportFilename()`, `importShotsFromJson()` functions. Uses existing `addShots()` for the actual merge — so dedupe behaviour is identical to the CSV import path. |
| `src/App.jsx` | New `handleExport()` (builds Blob, synthesises download), `handleBackupImport()` (reads file text, hands to `importShotsFromJson`). Wires through to SessionsView. |
| `src/views/SessionsView.jsx` | Data Management card extended: Backup & Restore subsection with Export + Restore buttons; divider before destructive Clear All Data action. |

## Verified

- Production build clean
- Round-trip test on your 22-shot CSV: exports to 22 KB JSON (~1 KB
  per shot), parses back correctly, all 27 fields preserved including
  the new `startLine` derived field from PR 4.10
- Bad-input cases all throw the expected errors
- IndexedDB autoincrement `id` correctly stripped on export

## Practical workflow

When you next pick up TraceLab on your other machine:

1. On Mac: Sessions → Data Management → **Export backup**. Save the file.
2. Transfer it however (email to yourself, AirDrop, Dropbox, USB).
3. On other machine: Sessions → Data Management → **Restore backup**.
   Pick the file. Done.

Now both machines are in sync at the point of export. You can keep
both running independently; they'll diverge again until the next
export-import cycle. When that becomes painful, cloud sync is the
proper fix — but for now this is the right level of effort.

## What's next

User name on import + per-shot tagging via club label remain on the
backlog. Plus per-club swing fingerprint view if you want it.
