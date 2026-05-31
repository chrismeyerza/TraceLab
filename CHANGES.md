# Changes — Bug fixes, player rename, filter visibility (PR 4.13.1)

Six fixes in response to PR 4.13 feedback. Bumps app version to **1.4.0**
and switches version display to read from package.json so we never have
to update it in two places again.

## 1. Scatter Y-axis flipped to match ball flight

The Face vs Path scatter previously had positive face-to-target at the
TOP (standard math orientation). Visually this meant a draw curved
*down-and-left* and a fade *up-and-right* — backwards from how a player
sees ball flight.

**Fix:** Y axis inverted so closed face / draw is at the TOP and open
face / fade is at the BOTTOM. Now a draw curves *up-and-left* and a
fade *down-and-right* — matching the visual story. Corner labels
(DRAW/HOOK, FADE/SLICE) swapped to match. Labels and dots use the same
yToPx function so they stay perfectly consistent.

## 2. Reclassify-didn't-stick bug fixed

The bug: tagging a shot as anything other than "Full" in the Shots view
made it vanish from the table, looking like the edit had silently
failed. The data was actually changing — but the default `selectedTypes
= ['full']` filter immediately hid the now-pitch shot.

**Root cause:** the Shots view was receiving `filteredShots` (which
includes the shot-type filter), but it's a data EDITOR, not an analysis
view. You need to see all your shots to tag them.

**Fix:** A new `shotsForEditing` memo applies club / time / session
filters but NOT the shot-type filter. The Shots view now uses that, so
reclassifying a 54° to Pitch keeps the row visible (just showing
"Pitch" in the Type column).

## 3. Equipment picker now shows current selection

The bug: opening the picker for a shot already tagged with (say)
"Mizuno JPX 925" didn't show that anywhere — you'd have to click
through brands to find what was assigned.

**Fix:**
- The picker now **opens straight to the current brand's model list**
  if a tag exists
- The current brand and model are **highlighted in green with a ✓**
  so the assignment is obvious at a glance
- When you reopen, you immediately see what's there

## 4. "User" → "Player" throughout visible UI

Renamed in all user-facing strings:
- Shots view column header: USER → **PLAYER**
- Settings panel: "Users" → "**Players**", "Add user" → "**Add player**"
- User modal: "Edit user" → "**Edit player**", "Create user" → "**Create player**"
- Import modal: "Existing users" → "**Existing players**", "Attribute these
  shots to a user" → "**...to a player**", "Create new user" → "**Create
  new player**"
- TopBar gear tooltip: "Active user" → "**Active player**"
- Welcome subtitle: "add more users any time" → "**add more players any time**"

Internal field name stays `userId` — no data migration needed, just a
visible rename.

## 5. TYPES filter row now always visible (when shots exist)

The previous behaviour hid the TYPES row until non-full shots existed in
the data. Your point: if we're silently defaulting to "Full only" for
analysis, the user should SEE that filter is engaged.

**Fix:** TYPES row appears whenever there are any shots. With only Full
shots in the data, you see a single "Full" chip with "ALL" — making
the default explicit. Once you tag a pitch, additional chips appear
automatically.

The ScopeSummary scope chip behaviour is now smarter:
- When the data is **only Full** and the filter is on **Full**: no chip
  shown (that's the baseline, not "filtering")
- When non-Full shots **exist** and filter is **Full only**: chip
  appears (you're genuinely excluding non-full shots — worth surfacing)
- When the user has **manually narrowed** the type selection: chip
  appears

## 6. Version auto-reads from package.json

Previously the TopBar showed a hardcoded "v1.3" string that I had to
remember to update separately from package.json. Now it imports
`package.json` directly and displays `v${pkg.version.split('.').slice(0,2).join('.')}` —
so the brand strip auto-tracks the actual project version. Single source
of truth.

This batch bumps **package.json from 1.2.0 to 1.4.0**, so the app will
display **v1.4**.

(Going forward: every PR I send bumps the version in package.json. You
never edit it. The display updates automatically.)

## Files modified

| File | What changed |
|---|---|
| `package.json` | Version bumped to 1.4.0 |
| `src/components/TopBar.jsx` | Imports package.json; version display reads from it; tooltip "Active user" → "Active player" |
| `src/components/SettingsPanel.jsx` | "Users" → "Players" labels |
| `src/components/UserModal.jsx` | Title/button text uses "player"; welcome subtitle uses "players" |
| `src/components/ImportUserModal.jsx` | Visible strings use "player" |
| `src/components/ScopeSummary.jsx` | Smarter `isFilteringTypes` logic; accepts `availableTypes` prop |
| `src/views/ShapeView.jsx` | Y axis flipped; corner labels swapped |
| `src/views/ShotsView.jsx` | "USER" column label → "PLAYER"; EquipmentPicker opens to current brand + highlights current model |
| `src/App.jsx` | New `shotsForEditing` memo (no type filter for Shots view); TYPES row always visible (`showTypes = shots.length > 0`); passes `availableTypes` to ScopeSummary |

## Verified

- Production build clean
- Version 1.4.0 baked into the bundle
- TopBar will display "v1.4"

## Answers to the open questions

- **"How else is brand used?"** — Right now, nowhere. Stop-gap capture
  only by explicit decision. Shows in the EQUIP column, that's it. The
  proper equipment system (filtering + analysis) is the deferred work
  for when you've thought through the workflow.

- **"Off-centre carries further than centre on 7i 28/5"** — Genuine
  small-sample / strike-quality vs swing-speed effect, not a bug in the
  cohort logic. Investigating it properly requires uploading the 28/5
  data so I can see the actual shots — deferred per your call.

- **"Smash factor on 7i 28/5 lower for centred than near/off"** —
  Genuinely interesting catch. Possible causes range from real club
  physics (gear effect from high-face strikes) to a strike
  classification miscalibration. Needs your data to investigate
  properly — deferred until upload.

## Backlog

Per your instruction, **column reordering in Shots view** is parked on
the backlog. Other deferred items: smash-factor investigation (needs
data), off-centre-carries-further note, proper equipment system,
PR 4.14 per-club swing fingerprint view.
