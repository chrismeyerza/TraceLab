/**
 * Curated brand + model list for equipment tagging. This is a STOP-GAP — a
 * fixed, hardcoded taxonomy so equipment can be captured/filtered as an enum
 * (no free text, no fragmentation) until we design the proper user-managed
 * equipment system later.
 *
 * Scope: a representative — not exhaustive — set of current iron families
 * from the major manufacturers, up to ~3 models each. Compiled from public
 * 2024-2026 lineup data. Models chosen to span the players / players-distance
 * / game-improvement spread so most real gamers and demos can be matched.
 *
 * The user picks BRAND then MODEL (or just brand, or "Other" within a brand).
 * Stored on the shot as a single string: "Titleist T150", "Ping i230", etc.
 * "Other" entries store as just the brand: "Mizuno". A shot with no tag
 * stores null and is treated as "untagged".
 *
 * When we build the proper system, this list becomes the seed suggestions
 * and free text + user-managed bags take over.
 */
export const EQUIPMENT_BRANDS = [
  {
    brand: 'Titleist',
    models: ['T100', 'T150', 'T250', 'T350'],
  },
  {
    brand: 'Ping',
    models: ['Blueprint S', 'i230', 'i530', 'G730'],
  },
  {
    brand: 'Mizuno',
    models: ['Pro 241', 'Pro 243', 'Pro 245', 'JPX 925'],
  },
  {
    brand: 'Callaway',
    models: ['Apex Pro', 'Apex CB', 'Elyte', 'Paradym'],
  },
  {
    brand: 'TaylorMade',
    models: ['P·770', 'P·7MC', 'Qi', 'P·790'],
  },
  {
    brand: 'Srixon',
    models: ['ZXi5', 'ZXi7', 'ZX Mk II'],
  },
  {
    brand: 'Cobra',
    models: ['King Tour', 'Darkspeed', 'King Forged Tec'],
  },
  {
    brand: 'Wilson',
    models: ['Staff Model Blade', 'Staff Model CB', 'Dynapwr'],
  },
];

/**
 * Flat list of every selectable equipment value, for building filter chips
 * and validating stored values. Each brand contributes "<Brand> <Model>"
 * entries plus a bare "<Brand>" (the brand-only / "Other model" option).
 */
export const EQUIPMENT_OPTIONS = EQUIPMENT_BRANDS.flatMap((b) => [
  b.brand,
  ...b.models.map((m) => `${b.brand} ${m}`),
]);

/** True if a stored equipment string is one we recognise. */
export function isKnownEquipment(value) {
  return value != null && EQUIPMENT_OPTIONS.includes(value);
}
