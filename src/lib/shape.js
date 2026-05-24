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
 */
export function classifyShape(faceToTarget, clubPath, rightHanded = true) {
  const factor = rightHanded ? 1 : -1;
  const face = faceToTarget * factor;
  const path = clubPath * factor;
  const faceToPath = face - path;

  let start = 'STRAIGHT';
  if (face > 1.5) start = 'PUSH';
  else if (face < -1.5) start = 'PULL';

  let curve = 'STRAIGHT';
  if (faceToPath > 2) curve = 'FADE';
  else if (faceToPath > 0.5) curve = 'SLIGHT_FADE';
  else if (faceToPath < -2) curve = 'DRAW';
  else if (faceToPath < -0.5) curve = 'SLIGHT_DRAW';

  const NAMES = {
    'PULL_DRAW': 'Pull Hook', 'PULL_SLIGHT_DRAW': 'Pull Draw',
    'PULL_STRAIGHT': 'Pull',
    'PULL_SLIGHT_FADE': 'Pull Fade', 'PULL_FADE': 'Pull Slice',
    'STRAIGHT_DRAW': 'Draw', 'STRAIGHT_SLIGHT_DRAW': 'Slight Draw',
    'STRAIGHT_STRAIGHT': 'Straight',
    'STRAIGHT_SLIGHT_FADE': 'Slight Fade', 'STRAIGHT_FADE': 'Fade',
    'PUSH_DRAW': 'Push Draw', 'PUSH_SLIGHT_DRAW': 'Push Slight Draw',
    'PUSH_STRAIGHT': 'Push',
    'PUSH_SLIGHT_FADE': 'Push Fade', 'PUSH_FADE': 'Push Slice',
  };
  const name = NAMES[`${start}_${curve}`] || 'Straight';
  return { start, curve, faceToPath, name };
}

// The classic 9-cell shot matrix. Rows = start direction, columns = curve.
export const SHAPE_BUCKETS = [
  ['Pull Hook', 'Pull', 'Pull Slice'],
  ['Draw', 'Straight', 'Fade'],
  ['Push Draw', 'Push', 'Push Slice'],
];

/** Map fine-grained shape names down to one of the 9 grid buckets. */
export function bucketShape(name) {
  const simplify = {
    'Pull Draw': 'Pull Hook', 'Pull Hook': 'Pull Hook',
    'Pull': 'Pull', 'Pull Fade': 'Pull Slice', 'Pull Slice': 'Pull Slice',
    'Slight Draw': 'Draw', 'Draw': 'Draw',
    'Straight': 'Straight',
    'Slight Fade': 'Fade', 'Fade': 'Fade',
    'Push Draw': 'Push Draw', 'Push Slight Draw': 'Push Draw',
    'Push': 'Push',
    'Push Fade': 'Push Slice', 'Push Slice': 'Push Slice',
  };
  return simplify[name] || name;
}
