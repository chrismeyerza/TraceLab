// All stored data uses Foresight's native units (mph, yards, degrees, rpm, mm).
// We convert at display time only — never store converted values.

export const UNIT_PREFS_KEY = 'foresight_unit_prefs';
export const DEFAULT_UNITS = { distance: 'yds', speed: 'mph' };

export const UNIT_CONFIG = {
  distance: {
    yds: { label: 'yds', factor: 1.0 },
    m:   { label: 'm',   factor: 0.9144 },
  },
  speed: {
    mph:  { label: 'mph',  factor: 1.0 },
    kmh:  { label: 'km/h', factor: 1.609344 },
  },
};

export function convertDistance(yds, unit) {
  if (yds == null || isNaN(yds)) return yds;
  return yds * UNIT_CONFIG.distance[unit].factor;
}

export function convertSpeed(mph, unit) {
  if (mph == null || isNaN(mph)) return mph;
  return mph * UNIT_CONFIG.speed[unit].factor;
}

export const distLabel = (unit) => UNIT_CONFIG.distance[unit].label;
export const speedLabel = (unit) => UNIT_CONFIG.speed[unit].label;

/**
 * Convert a benchmark window [absMin, idealLow, idealHigh, absMax] by a factor.
 * Used when displaying yards-based windows (e.g. peak height) in metres.
 */
export function convertWindow(win, factor) {
  return win.map((v) => v * factor);
}

/** Load saved unit prefs from localStorage; fall back to defaults. */
export function loadUnits() {
  try {
    const saved = localStorage.getItem(UNIT_PREFS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_UNITS;
  } catch {
    return DEFAULT_UNITS;
  }
}

export function saveUnits(units) {
  try {
    localStorage.setItem(UNIT_PREFS_KEY, JSON.stringify(units));
  } catch {
    /* localStorage may be unavailable (e.g. private mode); silently ignore */
  }
}
