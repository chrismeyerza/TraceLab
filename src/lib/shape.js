/**
 * Classify a shot's start direction and curve from Face-to-Target and Club Path.
 *
 * In modern ball-flight terms:
 *   - The ball starts ~75-85% where the face points (Face to Target)
 *   - The ball curves based on Face-to-Path (Face to Target − Club Path)
 *
 * For a right-handed golfer:
 *   - Face open  (>0) = starts right (PUSH)
 *   - Face closed (<0) = starts left (PULL)
 *   - Face-to-Path > 0 = face open relative to path = fade/slice
 *   - Face-to-Path < 0 = face closed relative to path = draw/hook
 *
 * Left-handed: signs flip.
 *
 * Threshold philosophy (revised in v1.5):
 *   - A 1.5° face delivery is essentially square; not a real "Pull/Push"
 *   - A 0.5° face-to-path is barely a draw; not a real "Draw" bucket
 *   - A "Hook" is a 25+ yard violent curve; not a controlled draw
 *   - A "Slice" is a 25+ yard violent curve; not a controlled fade
 * So PUSH/PULL kicks in at 4°+ off-square, DRAW at 2°+ closed-to-path,
 * HOOK only at 5°+ closed-to-path. Numbers calibrated to observable shot
 * shape, not statistical sensitivity.
 */
export function classifyShape(faceToTarget, clubPath, rightHanded = true) {
  const factor = rightHanded ? 1 : -1;
  const face = faceToTarget * factor;
  const path = clubPath * factor;
  const faceToPath = face - path;

  let start = 'STRAIGHT';
  if (face > 4) start = 'PUSH';
  else if (face < -4) start = 'PULL';

  // Curve buckets. Negative face-to-path = draw/hook side; positive = fade/slice.
  // The bands are tighter near zero and only blow out into "HOOK" / "SLICE" at
  // large absolute values — matching what actually looks like one on course.
  let curve = 'STRAIGHT';
  if (faceToPath > 5) curve = 'SLICE';
  else if (faceToPath > 2) curve = 'FADE';
  else if (faceToPath > 0.7) curve = 'SLIGHT_FADE';
  else if (faceToPath < -5) curve = 'HOOK';
  else if (faceToPath < -2) curve = 'DRAW';
  else if (faceToPath < -0.7) curve = 'SLIGHT_DRAW';

  // Names map start × curve → the granular shape names used in summary tables.
  // Critically: a controlled draw stays a "Draw"; only a violent curve is a
  // "Hook". Same for the fade/slice side.
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
  return { start, curve, faceToPath, name };
}

/**
 * Classic 9-cell shot matrix. Rows = start direction, columns = curve.
 *
 * Important: corner cells = "started off-target AND severely curved further
 * off-target". A 1° controlled draw with a slightly closed face is NOT a
 * Pull Hook — it's just a Draw. The new (v1.5) bucketing reflects this:
 * Pull Hook only fills when both axes are severe. The middle row catches
 * "ball started near target" and the curve names there are accurate.
 *
 * The bottom-left "Push Draw" cell is a special case — it represents the
 * "started right, curved back" shape that's actually common for strong
 * players, so it keeps its supportive name (not "Push Hook").
 */
export const SHAPE_BUCKETS = [
  ['Pull Hook', 'Pull',    'Pull Slice'],
  ['Draw',      'Straight', 'Fade'],
  ['Push Draw', 'Push',    'Push Slice'],
];

/**
 * Map a granular shape name down to its 9-grid bucket cell.
 *
 * Crucial change from v1.4: "Pull Draw" (started left, slight closed-to-path)
 * collapses to the "Draw" cell, NOT the "Pull Hook" cell. Previous bucketing
 * inflated the Pull Hook count with controlled draws. The 9-grid corner now
 * means what it says.
 */
export function bucketShape(name) {
  const simplify = {
    // Pull start row
    'Pull Hook':        'Pull Hook',  // severe — stays in corner
    'Pull Draw':        'Draw',       // controlled — folds to middle row
    'Pull Slight Draw': 'Draw',
    'Pull':             'Pull',
    'Pull Slight Fade': 'Fade',       // controlled fade after pull → middle row
    'Pull Fade':        'Fade',
    'Pull Slice':       'Pull Slice', // severe — stays in corner

    // Straight start row — the curve owns the bucket. A "Hook" here is a
    // straight start with a severe draw curve; it belongs in the Draw cell
    // (middle-left), NOT the corner Pull Hook cell. Same for Slice → Fade.
    // The corner cells are sacred: they only hold "started off-target AND
    // curved further off-target" shots.
    'Hook':             'Draw',
    'Draw':             'Draw',
    'Slight Draw':      'Draw',
    'Straight':         'Straight',
    'Slight Fade':      'Fade',
    'Fade':             'Fade',
    'Slice':            'Fade',

    // Push start row
    'Push Hook':        'Push Draw',  // closed delivery on a pushed shot — fold to Push Draw
    'Push Draw':        'Push Draw',  // the "good shot" cell stays itself
    'Push Slight Draw': 'Push Draw',
    'Push':             'Push',
    'Push Slight Fade': 'Fade',
    'Push Fade':        'Fade',
    'Push Slice':       'Push Slice',
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
