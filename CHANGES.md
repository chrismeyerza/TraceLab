# Changes — CSV import + derived metrics

## Summary

This change brings two things together:

1. **CSV support.** FSX Play exports natively as `.csv`. The previous parser only accepted `.xlsx` workbooks. The new parser handles both formats — drop in a raw FSX Play CSV download and it Just Works. Existing `.xlsx` flows are unchanged.

2. **Derived metrics.** Five new fields are computed at parse time from the 26 columns FSX Play already gives us. No need to wait for Foresight to expose them in the export.

## Files modified

| File | What changed |
|---|---|
| `src/lib/parser.js` | New CSV parser; new derivations; cascading-zero detection |
| `src/components/EmptyState.jsx` | File picker accepts `.csv` |
| `src/views/SessionsView.jsx` | File picker accepts `.csv` |
| `src/App.jsx` | Reads CSV files as text, XLSX as ArrayBuffer |

No changes to data storage, components beyond file pickers, or the views themselves. The new derived fields are available on every shot object but no view consumes them yet — that comes in the next change, where we'll rework the Shape view to lead with Face to Path.

## The derivations

All five are computed at parse time and stored on the shot record so downstream code can read them like any other field.

| Field | Formula | Notes |
|---|---|---|
| `faceToPath` | `faceToTarget − clubPath` | Sign convention: positive = open-to-path (fade-biased for RH), negative = closed-to-path (draw-biased for RH). |
| `spinLoft` | `loft − angleOfAttack` | Master variable for spin generation. Typical: driver 10–15°, mid-iron 20–25°, wedges 35–50°. |
| `spinAxis` | `atan2(sideSpin, backSpin) × 180/π` | Tilt of the spin axis in degrees. Positive = tilted right (fade), negative = tilted left (draw). |
| `runDistance` | `totalDist − carry` | Yards of roll after the ball lands. |
| `curvature` | `offline − carry × tan(pushPull)` | Lateral deviation of the ball from its initial start line, isolating curve from start direction. Approximation that assumes a straight initial trajectory; fine for analysis. |

Every derivation guards against null inputs. If any input is missing, the derived field is `null`, never `0` or `NaN`.

## How the parser handles partial shots

Foresight occasionally captures ball flight without capturing the club (the unit's cameras see the ball but miss the club at impact). When this happens, the export looks like:

- **Ball flight columns** — real values (ball speed, carry, spin, launch angle, etc.)
- **Club Speed column** — `3.4028e+38` (IEEE 754 single-precision FLT_MAX), Foresight's "no data" sentinel
- **All other club-impact columns** — literal `0` as cascading placeholders (AoA, Club Path, Face to Target, Lie, Loft, Face Impact H/V, Closure Rate, Efficiency)

The parser detects this pattern via the FLT_MAX → null conversion in `num()`, then nulls out the entire suite of club-dependent fields rather than trusting the cascading zeros. This is critical for data integrity: a zero Face-to-Target value would average in as "perfectly square" — wrong; a null explicitly tells downstream stats to skip the shot.

**Net effect**: partial shots are kept (ball-flight statistics get the benefit of the real ball data) but contribute nothing to club-impact statistics. Strike heatmaps, Shape analysis, Face to Path averages all skip them automatically.

## How the parser handles numeric club names

FSX Play sometimes stores the club's loft as the name (`"50"` for a 50° wedge) with the category in Club Type (`"Wedge"`). The parser detects purely numeric names and converts them to a degree-suffixed string (`"50°"`) so they sort and display sensibly. Mixed alphabetic names (`"7i"`, `"PW"`) continue to flow through the existing alias table.

## How the new CSV parser works

A small (~50-line) custom CSV parser, not a library. FSX Play CSVs are well-formed and a dependency wasn't worth ~50KB of bundle size for a single-format reader.

Handles:
- UTF-8 BOM stripping (the FSX Play CSV starts with one)
- CRLF and LF line endings
- Quoted fields with embedded commas and escaped quotes (`""` → `"`)
- The American `MM/DD/YYYY HH:MM:SS` timestamp format

The parser's entry point — `parseForesightFile(input, fileName)` — accepts either an ArrayBuffer (xlsx) or a string (csv). The caller in `App.jsx` decides which based on file extension. XLSX path is unchanged from before.

## Testing

Verified end-to-end against `session_09bb6ed1...csv` (22 shots, 6 × 50° wedge, 16 × 7i):

- All 22 shots parsed correctly
- Shot 1 (the FLT_MAX row): ball-flight data preserved, all 8 club-impact fields correctly nulled
- Clean shots: all derivations match hand-calculation
- 7i shot Face to Path = -7.7° (closed to path = draw signal), Spin Axis = -17° (left tilt = draw curve), Curvature = -20.5 yds (significant left curve) — internally consistent

Production build clean: 49 modules, 175 KB gzipped, no warnings beyond the existing xlsx chunk-size note.

## What's next

Once this is merged, the Shape view rework comes next: promote Face to Path to the headline number, demote Face-to-Target and Club Path to supporting columns. The Overview "auto-insights" can also start using Spin Axis for shape descriptions.
