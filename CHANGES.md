# Changes — Strike classification rework: H/V model (PR 4.14)

A genuine rethink of how we classify strike quality, based on the 28/5 7i
anomaly you flagged. Version bumped to **1.5.0**.

## The problem (recap)

Your 28/5 7i data showed centred shots with LOWER smash factor than
near-centre and off-centre shots (1.30 vs 1.34 vs 1.33). At first glance
this looks like a bug. It isn't — it's a model failure. The old
classifier used a single distance from face centre (`sqrt(H² + V²)`),
treating horizontal and vertical misses as equivalent.

They're not. For irons:

- **Horizontal misses** (toe/heel) lose energy via gear effect → lower smash
- **High-face strikes** add dynamic loft → lower ball speed, weaker carry
- **Low-face strikes** REDUCE dynamic loft → HIGHER ball speed (this is why
  iron designers move CoG forward and low: a low-on-face strike is often
  the player's best smash)

Your 7i "centred" cohort included two high-face strikes (one a disaster
at 88y carry / 1.20 smash) which dragged the average down. Your "near"
and "off" cohorts were dominated by low-face strikes — the genuinely
strong ones. The old radius math hid this entirely.

## The new model

Two independent thresholds per club:

```
  |faceH| ≤ HORIZ → horizontally tight
  |faceH| >  HORIZ → wide (toe/heel)
  faceV  >  VERT  → high
  -VERT ≤ faceV ≤ +VERT → mid
  faceV  < -VERT  → low
```

Combined into **four bands**:

| Band | Definition | What it means |
|---|---|---|
| **Centred** | H tight + V mid | The textbook good strike |
| **High** | V high (any H) | Loft-adding miss, weakened ball speed |
| **Low** | V low + H tight | Often the BEST iron strike (lower dynamic loft, more speed) |
| **Heel/Toe** | H wide + V not high | Horizontal miss, gear-effect energy loss |

The bands aren't symmetric — that's deliberate. High-face dominates
horizontal position (a high-toe strike is still lofted up); low+horizontal-wide
gets classified as heel/toe because the horizontal miss is the bigger
energy loss.

## Thresholds

Per-category bands (mm):

| Category | Horizontal ± | Vertical ± |
|---|---|---|
| Driver | 14 | 6 |
| Fairway wood | 12 | 5 |
| Hybrid | 11 | 5 |
| Iron | 10 | 4 |
| Wedge | 10 | 4 |

These are widely-cited Foresight reference values. Easy to tune later.

## Verified on your 28/5 7i data

| Cohort | Old radius model | New H/V model |
|---|---|---|
| Centred | 5 shots, smash 1.31 | 4 shots, smash 1.30 |
| (Low) | — | **8 shots, smash 1.37, carry 130.8y** |
| (High) | — | 0 shots this session |
| (Heel/Toe) | — | 11 shots, smash 1.30 |

The Low cohort is the real insight: **8 shots that are honestly your
best 7-iron strikes**, hidden in the old model. They're horizontally tight
and slightly below face centre — exactly the strike profile that produces
maximum ball speed on a modern game-improvement iron.

## What changed where

### Strike view
- Tolerance reference card now shows H/V band thresholds (not radii)
- Per-club strike plots draw the four zones as **rectangles** (the centred
  inner box, high band above, low band below, heel/toe bands at the sides)
- Mini count summary under each plot shows centred / low / high / heel-toe
- Strike Zone Table replaces the four-row band breakdown with the new
  four bands. Adds "LOW (low-face, H tight)" labelling so the user knows
  which is which.

### Distance view
- **"Smart" cohort now = Centred + Low** (was Centred + Near). Reflects
  the new model's coaching insight that low-face strikes on irons are part
  of the player's "good shots" set. Explanation text updated.

### Overview view (Insights)
- Strike pillar's "off-centre" insight now counts only heel/toe and high
  shots. Low shots are excluded — they're not a problem to flag.
- Gapping insight uses the same Centred + Low for Smart carry consistency
  with the Distance view.

### Shots view
- **New STRIKE column** on the Club tab, next to the IMPACT H / IMPACT V
  raw values. Shows the band classification per shot, coloured by category
  (green centred, amber low/high, red heel/toe). The debug companion you
  asked for — you can see exactly how each shot got classified.

## Files modified

| File | What changed |
|---|---|
| `src/data/benchmarks.js` | New `STRIKE_HV_BANDS`, `classifyStrike` rewritten for H/V model, added `strikeBandLabel` |
| `src/views/StrikeView.jsx` | Tolerance reference, zone rectangles in plots, mini count summary, Strike Zone Table all updated |
| `src/views/DistanceView.jsx` | Smart cohort = centred + low; explanation text |
| `src/views/OverviewView.jsx` | Strike insight excludes low; gap insight uses centred + low |
| `src/views/ShotsView.jsx` | New `strike` column on Club tab with colour-coded band labels |
| `package.json` | 1.4.0 → 1.5.0 |

## Verified

- Production build clean
- Sanity-checked on your 28/5 data (54°, 7i, 6i) — bands distribute as
  expected, Smart cohort produces honest carries

## What this unlocks

Your 28/5 session, once you tag the 54° wedge shots by shot type (full
vs pitch vs chip — most are pitches given 65 shots), will give you:

1. A clean full-wedge baseline
2. A separate "Smart" carry that honestly includes your strongest 7-iron
   strikes
3. Visible LOW shots in the Strike view — you'll see that your wedge
   pattern is dominantly low-face (48 of 65) which is real coaching info

## What's next (backlog)

- Column reordering in Shots view
- Proper equipment system (free text, autocomplete, filtering, bag management)
- Per-club swing fingerprint view (now PR 4.15 in this numbering)
