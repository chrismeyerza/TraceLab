# Changes — Equipment by category + filter consistency (PR 4.16)

Two changes bundled because both touch the Shots view + filter behaviour.
Version bumped to **1.7.0**.

## 1. Equipment list restructured by club category

The old equipment list was irons-only — 8 brands × ~4 iron models each.
That left drivers, woods, hybrids, and wedges with no representation.

Now the list is organised by **club category**:

| Category | Brands | Notes |
|---|---|---|
| Driver | Callaway, TaylorMade, Titleist, Ping, Cobra, Mizuno | Callaway Rogue ST line + Paradym + Ai Smoke; etc |
| Wood (fairway) | Same 5-6 brands | Most overlap with driver lineups |
| Hybrid | Callaway, TaylorMade, Titleist, Ping, Cobra, Mizuno | |
| Iron | Titleist (T100/T150/T250/T350), Ping, Mizuno, Callaway, TaylorMade, Srixon, Cobra, Wilson | Existing list preserved |
| Wedge | **Vokey** (SM10/SM9/SM8), Cleveland, Callaway, TaylorMade, Mizuno, Ping | Vokey is its own brand here even though it's Titleist's sub-brand — that matches how players think about wedges |

**83 equipment options** across all categories (was 37 irons-only).

## 2. Picker is now category-aware

When you click EQUIP on a 54° wedge, the picker shows **wedge brands**
(Vokey, Cleveland, Callaway, TaylorMade, Mizuno, Ping). When you click
on a Driver, it shows **driver brands** (Callaway, TaylorMade, Titleist,
Ping, Cobra, Mizuno). You can't accidentally tag a wedge as "Callaway
Rogue ST" — Rogue ST simply doesn't appear when you're tagging wedges.

A small subtitle in the picker confirms what's being shown:
`"Set equipment: · Wedge equipment"` — so the filtering is visible, not
silent.

### Bulk tagging respects categories too

If you select shots that span multiple club categories (e.g. some
wedges and some irons) and click "Set equipment", the picker refuses:

> Can't bulk-tag mixed equipment categories
>
> Selected shots span multiple club categories (wedge, iron). Equipment
> tags are category-specific — pick shots from one category at a time.

Pick shots from one category, bulk-tag them, repeat for the next.

## 3. Shots view now respects ALL filters

Previously the Shots view had a separate `shotsForEditing` memo that
deliberately bypassed the shot-type filter, because reclassifying a
shot's type made it vanish (the type filter was invisible at the time,
so the disappearance looked like a silent edit failure).

Now that the TYPES row is always visible and reachable from any view,
that defence is no longer needed. The user can see exactly what's
filtering their list and adjust the filter directly. So the Shots view
uses the same `filteredShots` as analysis views.

**Practical effect:** filtering by Type=Pitch in the Shots view now
narrows the list to only your pitch shots. You can scope to "7i pitches
tagged Windy" and see exactly those shots for editing.

## Files modified

| File | What changed |
|---|---|
| `src/data/equipment.js` | Restructured into category-keyed `EQUIPMENT_BY_CATEGORY`; added `getBrandsForCategory()`; legacy `EQUIPMENT_BRANDS` preserved as fallback union of all categories |
| `src/data/benchmarks.js` | Exported `clubCategory()` so other modules can resolve a club → category |
| `src/views/ShotsView.jsx` | EquipmentPicker accepts `category` prop and filters brands; inline picker uses the shot's club; bulk picker computes shared category from selected shots and refuses if mixed |
| `src/App.jsx` | Removed `shotsForEditing` memo; Shots view uses `filteredShots` |
| `package.json` | 1.6.1 → 1.7.0 |

## Verified

- Production build clean
- Equipment data smoke-tested: 83 options across 5 categories; isKnownEquipment
  correctly accepts Vokey SM10 / Callaway Rogue ST / Titleist T150;
  getBrandsForCategory returns the right list per category

## Apply

Branch: `feature/pr4-16-equipment-categories-and-shots-filtering`
Layers on top of PR 4.15.1.

## What to test

1. Apply, restart
2. Tag your 54° → click EQUIP → should show Vokey, Cleveland, Callaway,
   TaylorMade, Mizuno, Ping (no Titleist T100 etc — those are irons)
3. Tag your Driver → click EQUIP → should show Callaway with Rogue ST /
   Rogue ST Max / Paradym / Paradym Ai Smoke
4. In Shots view, filter Type=Pitch → list should narrow to pitch shots
   only (no more bypass)
5. Reclassify a Full shot to Pitch — it should now correctly hide from
   the Type=Full filter, but you can switch to Type=Pitch to see it

## Backlog

- Proper equipment system (free text, autocomplete, user-managed bags) —
  this PR makes the curated list serviceable for the whole bag but doesn't
  remove the "must pick from a list" constraint
- Column reordering in Shots view
- Per-club swing fingerprint view
