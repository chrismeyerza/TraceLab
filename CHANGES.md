# Changes — Filter visibility + Shots view tabs (PR 3)

Five interlocking pieces to fix the "what's currently filtered?" problem and
to make the Shots view actually usable now that we have 24+ columns of data.

## 1. New ScopeSummary line on every analytical view

Below the FilterBar, every view now shows a single-line summary of the
current data scope when (and only when) filters are active:

> Showing **47** of 213 shots · 22% · `7i` · `LAST 30 DAYS` · `SESSION: 20260520-1745`

Colour-coded chips: green = club filter, amber = time filter, blue = session
pin. The line is hidden entirely when nothing is filtered, so we don't clutter
the screen with redundant information.

## 2. Clear filters button

The FilterBar gets a "Clear all filters" button in its top-right corner,
which appears whenever any filter is active. One click resets clubs to ALL,
time to all-time, and removes any session pin.

## 3. Click-the-last-active-chip resets to ALL

Previously, clicking the only remaining active club chip did nothing — the
guard was "don't let the filter set become empty". That created a stuck state
where the user thought the click was broken.

Now clicking the last active chip re-selects ALL clubs. There's no stuck
state, and the natural mental model ("toggle this chip off") works.

## 4. Louder active filter chips

Inactive chips are now visibly dimmer (50% opacity, transparent background,
faint text). Active chips get a glow halo via box-shadow plus the existing
colour swap. The contrast between "this is selected" and "this is not"
is now hard to miss at a glance.

## 5. Shots view: Summary / Ball / Club sub-tabs

The Shots view crammed 13 data columns into one table and forced horizontal
scrolling. With derived fields landed (Face to Path, Spin Axis, Run, Curve,
Spin Loft) we'd need 18+ columns to surface everything — clearly untenable.

Now three sub-tabs sit at the top of the Shots view:

- **Summary** (6 cols) — when, club, ball spd, smash, carry, total, F→P.
  The scan view. Fast.
- **Ball** (16 cols) — everything ball-flight: speeds, all the spins,
  spin axis, carry, total, run, offline, curvature, peak height, descent
  angle. **Smash factor lives here** (it's an outcome of strike quality).
- **Club** (12 cols) — everything club-impact: club speed (gross + at impact),
  AoA, path, face-to-target, face-to-path, loft, spin loft, lie, closure
  rate, impact location H+V.

Shared across all three tabs:
- Selection state (checkboxes survive tab switching)
- Bulk action bar (relabel, delete)
- Editable club chip (every row, every tab)
- Sort: persists between tabs if the sort column exists in the new tab;
  falls back to "When" descending otherwise

## Files modified

| File | What changed |
|---|---|
| `src/components/ScopeSummary.jsx` | **NEW** — the scope summary line component |
| `src/components/FilterBar.jsx` | Clear-all button; last-chip-resets-to-ALL; louder active styling on club chips |
| `src/views/ShotsView.jsx` | Restructured around a TABS config; columns split into Summary/Ball/Club; sort-key persistence; minWidth based on tab |
| `src/App.jsx` | Imports & renders ScopeSummary beneath FilterBar |
| `src/index.css` | `.scope-summary`, `.shots-tabs`, dimmed inactive chips, glow box-shadow on active chips |

## What this does NOT change

- Filter semantics are unchanged. Persistent across views; AND between club,
  time, and session pin. This was the right design — the bug was visibility,
  not behaviour.
- Storage layer unchanged.
- Parser unchanged.
- Other views unchanged.

## Testing

- Build clean: 49 modules, 181 KB gzipped (+1.5 KB for the new component +
  the larger ShotsView)
- Tab switching preserves selection and sort across the three tabs
- Sort-key fallback verified: sort by `clubSpeed` on Club tab → switch to
  Summary tab → falls back to `createdAt desc` because `clubSpeed` doesn't
  exist there

## What's next

PR 4 (Distance view) and PR 5 (Swing analysis upgrade to Shape view) — the
remaining backlog from our last round.
