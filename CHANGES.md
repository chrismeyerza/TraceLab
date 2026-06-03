# Changes — First-launch flow, click bug, rename, SM11 (PR 4.17)

Four cleanups in one batch. Version bumped to **1.7.1**. Each item below
addresses something you flagged after using TraceLab on your desktop Mac.

## 1. Welcome screen on fresh devices

**Before:** Loading TraceLab in a new browser auto-created "Chris Meyer"
and forced you into the edit modal. If you already had a backup from
another device, there was no path to restore until AFTER you'd added
shots — and you'd end up with a duplicate Chris Meyer profile.

**After:** Fresh browsers (no users, no shots) show a Welcome screen
with two clear paths, before anything destructive happens:

```
Welcome to TraceLab
How would you like to start?

┌─────────────────────────────────────┐
│  Restore from backup                │
│  Already use TraceLab on another    │
│  device? Pick your .tracelab.json   │
│  file to restore your profile and   │
│  shots in one step.                 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Set up a new profile               │
│  First time using TraceLab? Create  │
│  your player profile and start      │
│  importing sessions.                │
└─────────────────────────────────────┘
```

Pick Restore → file picker opens → drop the JSON → users AND shots
restored together → straight into the app.

Pick Create → goes through the existing "auto-seed Chris Meyer, open
edit modal" flow.

## 2. Backup format extended to include users (v2)

Previously the backup only contained shots, so restoring on a new device
left you without a player profile. The v2 backup now includes the users
array alongside shots. User IDs are preserved across restore so
shots' `userId` references still link to their owners.

- **Forward compatible:** importer accepts both v1 (legacy, shots only)
  and v2 (current, shots + users) payloads
- **Backwards compatible:** old TraceLab versions can still read v1
  exports; v2 exports just include more data
- v1 restore on a fresh device still works (falls through to "create
  new profile" because no users come along)

Files exported from this version will be tagged v2 in the envelope.

## 3. "Relabel club" → "Reassign club"

You correctly pointed out that the bulk action wasn't relabelling — it
was reassigning shots to a different club. The label is now "Reassign
club" and the bulk panel's title is "Reassign N shots as:". The inline
edit tooltip also reads "Click to reassign this shot to a different
club".

## 4. Equipment-edit bug fixed

**The bug:** Clicking a brand in the per-shot equipment picker did
nothing — the picker appeared to close and the equipment didn't update.

**Cause:** The picker is rendered inside the cell's onClick handler.
When you clicked a brand button, the click event bubbled up to the
cell, which immediately closed the picker. The first click of the
brand → model flow was being eaten by the cell's toggle behaviour, so
you could never reach the model list.

**Fix:** The picker root now stops click propagation
(`onClick={(e) => e.stopPropagation()}`). Clicks inside the picker stay
inside the picker. Same defensive fix applied to the TypePicker (it
didn't manifest a visible bug there because TypePicker is one-click,
but the same risk existed).

## 5. Vokey SM11 added

[Verified against current Titleist data — SM11 launched on PGA Tour in
January 2026, available at retail from February 20, 2026.] SM11 is now
the first Vokey option in the wedge picker, with SM10/SM9/SM8 retained
as older generations. Your 54° can be tagged as Vokey SM11.

## Files modified

| File | What changed |
|---|---|
| `src/lib/storage.js` | Export bumped to v2 (includes users array); importer accepts both v1 and v2 |
| `src/data/equipment.js` | Vokey models: SM11 added at the top |
| `src/views/ShotsView.jsx` | "Relabel" → "Reassign"; stop propagation on TypePicker and EquipmentPicker roots |
| `src/components/WelcomeModal.jsx` | **NEW** — two-path first-launch screen |
| `src/App.jsx` | Show WelcomeModal on fresh device instead of auto-seeding; new handleWelcomeRestore / handleWelcomeCreate handlers; handleBackupImport surfaces usersAdded count |
| `src/index.css` | welcome-card styles |
| `package.json` | 1.7.0 → 1.7.1 |

## Verified

- Production build clean
- Backup envelope schema validation: accepts v1 and v2, rejects others
- Cross-device flow tested mentally:
  - Mac desktop loads → no users → WelcomeModal appears
  - Click Restore → file picker → drop laptop's backup → users +
    shots restored, active user set, straight into app
  - Or click Create → auto-seed Chris Meyer → edit modal → standard
    first-launch flow

## Practical workflow for your desktop Mac right now

You currently have a duplicate "Chris Meyer" on your desktop. Two
options to clean up:

1. **Easy**: Use the duplicate. It's just a name; your data flows in
   under whichever user is active.
2. **Tidy**: On your laptop, Sessions → Data Management → Export
   backup. Save the .tracelab.json file. On your desktop, delete the
   duplicate user via Settings (gear icon, × on the user row — but
   only after another user exists, so for now skip). Or, simpler:
   wipe localStorage on the desktop (DevTools → Application → Local
   Storage → delete both `tracelab_users` and
   `tracelab_active_user`), reload — Welcome screen appears →
   Restore → done.

For all FUTURE new devices, the Welcome screen handles this cleanly.

## What's next

PR 4.18 — equipment-as-bag-property. Equipment moves out of per-shot
editing and into the user profile as a "my bag" mapping. Reassigning
clubs auto-fills equipment. Demos handled via free-form tags.
