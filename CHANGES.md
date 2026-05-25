# Changes — Rebrand to TraceLab + strike tolerance context + stable session IDs

This is PR 1 of two. Next PR will add the time-period filter, editable shot relabelling, and the dedupe-key change.

## Summary

Three product changes plus a brand refresh:

1. **Rebrand to TraceLab.** Brand name, page title, package name, GitHub Pages base path. Internal references to "Foresight" remain where they describe the *input data format* (the parser still parses Foresight files; the dropzone still says "Drop your Foresight export") — those are accurate and shouldn't change.

2. **Sessions becomes the first menu item** and the default landing view. Reflects that "what's in my data" is the natural first question when you open the app.

3. **Strike tolerance with context.** Strike location numbers like "10mm toe" now have meaning. Three pieces:
   - **A tolerance reference card** at the top of Strike view explaining the centred / near / off / miss thresholds per club category (driver/wood/hybrid/iron/wedge).
   - **Per-club tolerance rings** drawn on each Per-Club strike plot in green / amber / red, plus a count of how many shots fell in each band beneath each plot.
   - **Rewrite of the strike zone table** to use per-club tolerance bands instead of flat 5/10/15mm thresholds. Speed-loss comparison is now per-club ("vs your centred 7-iron speed", not "vs all centred shots regardless of club").

4. **Stable session IDs.** Session IDs are now derived from the earliest shot's timestamp (`S-20260520-1745`), not the import time. The same physical session imported twice gets the same ID. IDs sort chronologically, are human-readable, and don't depend on the random number generator.

## Files modified

| File | What changed |
|---|---|
| `package.json` | Name `foresight-analytics` → `tracelab`; version 1.1.0 → 1.2.0; description tightened |
| `index.html` | Page title → `TraceLab` |
| `vite.config.js` | GitHub Pages base path → `/TraceLab/` (matches repo name) |
| `src/components/TopBar.jsx` | Brand text → TraceLab; tabs reordered with Sessions first |
| `src/App.jsx` | Default view → `sessions` |
| `src/lib/parser.js` | Session ID derived from earliest shot timestamp, stable across re-imports |
| `src/data/benchmarks.js` | New `STRIKE_BANDS` table; `classifyStrike()` and `getStrikeBands()` helpers |
| `src/views/StrikeView.jsx` | New ToleranceReference card; tolerance rings in SinglePlot; rewritten StrikeZoneTable using per-club bands |

## Strike tolerance bands — values & rationale

| Club category | Centred ≤ | Near ≤ | Off ≤ | Ideal radius |
|---|---|---|---|---|
| Driver | 12 mm | 22 mm | 35 mm | 12 mm |
| Fairway woods | 10 mm | 18 mm | 28 mm | 10 mm |
| Hybrids | 9 mm | 16 mm | 25 mm | 9 mm |
| Irons | 8 mm | 15 mm | 25 mm | 8 mm |
| Wedges | 8 mm | 14 mm | 22 mm | 8 mm |

Centred-zone radii reflect the published sweet-zone size for typical equipment — drivers have larger sweet spots due to face area, MOI design, and trampoline effect; irons and wedges have small, demanding sweet zones. The bands then extend roughly proportionally to "what would still be considered a recoverable strike" by a typical fitter/coach. These are conservative-but-reasonable values; we can adjust if your own data suggests different (e.g. modern hollow-body irons have larger effective sweet zones than blades).

The "% of ideal" metric in tooltips compares distance-from-centre to the **ideal radius** (not the face size). So 12mm on a 7-iron tooltip shows "150% of ideal" — meaning you were 50% beyond the centred-zone boundary. This matches how coaches actually talk about strike quality.

## Stable session IDs — what changed

**Before:**
```js
sessionId = `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
// → "S-1747938291234-456"  (when imported)
```

**After:**
```js
// Derived from the earliest shot's timestamp after parse
sessionId = `S-YYYYMMDD-HHMM`;
// → "S-20260520-1745"  (when the session was actually played)
```

Benefits:
- Same physical session imported twice → same ID, no double-counting
- IDs sort chronologically
- Human-meaningful in URLs and logs
- Collision risk is "two separate sessions starting in the exact same minute" — not a real-world concern

## What's not changed (deliberately)

- **Dedupe key still includes club.** The user has identified this as a problem (shots get a different dedup key after relabelling, so re-imports treat them as new shots) but the fix lives in PR 2 alongside the editable Shots view. Doing them together avoids a confusing intermediate state.
- **Time-period filter not added.** Coming in PR 2.
- **Master strike heatmap doesn't show tolerance rings.** Shots in the heatmap span all clubs; a single ring would be misleading. The per-club plots are where tolerance context belongs.

## Testing

- Production build clean: 49 modules, 177KB gzipped, no warnings beyond the existing xlsx chunk-size note.
- Strike classification unit-tested for: irons, drivers (wider tolerance), wedges (numeric loft names like `50°`), null inputs (FLT_MAX case).
- Session ID derivation verified: same physical session re-imported gives identical ID, IDs format correctly, all shots in a session share the ID.
- Existing parser tests still pass.

## What to look at first

Drop a CSV in, then go to **Strike**. You should immediately see:

1. The tolerance reference card — does it make the bands feel intuitive?
2. The per-club plots now have three rings (green/amber/red) around centre, with a count of centred/near/off shots underneath. Does the visualization land?
3. The zone table now has CENTRED / NEAR CENTRE / OFF CENTRE / MISS rows with an "avg distance from centre" column.

If something looks off or the values feel wrong for your skill level, tell me — these thresholds are calibrated to "typical accomplished amateur" and we can shift the goalposts.
