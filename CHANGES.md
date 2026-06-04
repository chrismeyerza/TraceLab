# Changes — Equipment-as-bag-property (PR 4.18)

The big conceptual change we discussed. Equipment is no longer a per-shot
field you edit. It's a property of which club hit the shot, configured
once per user in Settings as your "bag." Version bumped to **1.8.0**.

## The new model

**Your bag** lives in Settings → Bag. It maps each club to its equipment:

```
Dr   → Callaway Rogue ST
3w   → Callaway Paradym
7i   → Ping i230
54°  → Vokey SM11
```

**On import**, each new shot gets its equipment stamped from your current
bag at that moment. If the club isn't in your bag, equipment stays null.

**On club reassignment**, equipment auto-follows. Reassigning a shot from
7i → 8i updates its equipment to your 8i bag entry (or null if 8i isn't
in the bag).

**Equipment is a snapshot.** Changing your bag tomorrow does NOT
retroactively update old shots. Old shots keep whatever equipment was
stamped at the time. This is what lets you compare old gear vs new gear
via the equipment filter — both values exist in your data as historical
truth.

## What's gone

The per-shot equipment editing in the Shots view is removed:

- **No more inline EQUIP picker** — the column is read-only now
- **No more "Set equipment" bulk action** — removed from the action bar

The EQUIP column still shows you what each shot was stamped with — useful
for verification, and the equipment filter still works as before.

## Migration on first 1.8.0 boot

Your existing equipment tags don't get lost. When you load the app for
the first time on 1.8.0:

1. For each user, your bag is **seeded from your existing shot data** —
   for each club, whichever equipment value appears most often becomes
   the bag entry. So if 9 out of 10 of your 7i shots are tagged "Ping
   i230", your bag's 7i → Ping i230.
2. **Existing shots keep their stamped values** — nothing changes in
   the database. The bag is a new layer on top.
3. **No prompts, no popups** — it just works.

The seeding is idempotent (won't overwrite a bag entry you set yourself
afterwards) and only runs once per user via a localStorage flag.

## Where to find it

**Settings → Bag.** The gear icon in the top bar → scroll to the new
"Bag" section. Lists your clubs (only ones you have shots for) with
their equipment. Click any equipment value to change it; the picker is
category-aware (a wedge row only shows wedge brands, etc).

**Add club to bag** — for clubs you haven't hit yet but want to
pre-populate. Useful before importing data for a club for the first
time, so the import gets the equipment stamp right.

## Edge cases handled

### "I imported a club that wasn't in my bag"

Those shots have equipment = null (since the bag had nothing to say).
Bag panel shows them as "missing equipment":

```
Settings → Bag

⚠ 12 shots have no equipment tagged but their club is now in your bag.

[ Fill missing equipment from bag ]
```

After you add the new club to your bag, one click backfills the missing
equipment on the shots. Only NULL equipment fields are filled — shots
already tagged stay as-is (snapshot integrity preserved).

### "I want to compare new irons to old irons"

Buy new irons → update your bag (`7i → Ping i230` instead of `Ping i530`).
Import future sessions. Old shots stay tagged `Ping i530`, new shots
get tagged `Ping i230`. Both values appear as chips in the EQUIPMENT
filter row — click either to compare.

### "I want to track a demo session"

Use **free-form tags**, not equipment. Tag the shots `demo: ping G740`
or whatever. Your bag stays correct; the demo shots are searchable via
the TAGS filter row. Don't put demos in your bag.

### "I reassigned a club to one not in my bag"

The shot's equipment is set to null (the bag is authoritative). To
re-stamp it: add the new club to your bag, then run "Fill missing
equipment from bag."

## Files modified

| File | What changed |
|---|---|
| `src/lib/bag.js` | **NEW** — getBag, setBag, setBagEntry, getBagEntry, deleteBag, seedBagFromShots, stampEquipmentFromBag |
| `src/components/BagPanel.jsx` | **NEW** — per-user bag editor: club rows, category-aware inline picker, add-club affordance, fill-missing escape hatch |
| `src/components/SettingsPanel.jsx` | Renders BagPanel for the active user; accepts new bag-related props |
| `src/views/ShotsView.jsx` | Inline EQUIP picker removed; bulk "Set equipment" action and panel removed; editingEquip and bulkEquipOpen state removed; equipment cell falls through to default read-only rendering |
| `src/App.jsx` | Bag state + derivations (activeBag, activeUserClubs, standardClubLabels, missingEquipmentCount); stamping in commitImport; club-reassign auto-fill via augmentPatchWithBagEquipment; bag seeding migration on boot (per-user, idempotent); handleSetBagEntry, handleFillMissingEquipment handlers; deleteBag called when a user is deleted |
| `src/index.css` | Bag panel styles |
| `package.json` | 1.7.2 → 1.8.0 (minor bump — new conceptual feature) |

## Verified

- Production build clean
- Bag library smoke-tested:
  - Empty bag, get/set/clear entries
  - Majority-wins seeding from shots (tie-broken alphabetically)
  - Existing bag entries preserved during seed
  - Stamping fills empty equipment when bag has entry, leaves alone when not

## What this does NOT change

- **Equipment filter** still works exactly as before — narrows shots by
  equipment value
- **Existing shots** are not touched; your historical data is intact
- **Tags** unchanged — they remain the right tool for demos, conditions,
  ad-hoc context
- **All analysis views** (Strike, Distance, Flight, Shape, Overview)
  unchanged — they use the equipment field same as before

## Apply

Branch: `feature/pr4-18-bag-as-property`. Layers on top of PR 4.17.2.

## What to test

1. Apply, restart, navigate to Settings → see your bag has been
   auto-seeded from your existing data. Each club should show its
   most-common equipment value.
2. Try editing a bag entry — change 7i → something different. Save.
   Go back to Shots view. Your existing 7i shots should still show the
   OLD value (snapshot preserved).
3. Import a new session for that club (if you have one to test with).
   The new shots should get tagged with the NEW bag value.
4. Try reassigning a shot's club from 7i → 8i. Equipment should auto-
   update to your 8i bag entry.
5. Try the Shots view EQUIP column — should be display-only (no click
   handler).
6. Check the bulk actions bar — "Set equipment" button should be gone.

## What's next

- **PR 4.19 — Trends view** (the per-club fingerprint + drift-over-time
  view we discussed). Parked in backlog with full design.
- Column reordering in Shots view (still on backlog).
