# Changes — Strike view polish (PR 1.2)

Followup to PR 1.1, tightening the strike view based on user feedback:

## 1. Dropped redundant columns

The Tolerance Reference table had `IDEAL RADIUS` and `MISS >` columns:

- `IDEAL RADIUS` was always identical to `CENTRED ≤` — two names for the same number. Confusing.
- `MISS >` was always identical to `OFF ≤` — "miss" simply means "beyond the off boundary". Adds no information.

Both columns dropped. Three columns remain: Centred / Near / Off — what they actually represent.

## 2. Renamed `pctOfIdeal` to `pctOfCentred`

In the strike-tooltip code and underlying data layer. The new label is "% of centred zone", which maps directly to the green band the user can see in the plot. Removes the awkward "% of ideal" phrase that didn't refer to anything visible.

## 3. Consistency zone (dashed dispersion ellipse) is now labelled

The dashed blue ellipse that's been drawn around each club's strike centroid is a 1σ dispersion — meaning roughly 68% of shots fall inside it. Until now, nothing on the screen told you this. Added a small caption beneath each per-club plot:

> DASHED OUTLINE = CONSISTENCY ZONE · ~68% OF SHOTS · σ 4.2mm

The σ number is the combined standard deviation (√(σH² + σV²)) so users get a single tightness metric they can track over time.

## 4. New CONSISTENCY column in the strike summary table

Each band (centred/near/off/miss) now has a `± σ` figure showing the spread of shots within that band. Useful because:

- **Tight σ on centred** = pure strikes group repeatably. Good.
- **Loose σ on centred** = centred but jittery; means the centred classification is doing some work for you (you're scraping in).
- **Tight σ on off** = consistent miss pattern (e.g. always toe-high). Highly fixable.
- **Loose σ on off** = random spray. Harder to fix; usually a tempo or fundamental issue.

Only displayed when the band has ≥3 shots (statistically meaningful threshold).

## Files modified

| File | What changed |
|---|---|
| `src/views/StrikeView.jsx` | Dropped redundant table columns, renamed tooltip metric, added consistency caption + table column |
| `src/data/benchmarks.js` | Removed `idealRadius` field, renamed `pctOfIdeal` to `pctOfCentred` |

## What's next

PR 2 (already in flight) will land:
- Time-period filter in FilterBar
- Editable Shots view
- Dedupe key change (drop club)
- Click-a-session-to-filter
