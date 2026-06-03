# Changes — Type chips, orphan fix, cascade delete (PR 4.17.2)

Three fixes for the cross-device workflow problems you flagged. Version
bumped to **1.7.2**.

## 1. All 8 shot type chips always visible

**Before:** The TYPES filter row only showed chips for shot types that
already existed in your data. Fresh imports start with everything as
`full`, so you'd only see one chip — making it impossible to filter to
"show me my pitches" until you'd already tagged at least one pitch.
Chicken and egg.

**After:** All 8 type chips render every time (Full, 3/4, Half, Pitch,
Chip, Bunker, Flop, Other). Types with no shots in the current scope
appear dimmed (45% opacity) with a tooltip "No shots tagged Pitch yet"
— so you can still see which categories have data, but you can always
filter to any type.

## 2. Cascade-aware user deletion

**Before:** Delete a user → native `confirm("their shots stay in the
database but become unattributed")` → user deleted, shots orphaned.
Then nothing in the UI shows you what to do about the orphaned data.

**After:** Delete a user → DeleteUserModal opens with a real choice:

- **Reassign & delete** (default, safe) — pick another player to move
  all their shots to, then delete the profile. No data loss.
- **Delete with shots…** — high-friction destructive option. Requires
  typing the player's name to confirm. Use for genuine mistakes (test
  data, accidental imports).
- **Cancel** — do nothing.

For users with zero shots, the modal simplifies to just Delete / Cancel
— no reassign question because there's nothing to reassign.

If you're deleting the currently active user, the app switches active
to whichever player you reassigned to (or, in the destructive path, to
whichever player remains).

## 3. Re-attribute orphaned shots — Settings action

**The actual fix to your situation.** After restoring a v1 backup on a
fresh device, the shots come along but their `userId` references point
at user records that don't exist on this device. The shots appear with
no player assigned.

**New Settings section** — appears only when orphans exist:

```
Data attribution

⚠ 96 shots reference a player that doesn't exist on this device.
Typical after restoring a backup from another device — the shots came
along, but their player record didn't.

[ Re-attribute to active player ]
```

One click moves all orphaned shots onto the currently active player.
Same effect as the DevTools snippet I gave you earlier, but built into
the UI so future users don't have to touch the console.

The section disappears once orphans are cleared.

## Implementation note: how "orphan" is defined

A shot is orphaned if:
- `userId` is missing (legacy shots before user identity was added), OR
- `userId` is set but doesn't match any user in localStorage (cross-device
  restore where users didn't come along — the v1-backup case)

`surveyOrphanedShots()` in `lib/users.js` is the single source of truth;
both the count in Settings and the re-attribute action use it.

## Files modified

| File | What changed |
|---|---|
| `src/lib/users.js` | New `surveyOrphanedShots()` and `reattributeOrphans()` helpers |
| `src/components/FilterBar.jsx` | All 8 type chips always rendered; empty ones dimmed; `clickType` and `typesActive` use `SHOT_TYPE_KEYS` (full set) not `availableTypes` (data-only) |
| `src/components/DeleteUserModal.jsx` | **NEW** — three-mode modal: choose, confirmingDestroy, simple (zero shots) |
| `src/components/SettingsPanel.jsx` | New orphans section appears when count > 0; "Re-attribute to active player" button |
| `src/App.jsx` | Native-confirm delete flow replaced with state-driven modal opening; `handleReassignAndDelete` and `handleDeleteWithShots` action handlers; `handleReattributeOrphans`; `orphanCount` memo; new state `userToDelete`; imports for DeleteUserModal, surveyOrphanedShots, reattributeOrphans |
| `package.json` | 1.7.1 → 1.7.2 |

## Verified

- Production build clean
- `surveyOrphanedShots` smoke-tested: correctly classifies missing-userId,
  unknown-userId (multiple distinct), and present-but-known
- All 8 type chips render including for types with zero shots in scope

## Apply

Branch: `feature/pr4-17-2-orphans-and-cascade-delete`. Layers on top of
PR 4.17.

## How to use immediately

If you already ran the DevTools snippet, the orphan count should now be
0 — meaning the new Settings section won't appear. To verify it's
working in your data, the proof points are:

1. **Settings panel** — open it. The "Data attribution" amber section
   should NOT appear (since you re-attributed). All your players list
   cleanly.
2. **TYPES filter row** — should show all 8 chips. Pitch, Chip, etc
   should appear (dimmed if no shots tagged that way yet) and be
   clickable.
3. **Delete a player** (if you want to clean up further) — should now
   open the modal with proper reassign vs delete-with-shots options.
