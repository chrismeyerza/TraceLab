/**
 * Classify a shot's start direction and curve from Face-to-Target and Club Path.
 *
 * In modern ball-flight terms:
 *   - The ball starts where face × 0.75 + path × 0.25 points (start line)
 *   - The ball curves based on Face-to-Path (Face to Target − Club Path)
 *
 * For a right-handed golfer:
 *   - Start line > 0 = starts right (PUSH)
 *   - Start line < 0 = starts left (PULL)
 *   - Face-to-Path > 0 = face open relative to path = fade/slice
 *   - Face-to-Path < 0 = face closed relative to path = draw/hook
 *
 * Left-handed: signs flip.
 *
 * Threshold philosophy (revised in v1.6):
 *   - Start line is what physically determines where the ball goes (75% face
 *     + 25% path), not face direction alone. A square face with a 6° in-out
 *     path doesn't start straight — it starts 1.5° right.
 *   - PULL / PUSH kicks in at ±3° start line. At 150 yards that's about
 *     8 yards offline at takeoff — meaningfully off the target line. Tighter
 *     than 4° is the right call when the curve is reinforcing the start
 *     direction (a -3.5° start with closed face will end 25+ yards left,
 *     which is the textbook Pull Hook).
 *   - A "Hook" is a 25+ yard violent curve to the left; not a controlled draw.
 *   - Critically: severity owns the corner. A Hook with a straight start
 *     and a Pull Hook with a left start BOTH bucket to the corner — they
 *     end up in the same place on the course and produce the same kind of
 *     trouble. The drill panel preserves the distinction at the per-shot
 *     level when needed.
 */
export function classifyShape(faceToTarget, clubPath, rightHanded = true) {
  const factor = rightHanded ? 1 : -1;
  const face = faceToTarget * factor;
  const path = clubPath * factor;
  const faceToPath = face - path;
  const startLine = 0.75 * face + 0.25 * path;

  let start = 'STRAIGHT';
  if (startLine > 3) start = 'PUSH';
  else if (startLine < -3) start = 'PULL';

  // Curve buckets. Negative face-to-path = draw/hook side; positive = fade/slice.
  // Tight near zero; only blows out to HOOK / SLICE at large absolute values.
  let curve = 'STRAIGHT';
  if (faceToPath > 5) curve = 'SLICE';
  else if (faceToPath > 2) curve = 'FADE';
  else if (faceToPath > 0.7) curve = 'SLIGHT_FADE';
  else if (faceToPath < -5) curve = 'HOOK';
  else if (faceToPath < -2) curve = 'DRAW';
  else if (faceToPath < -0.7) curve = 'SLIGHT_DRAW';

  // Granular name preserves both axes for the drill panel. A "Hook" with a
  // straight start is distinct from a "Pull Hook" with a leftward start —
  // they bucket to the same corner cell, but the underlying name distinguishes.
  const NAMES = {
    'PULL_HOOK': 'Pull Hook', 'PULL_DRAW': 'Pull Draw', 'PULL_SLIGHT_DRAW': 'Pull Slight Draw',
    'PULL_STRAIGHT': 'Pull',
    'PULL_SLIGHT_FADE': 'Pull Slight Fade', 'PULL_FADE': 'Pull Fade', 'PULL_SLICE': 'Pull Slice',
    'STRAIGHT_HOOK': 'Hook', 'STRAIGHT_DRAW': 'Draw', 'STRAIGHT_SLIGHT_DRAW': 'Slight Draw',
    'STRAIGHT_STRAIGHT': 'Straight',
    'STRAIGHT_SLIGHT_FADE': 'Slight Fade', 'STRAIGHT_FADE': 'Fade', 'STRAIGHT_SLICE': 'Slice',
    'PUSH_HOOK': 'Push Hook', 'PUSH_DRAW': 'Push Draw', 'PUSH_SLIGHT_DRAW': 'Push Slight Draw',
    'PUSH_STRAIGHT': 'Push',
    'PUSH_SLIGHT_FADE': 'Push Slight Fade', 'PUSH_FADE': 'Push Fade', 'PUSH_SLICE': 'Push Slice',
  };
  const name = NAMES[`${start}_${curve}`] || 'Straight';
  return { start, curve, faceToPath, startLine, name };
}

/**
 * Classic 9-cell shot matrix with severity-driven corners.
 *
 * The corner cells own SEVERE curves regardless of start direction. A Hook
 * with a square start ends in roughly the same place as a Pull Hook (well
 * left of target) — both are uncontrolled left-curving shots, both are the
 * same coaching problem (face-to-path delivery). They share a cell, and the
 * cell name reflects that: "Pull / Hook" rather than "Pull Hook".
 *
 * Middle row holds CONTROLLED curves with near-target starts (the good shots).
 * Bottom-left "Push Draw" is the special case — the constructive "started
 * right, curved back" shape that deserves its own positive label.
 */
export const SHAPE_BUCKETS = [
  ['Pull / Hook', 'Pull',    'Pull / Slice'],
  ['Draw',         'Straight', 'Fade'],
  ['Push Draw',   'Push',    'Push / Slice'],
];

/**
 * Map a granular shape name down to its 9-grid bucket cell.
 *
 * Bucketing rules:
 *   - Any shot with severe DRAW curve (HOOK) → "Pull / Hook" corner
 *     regardless of start. Hook from straight start and Pull Hook from
 *     left start both end up here. They both miss left, both are
 *     face-to-path problems.
 *   - Any shot with severe FADE curve (SLICE) → "Pull / Slice" or
 *     "Push / Slice" corner depending on start.
 *   - Controlled DRAW / FADE → middle-row cells regardless of start.
 *   - "Push Draw" (push start + controlled draw curve) gets its own
 *     cell because it's the constructive "started right, curved back"
 *     shape that's actually GOOD — different from a generic Draw.
 */
export function bucketShape(name) {
  const simplify = {
    // Severe curves with leftward start — pull hook
    'Pull Hook':        'Pull / Hook',
    // Severe curves with straight start — still ends up well left
    'Hook':             'Pull / Hook',
    // Severe curves with push start (closed face on a pushed shot — rare,
    // ends up left despite the push start — same trouble category)
    'Push Hook':        'Pull / Hook',

    // Controlled draws (regardless of start direction) → middle row
    'Pull Draw':        'Draw',
    'Pull Slight Draw': 'Draw',
    'Draw':             'Draw',
    'Slight Draw':      'Draw',

    // Push-start controlled draws are the GOOD shape — own cell
    'Push Draw':        'Push Draw',
    'Push Slight Draw': 'Push Draw',

    // Straight-start straight
    'Straight':         'Straight',

    // Pull-start straight (no curve), push-start straight — direct
    'Pull':             'Pull',
    'Push':             'Push',

    // Controlled fades (regardless of start) → middle row
    'Slight Fade':      'Fade',
    'Fade':             'Fade',
    'Pull Slight Fade': 'Fade',
    'Pull Fade':        'Fade',
    'Push Slight Fade': 'Fade',
    'Push Fade':        'Fade',

    // Severe curves (slices) with leftward / straight / push start
    'Pull Slice':       'Pull / Slice',
    'Slice':            'Push / Slice', // a slice from a square start ends up well right
    'Push Slice':       'Push / Slice',
  };
  return simplify[name] || name;
}

/**
 * Format a Club Path value for display, adding the I-O / O-I direction tag
 * Foresight uses in FSX Play. Convention matches the source data:
 *   - Negative path => OUT-IN (the over-the-top, fade-promoting move)
 *   - Positive path => IN-OUT (the inside-out, draw-promoting move)
 *   - Within ±0.5° => SQUARE (effectively on-plane, no meaningful directional tag)
 *
 * This is left/right invariant: I-O always means inside-out relative to the
 * target line regardless of handedness. The sign convention in storage is
 * already "out-in negative / in-out positive" per the Foresight export, so
 * we don't flip for left-handers.
 *
 * Returns a string like "+2.1° I-O" or "−1.8° O-I" or "+0.3° SQ".
 */
export function formatPath(clubPath, digits = 1) {
  if (clubPath == null) return '—';
  const sign = clubPath > 0 ? '+' : '';
  let tag;
  if (Math.abs(clubPath) <= 0.5) tag = 'SQ';
  else if (clubPath > 0) tag = 'I-O';
  else tag = 'O-I';
  return `${sign}${clubPath.toFixed(digits)}° ${tag}`;
}
