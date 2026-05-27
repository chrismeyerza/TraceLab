# Changes — Tightening pass (PR 4.8)

Seven focused improvements addressing review feedback across Distance,
Strike, Flight, Shape, Filters, and Shots.

## 1. Distance · show % then N

The cohort column was just a raw shot count, which forced the user to do
mental math against the All-shots total to figure out cohort proportions.
Now shows percentage prominently, with shot count as a small secondary number:

```
Cohort        | % · N
─────────────────────
All shots     | 100% · 16
Smart         | 56%  · 9
Centred only  | 19%  · 3
```

Percentage uses All-shots count as the denominator, so the proportions
add up meaningfully ("19% of my 7-iron shots are centred strikes").

## 2. Strike · CARRY VS CENTRED

The old "VS YOUR CENTRED" column showed **ball speed loss** vs your
centred strikes. That's a proxy — the user thinks in distance lost, not
in ball speed lost.

Now the column shows **% carry vs your club's centred carry**. Same
calculation pattern (per-shot loss, averaged per band) but on the metric
that actually matters.

Calibrated colour thresholds:
- < −4% carry → red (significant loss)
- −1.5% to −4% → amber (meaningful loss)
- ≥ −1.5% → green (within noise)

For your 7i data with the new calculation:
- Centred: 0% (definitional reference)
- Near: −1.2% (within a yard or two of best)
- Off: −10.3% (14+ yards lost per shot)
- Miss: −25% (35 yards lost on a 7i)

Much more actionable than the old 3-5-8% ball-speed numbers.

## 3. Flight · OPTIMAL label above the chart

The "OPTIMAL" text label was painted inside the green zone, where it
competed with the dot markers and visually crowded the bar. Moved to a
bracket-style marker above the track:

- Green border bracket spans the optimal range horizontally
- "OPTIMAL" tag centred on the bracket, sitting just above the track
- Inside-bar green-zone fill remains, but without text overlay

Clean visual: the bar shows where shots are, the bracket above shows
where they should be.

## 4. Shape · % primary, N secondary in each cell

Old hierarchy:

```
Pull Hook
  6
  29%
```

New hierarchy:

```
Pull Hook
  29%
  6 shots
```

Percentage is the dominant number (font-size 22, weight 700,
text-strong); count drops to a small secondary line.

## 5. Shape · loosened thresholds + honest bucketing

The Pull Hook bucket was firing at 43% on your 7i data because of two
overlapping problems:

**A. Thresholds too aggressive.** A 1.5° face delivery was being called
"Pull"; a 0.5° face-to-path was being called "Draw". Both are essentially
square. New thresholds:

| Face direction      | Was   | Now  |
|---|---|---|
| Push/Pull kicks in  | ±1.5° | ±4°  |
| Slight Draw/Fade    | ±0.5° | ±0.7°|
| Draw/Fade           | ±2°   | ±2°  |
| Hook/Slice (NEW)    | —     | ±5°  |

**B. Bucketing was inflated.** "Pull Draw" (a controlled left-curving
shot) was collapsing to the corner "Pull Hook" cell. Now controlled
draws — regardless of whether they started slightly left, right, or
straight — collapse to the middle-row "Draw" cell. The corner Pull Hook
cell only fills with genuinely severe curves.

**Result on your 7i data:**

- Old: Pull Hook 43%, Draw ~5%
- New: Pull Hook 29%, Draw 33% (these were always draws, just mislabelled)

Plus your remaining 29% in Pull Hook is genuinely severe — face-to-path
values from −5° to −15°. Honest labelling: you really are producing
severe closed-face deliveries that often on your 7i.

## 6. Filter ALL · single-click focuses, cmd-click toggles

Old behaviour: clicking a club chip toggled it in/out of the selection.
To focus on just one club, you had to deselect every other chip
individually — painful with 10+ clubs loaded.

New behaviour matches every list-selection UI (file managers,
spreadsheets, design tools):

- **Plain click on a chip** → focus on ONLY this club (replaces selection)
- **Cmd-click / Ctrl-click on a chip** → toggle in/out of current selection
- **Click ALL** → select everything (unchanged)
- **Click the only-active chip again** → reset to ALL (escape hatch)

Tooltip on each chip: "Click to focus on just this club · Cmd/Ctrl-click
to add to selection".

## 7. Shots · clearer club chip edit affordance

The club chip on each shot row had a subtle hover-only colour. New
treatment:

- ✎ pencil icon next to the club label, faint by default, fully visible
  on hover
- Border intensifies on hover to clearly signal interactivity
- Tooltip mentions tagging convention: "Click to relabel · type a tag
  like '7i [Mizuno]' for testing variants"

The tooltip primes the future per-shot tagging workflow we discussed —
users will see the convention without needing a separate UI.

## Files modified

| File | What changed |
|---|---|
| `src/lib/shape.js` | Threshold rebuild + bucket-mapping reflecting honest curve severity |
| `src/views/DistanceView.jsx` | % · N column instead of raw N |
| `src/views/StrikeView.jsx` | Centred-carry reference per club; carry-loss % display + recolouring; header text |
| `src/views/FlightView.jsx` | OPTIMAL bracket moved above track; old in-bar label removed |
| `src/views/ShapeView.jsx` | Cell content reordered: name → % → count |
| `src/views/ShotsView.jsx` | Club chip uses new `.club-chip-edit` class with pencil icon |
| `src/components/FilterBar.jsx` | New `clickClub` with focus + modifier behaviour |
| `src/index.css` | New rules: `.gauge-optimal-marker`, `.club-chip-edit*`; updated `.shape-cell-*` hierarchy; taller `.gauge-label-row`; old `.gauge-window-label` removed |

## Tested

- Production build clean (~56KB JS / 18KB gzipped above PR 4.7's baseline)
- Shape classifier verified against your actual 22-shot dataset — Pull
  Hook count drops from 9 to 6, with remaining 6 confirmed as genuine
  severe closed-face deliveries (face-to-path −5° to −15°)
- Strike carry-vs-centred verified — produces the expected pattern
  (0% / −1% / −10% / −25%) on your 7i

## What's next

Pending from the queue:
- **PR 4.9** — Per-shot tagging via the club label (the `7i [Mizuno]`
  workflow we discussed)
- **PR 5** — Per-club swing fingerprint view (the original Shape upgrade)
- **PR 6+** — User name on import, session tags, export/import,
  MongoDB sync
