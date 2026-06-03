/**
 * Shot type taxonomy. Captures the INTENT of a shot, which the launch monitor
 * can't know — a 50° wedge hit as a full swing, a pitch, and a chip produce
 * wildly different distance/launch/spin numbers, and mixing them makes a club
 * look inconsistent when really it's doing several distinct jobs well.
 *
 * Every imported shot defaults to 'full'. Analysis views default to showing
 * full shots only, so baselines stay clean; non-full shots are available via
 * the TYPES filter.
 *
 * Order matters — it's the display order in the filter row and pickers,
 * roughly longest/biggest swing to shortest.
 */
export const SHOT_TYPES = [
  { key: 'full',      label: 'Full' },
  { key: '3-quarter', label: '3/4' },
  { key: 'half',      label: 'Half' },
  { key: 'pitch',     label: 'Pitch' },
  { key: 'chip',      label: 'Chip' },
  { key: 'bunker',    label: 'Bunker' },
  { key: 'flop',      label: 'Flop' },
  { key: 'other',     label: 'Other' },
];

export const SHOT_TYPE_KEYS = SHOT_TYPES.map((t) => t.key);

/** key → label lookup for display. Falls back to the key itself. */
export function shotTypeLabel(key) {
  const t = SHOT_TYPES.find((x) => x.key === key);
  return t ? t.label : (key || 'Full');
}
