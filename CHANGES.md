# Changes — Putter hiding, useEffect import fix, dismissable overwrite prompt (PR 4.19.5)

Three fixes, all surfaced from real use. Version bumped to **1.9.5**.

## 1. Fix the Shots view crash (regression from 4.19.4)

**The bug:** Opening the Shots view caused a black screen and a console
error: `Uncaught ReferenceError: useEffect is not defined`.

**Cause:** PR 4.19.4 added `useEffect` calls to ShotsView (for the
column-reorder feature) but didn't update the React import at the top
of the file. I caught this via `npm run build` but the build only checks
syntax — the runtime crash only surfaces when the component renders,
which I didn't test in dev mode. My fault.

**Fix:** added `useEffect` to the React import in ShotsView.jsx.

If you've already worked around this locally (as you might have done
when I described the fix in chat), this PR overwrites your fix with the
same change.

## 2. Putter hidden from the bag UI

**The bug:** A `Pt` row appeared in your bag, categorised as an iron
(which meant the equipment picker offered iron brands for it). You've
always said your setup is "full bag minus putter" — Pt rows in the bag
are noise from ghost putter shots that occasionally get recorded by
FSX Play.

**Fixes:**

- **`clubCategory('Pt')` now returns `'putter'`** instead of falling
  through to the iron safe-fallback. The wider consequence: any future
  view that uses `clubCategory()` will treat putter as its own category
  rather than as an iron.
- **BagPanel filters Pt out** of both the row list and the "Add club to
  bag" dropdown. The bag is for analytics-tracked clubs only. If you
  ever want to start tracking putter (e.g. for a putting drill), the
  filter is easy to remove — but the default is correct for your
  workflow.

Your existing Pt shots in the data are untouched. They just don't
appear in the bag UI.

## 3. Dismissable "Overwrite equipment from bag" prompt

**The scenario:** You changed your bag from Ping G400 to a new iron
brand. The amber "Overwrite equipment from bag" prompt appeared in
Settings → Bag asking if you wanted to update your historic shots.
You wanted to say "no, leave them alone" — that's exactly the snapshot
semantic the design supports, so you can compare old-vs-new via the
equipment filter. But the prompt had no dismiss option, so it just sat
there pestering you.

**Fix:**

The prompt now has two buttons side-by-side:

```
⚠ 23 shots are tagged with equipment that doesn't match the current
   bag. If you've just changed gear, you probably want to keep the
   historic shots tagged with their original equipment so you can
   compare old vs new via the equipment filter.

[ Overwrite equipment from bag ] [ Keep historic shots as they are ]
```

- **Overwrite equipment from bag** — same as before, with a sharpened
  confirmation that explicitly warns against using it when you've just
  bought new clubs (which was the original confusion).
- **Keep historic shots as they are** — dismisses the prompt. Stores a
  fingerprint of the current disagreement state in localStorage. Stays
  dismissed even if you refresh, restart, or come back next week.

**The fingerprint:** combines the active user ID, the count of
disagreeing shots, and a hash of the bag entries. So:

- Dismiss the prompt with 23 disagreeing shots
- Refresh / restart — still dismissed (same state)
- Change a different bag entry that creates new disagreements — prompt
  re-appears (fingerprint changed)
- Different user signs in — prompt logic is per-user (no cross-user
  leakage of dismissal state)

The fingerprint also naturally invalidates if you ever DO press
"Overwrite" — the disagreements go away, count drops to 0, prompt
hides anyway. If you later create new disagreements, the prompt
re-appears.

## Files modified

| File | What changed |
|---|---|
| `src/views/ShotsView.jsx` | Added `useEffect` to React import (fixes the crash) |
| `src/data/benchmarks.js` | `clubCategory('Pt')` returns `'putter'` |
| `src/components/BagPanel.jsx` | Putter filtered from row list and add-dropdown; overwrite prompt has dismiss button; new props for fingerprint state |
| `src/components/SettingsPanel.jsx` | Pass-through for new bag props |
| `src/App.jsx` | Compute fingerprint, persist dismissal in localStorage, expose handler |
| `package.json` | 1.9.4 → 1.9.5 |

## Apply

Branch: `feature/pr4-19-5-putter-and-dismiss`. Layers on top of 4.19.4.

## What to test

1. **Open Shots view** — should load without errors (no black screen)
2. **Open Settings → Bag** — Pt row should NOT appear, even though you
   might have putter shots in your data
3. **Trigger the overwrite prompt** — if you don't currently have it
   showing, change your 7i bag entry to something different from what
   your existing 7i shots are tagged with. The prompt appears.
4. **Click "Keep historic shots as they are"** — prompt disappears
5. **Refresh the app** — prompt stays dismissed
6. **Change a different bag entry** (e.g. 8i to something else) — prompt
   re-appears for the new disagreement state

## What this PR doesn't change

- Pt shots in your data are not touched. They're still there, still
  searchable, still appear in Shots view, just not in the bag UI
- The "Fill missing equipment from bag" prompt (the blue one) is
  unchanged — it doesn't need a dismiss button because it's only ever
  helpful (fills NULL equipment, no destructive risk)
- The "Overwrite" action itself is unchanged — same confirmation
  dialog, same behaviour if you click it

## Backlog

Empty. Next PRs come from new discoveries or fresh ideas.
