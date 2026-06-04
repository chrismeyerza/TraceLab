# Changes — Trends chart improvements (PR 4.19.2)

Five fixes to the Trends drift charts, all responding to issues you
flagged while testing. Version bumped to **1.9.2**.

## 1. Moving average replaces linear regression

The dashed line is now a **trailing moving average**, not a linear
regression. Adaptive window:

- ≤ 5 sessions → window of 2
- ≤ 10 sessions → window of 3
- > 10 sessions → window of 5

Better at capturing real shape — "improved then plateaued" looks like
that, instead of being averaged into a moderate slope.

## 2. Inline label tells you what the dashed line is

Top-right of each chart, in tiny text: `3-sess avg` (or whatever window
applies). So the dashed line is no longer mystery — you can see at a
glance what it represents.

## 3. X-axis date labels

Bottom-left and bottom-right corners show actual dates, e.g.
`16 Oct` ... `03 Jun`. Direction (oldest → newest, left → right) is now
explicit instead of implied.

## 4. Y-axis range labels

Top-left of the chart shows the max value, bottom-left shows the min.
So "the chart spans 77 to 81" becomes immediately readable, which solves
the "small change actually matters" issue — when you see the chart goes
from 77.8 at the bottom to 81.1 at the top, +3.3 mph reads as
genuinely meaningful, not as a small visual movement.

## 5. All 9 mini-charts aligned on the same x-axis

This is the big one for cross-metric pattern reading. All 9 charts now
share the SAME x-axis range — the union of all sessions where you have
any data for the selected club. So session N's dot is at the same
horizontal pixel position no matter which metric you're looking at.

Practical effect: scan vertically across the grid and you can see
"session 4 was when everything jumped." Club speed up, ball speed up,
carry up — the cross-metric story reads visually because the dots
align by date column.

This is what makes the Trends view answer "did this matter?" without
having to compute downstream effects: if club speed went up AND ball
speed went up AND carry went up in the same session, the answer is
visibly yes.

## Files modified

| File | What changed |
|---|---|
| `src/lib/trends.js` | New `movingAverage()` with adaptive window |
| `src/views/TrendsView.jsx` | Computes global x-axis range across all metrics; DriftChart uses global range; renders date labels (bottom corners), y-range labels (top-left and bottom-left), and `N-sess avg` line label; moving-average path replaces regression line |
| `package.json` | 1.9.1 → 1.9.2 |

## Apply

Branch: `feature/pr4-19-2-trends-axis-labels-and-ma`. Layers on top of
PR 4.19.1.

## What to test

1. Open Trends → pick 7i → look at the drift charts
2. Date labels: bottom-left and bottom-right should show real dates
3. Range labels: top-left = max value, bottom-left = min value
4. Trend line: dashed grey line, with a small `3-sess avg` label at the
   top-right
5. Vertical scanning: pick a session position in the X axis (say, the
   leftmost dot). Trace down through all 9 charts. The dot for that
   session should be at the same horizontal position in every chart
   that has data for it.
6. Test with a couple of different clubs to make sure alignment works
   when the selected club changes

## Backlog still pending

- Heatmap colour-coding clarity (darker = more shots — make it obvious)
- Column reordering in Shots view
- Anything else you flag from testing
