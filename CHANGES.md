# Changes — Path labelling + pillared Insights (PR 4.5)

Two changes bundled because both touch Overview/Shape areas.

## 1. Path values now show I-O / O-I direction tags

Foresight FSX Play labels Club Path with a directional tag: I-O (in-to-out)
or O-I (out-to-in). The numeric value alone is opaque without that tag —
"+2.1°" is meaningless to a casual reader, "+2.1° I-O" tells you it's an
inside-out swing.

Applied in three places:
- Shape view · Face & Path table (the one you flagged)
- Shape view · Face-vs-Path scatter tooltip
- Shots view · Club tab · PATH column

A shared `formatPath()` helper now lives in `lib/shape.js` so all three call
the same code. Rules:
- `> +0.5°` → `+N.N° I-O` (inside-out, draw-promoting)
- `< -0.5°` → `−N.N° O-I` (out-to-in, fade-promoting)
- Within ±0.5° → `+N.N° SQ` (effectively square)

## 2. Insights restructured into five analytical pillars

The old Insights card was overwhelmingly strike-focused — four of five rule
families targeted strike location, which meant a single problematic club
could generate three or four redundant "your strike is off" insights and
crowd out genuinely different concerns from other parts of the game.

New structure: insights now live under five pillars, each rendered as its
own labelled section within the Insights card.

| Pillar | What it covers | Rules |
|---|---|---|
| **Strike** | Where you hit the face | Strike quality summary (off-centre %, directional bias, speed cost) |
| **Flight** | Launch, spin, descent | Launch high/low, Spin high/low, Descent shallow (irons/wedges only) |
| **Distance** | Carry & gapping | Strike-quality cost per club, adjacent-club gap problems |
| **Shape** | Path, face, curve | Dominant shape, per-club path bias, per-club face-to-path |
| **Consistency** | Repeatability | Carry dispersion (CV), club-path variability |

Each pillar capped at 3 insights so no pillar dominates. Within a pillar,
ordering is `bad` → `warn` → info-level so the worst issues surface first.

Visual: each pillar gets a section header in its accent colour (red for
Strike, amber for Flight, green for Distance, blue for Shape, purple for
Consistency) with a thin underline. Easy to skim, easy to scan to the
pillar you care about.

## Other improvements baked in

**Consolidated strike rule.** The old four rules (strike cost, horizontal
bias, vertical bias, smash factor) all fired on the same underlying problem.
Consolidated into a single per-club "strike quality" rule that combines
off-centre %, directional bias, and carry cost into one richer insight.
Result: each club generates one strike insight at most, not four.

**Honest about insufficient data.** Every rule requires `MIN_SHOTS_PER_CLUB`
(5) shots minimum before firing. Avoids the "we made up an insight from
3 shots of noise" failure mode.

**Per-rule guardrails.** Some rules need extra context — e.g. Descent
Shallow only fires for irons/wedges (drivers and woods are *meant* to descend
shallow). Spin-loft considerations baked into the flight pillar.

## What you'll see on YOUR data right now

Running PR 4.5 against your current 22-shot dataset, expect insights like:

**Strike pillar:**
- `7i · Strike quality` — % off-centre + speed cost + 8.3 yd carry loss

**Flight pillar:**
- `50° · Launch high` (24° vs 16-20° optimal — ballooning)
- `7i · Spin low` (4,500 rpm vs 6,500-7,500 — shallow/de-lofted delivery)
- `7i · Descent shallow` (32.5° vs 42-48° — won't hold green)
- `50° · Descent shallow` (36.5° vs 42-48°)

**Distance pillar:**
- `7i · Strike-quality cost` (+8.3 yds available if you cleaned up strikes)

**Shape pillar:**
- `7i · Face-to-Path` (−3.8° — strong closed-to-path delivery = draw bias)

**Consistency pillar:**
- `7i · Carry inconsistency` (CV 10%)
- `50° · Carry inconsistency` (CV 11%)

That's 8-10 distinct insights across the full game, vs the ~3-4 strike-
heavy ones you were getting before. Much more useful for figuring out where
to spend your practice time.

## Files modified

| File | What changed |
|---|---|
| `src/lib/shape.js` | New `formatPath()` helper |
| `src/views/ShapeView.jsx` | Use `formatPath` in Face & Path table + tooltip |
| `src/views/ShotsView.jsx` | Use `formatPath` in PATH column |
| `src/views/OverviewView.jsx` | Insights function fully rewritten with pillar structure + new rule families |

## What's NOT changed

- Storage / parser / FilterBar / Distance view / Strike view unchanged
- Per-club averages table in Overview unchanged

## What's next

Originally planned PR 5 was the Shape view upgrade (per-club swing
fingerprint). With the pillared Insights now covering shape decently at
Overview level, the Shape view rework is less urgent — happy to defer or
proceed, your call.
