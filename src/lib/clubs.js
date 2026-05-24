// Canonical club ordering — driver first, putter last.
export const CLUB_ORDER = [
  'Dr', '3w', '5w', '7w',
  '2h', '3h', '4h', '5h',
  '2i', '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'GW', 'SW', 'LW',
  'Pt',
];

const CLUB_RANK = Object.fromEntries(CLUB_ORDER.map((c, i) => [c, i]));

export const CLUB_COLORS = {
  'Dr': '#ef4444', '3w': '#f97316', '5w': '#eab308', '7w': '#facc15',
  '2h': '#06b6d4', '3h': '#22d3ee', '4h': '#67e8f9', '5h': '#a5f3fc',
  '2i': '#dc2626', '3i': '#fb7185', '4i': '#f472b6', '5i': '#a78bfa',
  '6i': '#34d399', '7i': '#60a5fa', '8i': '#4ade80', '9i': '#fb923c',
  'PW': '#fbbf24', 'GW': '#facc15', 'SW': '#fde047', 'LW': '#fef08a',
  'Pt': '#94a3b8',
};

/**
 * Foresight FSX Play exports club names in many variations. Normalise to the
 * short canonical form (Dr, 3w, 7i, PW, etc.) so the same club merges across
 * sessions regardless of how it was labelled.
 */
const CLUB_ALIASES = {
  'driver': 'Dr', 'dr': 'Dr', 'd': 'Dr',
  '3 wood': '3w', '3wood': '3w', '3w': '3w', 'fairway wood': '3w', '3 fw': '3w',
  '5 wood': '5w', '5wood': '5w', '5w': '5w', '5 fw': '5w',
  '7 wood': '7w', '7wood': '7w', '7w': '7w',
  '2 hybrid': '2h', '2h': '2h', '2 hy': '2h',
  '3 hybrid': '3h', '3h': '3h', 'hybrid': '3h', 'hy': '3h', '3 hy': '3h',
  '4 hybrid': '4h', '4h': '4h', '4 hy': '4h',
  '5 hybrid': '5h', '5h': '5h', '5 hy': '5h',
  '2 iron': '2i', '2i': '2i',
  '3 iron': '3i', '3i': '3i',
  '4 iron': '4i', '4i': '4i',
  '5 iron': '5i', '5i': '5i',
  '6 iron': '6i', '6i': '6i',
  '7 iron': '7i', '7i': '7i',
  '8 iron': '8i', '8i': '8i',
  '9 iron': '9i', '9i': '9i',
  'pitching wedge': 'PW', 'pitchingwedge': 'PW', 'pw': 'PW', 'p': 'PW',
  'gap wedge': 'GW', 'gapwedge': 'GW', 'gw': 'GW', 'aw': 'GW',
  'a wedge': 'GW', 'approach wedge': 'GW',
  'sand wedge': 'SW', 'sandwedge': 'SW', 'sw': 'SW', 's': 'SW',
  'lob wedge': 'LW', 'lobwedge': 'LW', 'lw': 'LW',
  'putter': 'Pt', 'pt': 'Pt',
};

export function normalizeClubName(raw) {
  if (!raw) return raw;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  return CLUB_ALIASES[key] || raw;
}

export const clubColor = (c) => CLUB_COLORS[normalizeClubName(c)] || '#9ca3af';

/** Sort an array of club names by canonical bag order. */
export function orderedClubs(clubs) {
  return [...clubs].sort((a, b) => {
    const ra = CLUB_RANK[normalizeClubName(a)] ?? 999;
    const rb = CLUB_RANK[normalizeClubName(b)] ?? 999;
    return ra - rb || String(a).localeCompare(String(b));
  });
}
