# Changes — Tag management (PR 4.15.1)

Small follow-up to PR 4.15 adding the global tag operations that were
deferred. Version bumped to **1.6.1**.

Two operations land:

- **Rename** a tag globally — every shot carrying the old name gets it
  replaced with the new one. Case-insensitive merge when the target name
  already exists (with a confirmation dialog flagging the merge).
- **Delete** a tag from every shot that carries it. The shots stay; only
  the tag is removed.

## Where it lives

A new **MANAGE…** chip at the end of the TAGS filter row. Click it to
open the tag management popover below the row. The popover lists every
tag in the data with its usage count and two actions per row:

```
[ Windy           42 ]   ✎  ×
[ After lesson     8 ]   ✎  ×
[ Tournament prep  3 ]   ✎  ×
```

Rename uses inline editing — click ✎ → name becomes editable → Enter to
save, Esc to cancel. Delete uses a native confirmation dialog because
losing tags is destructive and the native dialog is unambiguous.

Closes on Escape, outside click, or the × in its header.

## How merging works

If you rename `Windy` → `windy day` and `windy day` already exists:
- Confirmation dialog: "windy day already exists with N shots. Renaming
  will MERGE 'Windy' into 'windy day'. Continue?"
- On confirm: every shot tagged Windy gets it replaced with the existing
  casing of `windy day`. Shots that had both end up with just one.
- Case-insensitive comparison throughout — `WINDY` → `windy day` and
  `windy` → `Windy Day` all merge correctly.

## Pre-creating tags?

You asked about this. I left it out and want to be explicit about why:
the current model is **tags emerge from your data**. The filter row, the
autocomplete pool, the management screen all derive from "what tags
exist in shots right now." Pre-created tags would mean maintaining a
separate library, which raises questions ("filter shows library tags
that have no shots?") without solving a problem you have — tagging a
shot is already type-Enter-done. If you find a real use case for it
later we can revisit.

## Files modified

| File | What changed |
|---|---|
| `src/lib/tags.js` | New `renameTagInShots()` and `deleteTagFromShots()` — build update batches without mutating, so the existing onUpdateShots path persists everything |
| `src/components/TagManagementPanel.jsx` | **NEW** — popover with inline rename + delete |
| `src/components/FilterBar.jsx` | Adds MANAGE… button to TAGS row; renders the panel below the row; accepts `onRenameTag` and `onDeleteTag` props |
| `src/App.jsx` | `handleRenameTag` and `handleDeleteTag` handlers using the new helpers + existing `handleUpdateShots`; passes them to FilterBar |
| `src/index.css` | Tag management panel styles |
| `package.json` | 1.6.0 → 1.6.1 |

## Verified

- Production build clean
- Rename helper smoke-tested:
  - Standard rename: every shot with old tag updated
  - No-op rename (same canonical): returns empty batch
  - Merge case: shot with both old and new tag collapses correctly
  - Shots without the old tag are skipped
- Delete helper:
  - Strips tag from all matching shots
  - Empty result when tag doesn't exist anywhere

## Apply

Branch: `feature/pr4-15-1-tag-management`. Applies cleanly on top of PR 4.15.
