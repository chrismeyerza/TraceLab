/**
 * Curated equipment list organised by club category. The picker reads the
 * shot's club, maps it to a category via `clubCategory()` in benchmarks.js,
 * and shows only that category's brands. This prevents nonsense tagging
 * (you can't tag a 7i as "Callaway Rogue ST" because Rogue ST is a driver).
 *
 * Scope: representative, not exhaustive. ~4-6 brands per category, ~3-4
 * models per brand, covering the dominant share of what's in golfers' bags
 * today. If a model is missing, it gets added to the source. Compiled from
 * public 2024-2026 lineup data.
 *
 * Stored format on a shot is a single string: "Vokey SM10", "Callaway
 * Rogue ST Max", "Ping i230" etc — same as before, the structural change
 * only affects the picker UI, not what's persisted.
 *
 * Brand conventions:
 *   - Vokey appears only under "wedge" — it's Titleist's wedge sub-brand
 *     but golfers think of Vokey as its own category, so it's a top-level
 *     entry there. Titleist appears under "iron" as itself.
 *   - Cleveland is owned by Srixon but operates as a distinct wedge brand
 *     in players' minds — top-level under wedge.
 *   - Same brand can appear in multiple categories (Callaway in driver,
 *     wood, hybrid, iron) with the appropriate model line each time.
 */
export const EQUIPMENT_BY_CATEGORY = {
  driver: [
    {
      brand: 'Callaway',
      models: ['Rogue ST', 'Rogue ST Max', 'Paradym', 'Paradym Ai Smoke'],
    },
    {
      brand: 'TaylorMade',
      models: ['Stealth', 'Stealth 2', 'Qi10', 'Qi10 Max'],
    },
    {
      brand: 'Titleist',
      models: ['TSR1', 'TSR2', 'TSR3', 'GT2', 'GT3'],
    },
    {
      brand: 'Ping',
      models: ['G430 Max', 'G430 LST', 'G430 SFT', 'G440 Max'],
    },
    {
      brand: 'Cobra',
      models: ['Aerojet', 'Darkspeed', 'Darkspeed LS'],
    },
    {
      brand: 'Mizuno',
      models: ['ST-Max', 'ST-X'],
    },
  ],

  wood: [
    {
      brand: 'Callaway',
      models: ['Paradym', 'Paradym Ai Smoke', 'Rogue ST Max'],
    },
    {
      brand: 'TaylorMade',
      models: ['Stealth 2', 'Qi10', 'Qi35'],
    },
    {
      brand: 'Titleist',
      models: ['TSR2', 'TSR3', 'GT2', 'GT3'],
    },
    {
      brand: 'Ping',
      models: ['G430 Max', 'G430 SFT', 'G440 Max'],
    },
    {
      brand: 'Cobra',
      models: ['Aerojet', 'Darkspeed'],
    },
  ],

  hybrid: [
    {
      brand: 'Callaway',
      models: ['Apex', 'Paradym', 'Rogue ST Max'],
    },
    {
      brand: 'TaylorMade',
      models: ['Stealth Plus', 'Qi10', 'Qi35'],
    },
    {
      brand: 'Titleist',
      models: ['TSR2', 'TSR3', 'GT2'],
    },
    {
      brand: 'Ping',
      models: ['G430', 'G440'],
    },
    {
      brand: 'Cobra',
      models: ['Aerojet', 'Darkspeed'],
    },
    {
      brand: 'Mizuno',
      models: ['CLK'],
    },
  ],

  iron: [
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
  ],

  wedge: [
    {
      brand: 'Vokey',
      models: ['SM11', 'SM10', 'SM9', 'SM8'],
    },
    {
      brand: 'Cleveland',
      models: ['RTX 6 ZipCore', 'RTX ZipCore', 'CBX 4'],
    },
    {
      brand: 'Callaway',
      models: ['Jaws Raw', 'Jaws MD5', 'Opus'],
    },
    {
      brand: 'TaylorMade',
      models: ['MG4', 'MG3', 'Hi-Toe 3'],
    },
    {
      brand: 'Mizuno',
      models: ['T24', 'T22', 'S23'],
    },
    {
      brand: 'Ping',
      models: ['s159', 'Glide 4.0', 'Glide Forged Pro'],
    },
  ],
};

/**
 * Flat list of every selectable equipment value across every category, for
 * use as a validation set / autocomplete reference. Each brand contributes
 * "<Brand> <Model>" entries plus a bare "<Brand>" entry (the brand-only /
 * unspecified-model option). De-duplicated globally because the same brand
 * appears in multiple categories.
 */
export const EQUIPMENT_OPTIONS = (() => {
  const set = new Set();
  for (const cat of Object.values(EQUIPMENT_BY_CATEGORY)) {
    for (const { brand, models } of cat) {
      set.add(brand);
      for (const m of models) set.add(`${brand} ${m}`);
    }
  }
  return [...set];
})();

/** True if a stored equipment string is one we recognise. */
export function isKnownEquipment(value) {
  return value != null && EQUIPMENT_OPTIONS.includes(value);
}

/**
 * Get the brands available for a given club category. The picker uses this
 * to filter its brand list to the category that makes sense for the shot.
 * Unknown categories fall back to iron (safe — has the most coverage).
 */
export function getBrandsForCategory(category) {
  return EQUIPMENT_BY_CATEGORY[category] || EQUIPMENT_BY_CATEGORY.iron;
}

/**
 * Legacy export — keep the old flat-array name available for any code that
 * imports it directly. Returns the union of all categories' brands. Most
 * call sites should migrate to getBrandsForCategory(); this is just a
 * safety net so old imports don't crash.
 */
export const EQUIPMENT_BRANDS = (() => {
  const map = new Map();
  for (const cat of Object.values(EQUIPMENT_BY_CATEGORY)) {
    for (const { brand, models } of cat) {
      if (!map.has(brand)) map.set(brand, new Set());
      for (const m of models) map.get(brand).add(m);
    }
  }
  return [...map.entries()].map(([brand, modelsSet]) => ({
    brand,
    models: [...modelsSet],
  }));
})();
