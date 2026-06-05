# Changes — Wedge benchmarks, heatmap clarity, column reordering (PR 4.19.4)

Three independent fixes from the backlog. Version bumped to **1.9.4**.

## 1. Degree-labelled wedges now have flight benchmarks

**The bug:** When you looked at flight analytics for your 50° wedge, the
optimal launch angle showed 16-20° — nowhere near right for a wedge.

**Root cause:** `benchmarks.js` had entries for `PW`, `GW`, `SW`, `LW`
but none for `50°`, `52°`, `54°`, `56°`, `58°`, `60°`. The
`getWindow(club)` helper falls back to `7i` when a club isn't found —
so every degree-labelled wedge was showing 7i benchmarks for every
metric (launch, spin, descent, peak height, AoA, etc).

**Fix:** Added entries for all six degree-labelled wedges with
interpolated benchmarks based on loft. A 50° sits between PW (~45°)
and GW (~52°); a 60° is roughly the LW equivalent. Numbers cover all
nine flight metrics, not just launch angle.

Confirmed PW (which you said was working) untouched.

| Club | Launch ideal |
|---|---|
| 50° | 26-32 |
| 52° | 28-34 |
| 54° | 30-36 |
| 56° | 32-38 |
| 58° | 34-40 |
| 60° | 36-42 |

## 2. Heatmap colour now obvious

**The bug:** The density heatmap in the Trends fingerprint cards used
neutral light fills, which made dense bins read as *lighter* against
the dark bar background — the opposite of intuition. You correctly
flagged this as confusing.

**Fix:** Bins now use the green accent (same colour as the today dot)
at varying alpha. Dense bins are saturated green; sparse bins fade
toward transparent. Also widened the alpha range (0.08 to 0.85) so the
contrast between busy and quiet bins is sharper. "More green = more
shots here" reads without thinking.

## 3. Column reordering in the Shots view

The backlog item from way back. You can now drag column headers in the
Shots view to reorder them per tab (Summary / Ball / Club). The new
order persists per-tab in localStorage.

**How it works:**
- Hover any column header → cursor changes to `grab`
- Drag the header onto another column → that column gets a green left
  border showing where the dropped one will land
- Drop → the columns reorder; the new order is saved automatically
- A "↺ RESET COLUMNS" button appears in the tab bar whenever the order
  has been customised. Click it to restore the default for the current
  tab.

**Exclusions:**
- The 'WHEN' column stays pinned first (not draggable)
- The 'CLUB' column stays pinned second (not draggable — it's special)
- All other columns in a tab are reorderable

**Persistence is per-tab.** Reordering Summary doesn't affect Ball
or Club. Each tab remembers its own order.

**Robustness:** if the default column set ever changes (e.g. we add a
new metric in a future PR), the saved order is invalidated and reset
to the new default rather than producing a broken layout.

## Files modified

| File | What changed |
|---|---|
| `src/data/benchmarks.js` | Added 6 degree-wedge entries (50° through 60°) |
| `src/views/TrendsView.jsx` | Heatmap alpha range widened, comment explaining green-accent choice |
| `src/views/ShotsView.jsx` | Drag-and-drop column reorder; per-tab persistence; reset button |
| `src/index.css` | Heatmap bin background changed to green |
| `package.json` | 1.9.3 → 1.9.4 |

## Apply

Branch: `feature/pr4-19-4-wedge-benchmarks-and-reorder`. Layers on top
of PR 4.19.3.

## What to test

1. **Wedge benchmarks**: Flight view → 50° → optimal launch should now
   show ~26-32° (or whatever your shots are doing relative to that)
2. **Heatmap clarity**: Trends → 7i → fingerprint cards → range bar
   should now have visible green saturation where shots cluster
3. **Column reorder**: Shots view → grab a column header (cursor
   becomes grab) → drag it to a new position → release. Refresh the
   page — order should persist. Switch tabs — each tab has its own
   order. Click "↺ RESET COLUMNS" if you want defaults back.

## Backlog still open

Nothing parked. We've cleared the backlog. Anything new comes from
testing or fresh ideas.
