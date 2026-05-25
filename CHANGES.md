# Changes — Distance view (PR 4)

A new analytical view focused on carry, total, and run — with cohort-based
analysis that goes beyond the "single average" number every other launch
monitor stops at.

## The killer idea

Every commercial launch monitor reports "your 7-iron carries 152 yards" as
a single average — but that number mashes pure strikes together with toe-heel
mishits and gives you a biased-downward result that's useless for course
strategy.

We split each club into three cohorts and surface all three:

| Cohort | What it means | When to use it |
|---|---|---|
| **All shots** | Unfiltered average | The honest baseline. Useful for raw improvement tracking. |
| **Smart** (centred + near) | Realistic playing distance | Course strategy. The distance you can rely on. |
| **Centred only** | Pure-strike ceiling | What you could carry if everything's right. The gap to the All number = improvement potential. |

Cohort membership uses the per-club strike tolerance we already established
in the Strike view — drivers get wider tolerances than wedges, so the cohort
boundaries are appropriate to each club.

The σ (±1σ range) narrows as cohorts tighten, which is itself the data
story: "your good strikes are tight, your bad ones are wild".

## What's on the page

Four cards:

**01 · About these numbers** — short explainer of the cohort framework. Useful
context the first time someone sees the page; gets out of the way after.

**02 · Carry & total by club** — the main per-club table. Three rows per
club (All / Smart / Centred only), plus N, avg carry, avg total, avg run,
±1σ range, and a Tour Reference column showing the published "amateur
midpoint" carry for each club category.

Rows with fewer than 3 shots in their cohort are dimmed and labelled
"NEEDS MORE DATA" rather than showing misleading micro-sample stats.

**03 · Gapping ladder** — horizontal bar chart, one bar per club, sorted
by smart-carry distance. Falls back to all-shots carry for clubs that don't
have enough smart-strike data (labelled "FROM ALL SHOTS"). Adjacent clubs
whose smart-carries are within 5 yds of each other are flagged with a
"GAP ISSUE" warning — these are the clubs doing the same job in your bag,
worth investigating.

**04 · Cost of poor strikes** — per-club callout showing the gap between
Centred-only carry and All-shots carry, expressed as actionable improvement
potential ("+8.3 yds if you cleaned up your 7-iron strikes"). Clubs where
centred-strike data is too thin, or where centred carries happen to be
SHORTER than all (small-sample noise), are quietly filtered out — we don't
want to suggest poor strikes go further than good ones.

## Files modified

| File | What changed |
|---|---|
| `src/views/DistanceView.jsx` | **NEW** (370 lines) — four-card view as above |
| `src/App.jsx` | Imports DistanceView; adds `distance` to view router |
| `src/components/TopBar.jsx` | Adds Distance tab between Flight and Shape |

No changes to storage, parser, or other views.

## Verified against your data

Quick numbers from your current 22-shot dataset:

**7i (16 shots):**
- All shots: 133.8 yds avg carry
- Smart cohort: 141.0 yds — +7.2 yds vs honest baseline
- Centred only: 142.1 yds (3 shots)
- → Cost-of-poor-strikes callout: "+8.3 yds if you cleaned this up"

**50° wedge (6 shots):**
- No centred strikes yet in the data — Cost-of-poor-strikes correctly
  hides this club (insufficient data) rather than reporting noise
- Smart carry: 86.7 yds (3 shots)
- All carry: 87.8 yds — these are within 1 yd of each other because the
  "off" strikes happened to be longer than the "near" strikes in this
  small sample. The view handles this honestly without making up an
  improvement number.

**Gap ladder:** with just 7i and 50° loaded, you'd see two bars far apart
(54 yd gap) and no warnings. Once you log more clubs we'll get real gap
analysis.

## What's NOT in this PR (intentional)

- **Median instead of mean** — could be more robust to outliers but means
  the cohort definition is less powerful. Keeping mean for now; revisit if
  data ever looks noisy in practice.
- **Per-shot detail drill-in** — clicking a club row to see its individual
  shots in a strip plot. Nice to have, not urgent (the Shots view already
  surfaces individual shots).
- **Carry-vs-spin scatter** — a richer view of distance loss with high-spin
  shots. Could be useful for wedge work later.

## What's next

PR 5 — Shape view → Swing analysis upgrade (per-club swing fingerprint,
delivery consistency metrics).
