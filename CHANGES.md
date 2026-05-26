# Changes — Legibility pass across all views (PR 4.7)

A systemic fix to dim text problems across every menu item — Overview,
Strike, Flight, Distance, Shape, Shots, Sessions.

## The problem this addresses

The previous palette had three grey tiers (`--text`, `--text-dim`,
`--text-faint`) but the dim and faint tiers were significantly under-bright
for a dark theme. Combined with small font sizes (9–10px) and regular weight
(400), text intended to be "subtle" became genuinely hard to read on a
moderate-quality monitor in normal indoor lighting.

This wasn't a one-off bug to bump in three places — it was a systemic miscall
across ~50 component-level usages. The fix is correspondingly system-level.

## What's now in place

### A rebuilt five-tier text palette

The old three tiers had a squashed contrast pyramid. The new five tiers map
cleanly to information hierarchy:

| Tier | Luminance | Use for |
|---|---|---|
| `--text-strong` (NEW) | ~96% white | Headline numbers, big values, "this matters" |
| `--text` | ~88% white | Body text, ordinary chart labels, table values |
| `--text-dim` | ~72% (was 56%) | Supporting captions, secondary labels |
| `--text-faint` | ~55% (was 36%) | Metadata, sub-text, range/n callouts |
| `--text-mute` (NEW) | ~38% | Actually disabled / decorative chrome only |

The two existing tiers got pulled up by 12–19 percentage points each — the
single highest-leverage change in this PR. That ripples through every
component that uses the variables (around 50 CSS rules plus ~12 inline JSX
usages).

### Border colours nudged brighter

`--border` and `--border-strong` got tiny brightness bumps so the lines
separating cards, rows, and dividers are visible without being loud. Was
making the layout feel "blurry" at the edges.

### Targeted structural fixes on top of the palette

Where the palette alone wasn't enough — usually because text was also too
small or too light-weight to read — there are individual class-level fixes:

**Card titles** — bumped from 11px `--text-dim` to 12px `--text-strong`,
weight 600. They're top-of-card headings, they should command attention.

**Card subtitles** — bumped from 10px `--text-faint` to 11px `--text-dim`,
weight 500. Was the smallest-thinnest-dimmest combination on the page.

**Page meta lines** — first line in full `--text` weight 500; second line
in dim weight 400. Old version had both lines at the same dim level.

**Club summary table cells** — values bumped from 14px to 15px in
`--text-strong`. Labels (the "mph" / "yd carry" / "shots" sub-text) bumped
from 9px `--text-faint` to 10px `--text-faint` weight 500. Header row from
9px to 10px weight 600.

**±σ annotations** (Overview per-club table) — bumped from 10px to 11px,
added weight 500. Was barely visible.

**Strike tolerance explainer** — bumped from 12px `--text-dim` to 13px
`--text`. Bold colour callouts (Centred / Near / Off) got weight 600.

**Strike per-club plot headers** — n-count bumped from 10px `--text-faint`
to 11px `--text-dim` weight 600. Stats line below the plot bumped from 10px
to 11px with stronger value text.

**Strike band-count line** ("● 3 centred ● 6 near ● 7 off+") — bumped from
10px `--text-dim` to 11px weight 600.

**Strike consistency-zone caption** — bumped from 9px to 10px weight 500.

**Insight title** — bumped from 10px to 11px.

**Insight pillar headers** — bumped from 10px to 12px weight 700, with
stronger border colour (33 → 55 alpha).

**Distance explainer** — bumped from 12px `--text-dim` to 13px `--text`,
with `--text-strong` for the bold callouts.

**Distance gap warning** — bumped from 11px `--text-dim` to 13px `--text`,
with weight 700 amber callout and stronger border.

**Distance ladder labels** — carry numbers bumped from 11px to 12px weight
600 in `--text-strong`. Source tag ("FROM ALL SHOTS" / "SMART CARRY")
bumped from 9px to 10px weight 500.

**Distance cost-of-poor-strikes secondary text** — bumped from 10px
`--text-dim` to 11px weight 500.

**Distance empty state** — bumped from 12px to 13px with line-height 1.5.

**Sessions list header** — bumped from 9px `--text-faint` to 10px
`--text-dim` weight 600.

**Sessions list rows** — ID column from 10px `--text-faint` to 11px weight
500. Action buttons (VIEW / DEL) from 9px to 10px with more padding so
they're easier to click.

**Sessions grid** — widened action column from 40px to 80px so VIEW and DEL
buttons fit without crowding.

**Club tag chips** in sessions — bumped padding and weight from 600 to 700.

**Flight gauge caption** — `gauge-caption-dim` now has weight 500 (was
default 400). Combined with brighter `--text-faint`, the "range X · n=Z"
portion is now clearly readable while staying lower-emphasis than the 1σ band.

## What you should now experience

The test I committed to was: **you should be able to read every piece of
text on every screen with a glance, in a moderately lit room, without
leaning forward**. After this pass:

- Card subtitles, page meta lines, and explainer text all sit at readable
  contrast across all views
- The ±σ ranges next to your per-club averages are visible at a normal
  reading distance
- The "range X–Y" / "n = Z" caption on each Flight gauge is clearly readable
- The Strike explainer text reads like prose, not metadata
- The Distance gap warning has the visual weight it needs
- Session IDs, club tags, and action buttons are properly distinguished

If any specific spot still looks under-bright, tell me where and I'll bump
it surgically — this is a starting state for the palette, not a final one.

## Files modified

| File | What changed |
|---|---|
| `src/index.css` | Palette rebuild (5-tier system); ~20 class-level adjustments to text sizing/weight/colour |
| `src/views/OverviewView.jsx` | ±σ annotations bumped; insight pillar header bumped |
| `src/views/StrikeView.jsx` | Tolerance explainer bumped; per-club plot header/stats/band-count line bumped; consistency caption bumped |
| `src/views/DistanceView.jsx` | Explainer / gap warning / ladder labels / cost cards / empty state all bumped |
| `src/views/SessionsView.jsx` | ID column and action buttons bumped; column widths adjusted |

## What's NOT in this PR

- No logic changes anywhere — no statistics rewritten, no new features
- No new components or new views
- No breaking changes to the data model

This is purely a visual hygiene PR. Safe to apply and revert.

## Verified

Production build clean. Bundle size effectively unchanged (a few hundred
bytes of additional CSS for the new variables).

## What's next

PR 5 — Shape view → swing fingerprint upgrade — remains the open priority.
