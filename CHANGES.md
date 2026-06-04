# Changes — WHEN filter applies to Trends (PR 4.19.3)

Single-purpose fix. The WHEN row in the filter bar (All time / Last
session / Last 30 days / Last 90 days) now affects the Trends view.
Version bumped to **1.9.3**.

## Before

WHEN did nothing in Trends. Both sections used your full all-time
history regardless of what WHEN was set to.

## After

- **Today vs baseline cards** — baseline is computed from shots inside
  the WHEN window. "Last 30 days" means today vs your last-30-days
  baseline.
- **Drift charts** — only show sessions inside the WHEN window. "Last
  90 days" zooms the chart to the last 90 days.

The pin still works orthogonally — pin a session to use it as "today,"
WHEN scopes the baseline and drift.

Other filters (CLUBS, TYPES, EQUIPMENT, TAGS) also apply to Trends now
for the same reasons — they're explicit user choices. Pin is the only
filter Trends ignores (it's not a narrowing intent, it's a "today
reference" intent).

## Implementation note

Done by adding a second derived shot set in App.jsx, `unpinnedFilteredShots`,
which has the same filters as `filteredShots` minus the pin. Trends
receives that as its data source. Trivially small change.

## Files modified

| File | What changed |
|---|---|
| `src/App.jsx` | New `unpinnedFilteredShots` memo; passed to TrendsView as `allShots` |
| `package.json` | 1.9.2 → 1.9.3 |

## Apply

Branch: `feature/pr4-19-3-when-applies-to-trends`. Layers on top of
PR 4.19.2.

## What to test

1. Open Trends → leave WHEN at "All time" → drift charts look the same
   as they did before this PR
2. Set WHEN to "Last 30 days" → drift charts narrow to last-30-day
   sessions; fingerprint baselines reflect a smaller window
3. Set WHEN to "Last 90 days" → wider window
4. Pin a session and toggle WHEN — pin stays as "today," WHEN scopes
   the rest. The pinned session card data should still appear even if
   the session is at the edge of (or just outside) the WHEN window —
   the pin lookup goes through `unpinnedFilteredShots` which respects
   WHEN, so if you pin a session and then set WHEN to exclude it, the
   pinned values will show empty. That's correct behaviour but worth
   knowing.

## Backlog still pending

- Heatmap colour-coding clarity (darker = more shots — make it obvious)
- Column reordering in Shots view
