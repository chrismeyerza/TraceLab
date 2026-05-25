# Changes — Strike view tightened up (PR 1.1)

Small but high-value follow-up to PR 1, addressing four pieces of feedback:

## 1. Reordered Strike view

The summary table now leads. The previous order put the heatmap and plots first; the summary lived at the bottom. But the summary is the densest, most actionable thing on the page — putting it first means the answer arrives before the visuals.

New order:
1. **Tolerance reference** (the legend)
2. **Strike summary** (the answer — % of shots in each band + ball-speed cost)
3. **Per-club strike pattern** (the visuals)

## 2. Dropped the master heatmap

The "all clubs mashed into a single SVG, coloured by ball speed" view was redundant. The per-club plots, combined with the FilterBar (which already lets you pick any combination of clubs), cover the same ground with strictly more information — separated by club so club-specific patterns are visible.

Result: less visual clutter, smaller bundle, simpler view.

## 3. Beefed-up zone visualisation in the per-club plots

The tolerance bands are now solid pale fills, not thin rings:

- **Green wash** — centred zone
- **Amber wash** — near-centre annulus
- **Red wash** — off-centre annulus
- **No fill outside red** — miss territory, emphasised by absence

Each band has a small label (`CENTRED`, `NEAR`, `OFF`) at its top edge so the colour-to-meaning mapping is unambiguous on first viewing. After a few sessions you'd read the colours directly; the labels earn their place for the learning curve.

The opacity is deliberately muted: zones are context, dots are data. The dots remain the visual focus.

## 4. Table header alignment

Tables now have right-aligned headers for numeric columns. The previous CSS right-aligned numeric *data* cells but always left-aligned *header* cells, so the header text didn't sit above its column.

Fixed at the CSS level by adding `.data-table th.num` selector, then applying `className="num"` to numeric headers in StrikeView and ShapeView tables.

## Files modified

| File | What changed |
|---|---|
| `src/views/StrikeView.jsx` | Reordered sections, removed StrikePlot function, beefed up zones in SinglePlot, added zone labels, right-aligned numeric headers |
| `src/views/ShapeView.jsx` | Right-aligned numeric headers in Face-and-Path table |
| `src/index.css` | New rule `.data-table th.num { text-align: right }` |

## Testing

Production build clean: 49 modules, 176KB gzipped (slightly smaller than before — removed the master heatmap component).

Zone label positioning verified for all club categories (iron, wedge, driver). All labels fit within the SVG viewBox.

## What's still coming in PR 2

- Time-period filter in FilterBar
- Shots view with editable rows for relabelling
- Dedupe key drops `club` (so relabels survive re-imports)
- Bulk relabel on Sessions view
- Click-a-session-to-filter from Sessions view
