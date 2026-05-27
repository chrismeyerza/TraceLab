# Changes — Shape view honest-bucketing + click-to-drill (PR 4.9)

Three focused fixes to make the Shape view trustworthy and inspectable.

## 1. Bucketing bug fixed — Pull Hook count now honest

The bug: `'Hook': 'Pull Hook'` in the bucketing map was sending shots
that started square-to-target but curved violently into the corner "Pull
Hook" cell. The corners are meant for "started off-target AND curved
further off-target" only — a corner should mean the shot ended up far
left or far right.

A Hook with a straight start ends up further left than a draw, but it
*didn't start* off-target. It belongs in the middle-row Draw cell.

Same bug existed for `'Slice': 'Push Slice'` (severe slice with straight
start was being thrown into the corner instead of the middle-row Fade
cell).

**Concrete result on your 22-shot dataset:**

| Bucket | Before PR 4.9 | After PR 4.9 |
|---|---|---|
| Draw | 33% | **43%** ← the controlled curves now go where they belong |
| Pull Hook | 29% | **19%** ← only genuinely severe shots remain |
| Fade | 24% | 24% |
| Straight | 14% | 14% |

The 4 shots still in Pull Hook all have face <−4.9° AND face-to-path
<−5.7°. Those really are pull hooks. The 2 shots that moved out had
near-square face but severely closed-to-path delivery — i.e., they
started near target and curved sharply left. Draws, not pull hooks.

## 2. OPTIMAL label redesigned — no more green frame

The bracket-style frame from PR 4.8 was interfering visually with the
TYPICAL value label sitting next to it. Stripped the frame; "OPTIMAL"
now sits as a tight green word centred over the green zone, snug against
the top of the bar. Label row dropped from 38px back to 32px so the
chart reads more compactly.

## 3. Click-to-drill on the Shape view

The verification tool. Three places now respond to clicks:

- **9-ball matrix cells** — click any cell with shots in it. A drill
  panel appears below showing the actual shots that mapped to that cell,
  with per-shot face / path / F-to-P and the granular classification
  name (e.g. "Pull Slight Draw" vs "Pull Hook"). The selected cell gets
  a green border + soft green tint + outer glow so the source of the
  drill data is obvious. Click again to clear, or hit the CLEAR button.

- **Face-vs-Path scatter dots** — click any dot to see that specific
  shot. The selected dot grows from r=5 to r=8 with a strong outline.
  Useful for the "what was that outlier?" question.

- **CLEAR button** — explicit affordance on the drill panel to clear the
  selection.

The drill panel table columns are kept tight: when, club, face, path,
F-to-P, and the granular classification name. The granular name is
deliberately redundant with the cell label — it lets you see which
fine-grained sub-shape mapped to the displayed cell. So clicking "Draw"
might show you a mix of "Slight Draw", "Draw", "Hook", and "Pull Draw"
— all of which legitimately bucket to "Draw" under the new rules.

The drill state is **local to the Shape view** — switching to another
view doesn't carry it along. The drill is for exploring, not for
narrowing the rest of the app.

## Why this matters

Your specific feedback was that the Pull Hook count didn't match your
known delivery (path +2° I-O, face-to-path −2°, "almost a perfect draw").
With (a) the bucketing fix making the numbers more honest, and (b) the
ability to click a cell and see exactly which shots are in it, you can
verify any future surprises yourself instead of trusting (or fighting)
the aggregate count.

This is also the diagnostic tool for the bucketing logic itself. If you
disagree with a call ("that shouldn't be in Draw, it's a clear hook"),
you can see exactly what the classifier did and we can decide whether
the thresholds need another nudge.

## Files modified

| File | What changed |
|---|---|
| `src/lib/shape.js` | Bucketing map: `Hook` → `Draw`, `Slice` → `Fade` (was incorrectly going to corners) |
| `src/views/ShapeView.jsx` | New `DrillPanel` component; click handlers on cells + scatter dots; `useState` for `drillDown` selection; updated grid caption text |
| `src/index.css` | New `.shape-cell.clickable` and `.shape-cell.selected` styles; OPTIMAL marker rewritten as flat label (no frame); label row height reduced |

## Verified

- Production build clean
- Sanity-tested on your 22-shot dataset — Pull Hook drops to 19%, Draw
  rises to 43% (matching your reported typical delivery), and the
  remaining Pull Hook shots all have face-to-path < -5°
- Manual click flow tested mentally: select cell → see shots → click
  another cell → swap; click same cell again → deselects; click scatter
  dot → opens shot drill; CLEAR button works on both modes

## What's next

Same backlog as before — per-shot tagging via club label is the next
natural fit, then per-club swing fingerprint, then user-name-on-import.
