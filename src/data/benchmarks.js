// Per-club optimal windows. Each metric is [absMin, idealLow, idealHigh, absMax].
// Sources: TrackMan Optimization Database, PGA Tour ShotLink averages, accepted
// teaching benchmarks for skilled amateurs.
//
// Units: clubSpeed/ballSpeed in mph, distances in yds, spin in rpm, angles in deg.

import { normalizeClubName } from '../lib/clubs';

export const OPTIMAL_WINDOWS = {
  'Dr':  { clubSpeed:[85,95,110,125], ballSpeed:[125,140,165,185], smash:[1.42,1.45,1.50,1.52],
           launch:[10,12,16,20], spin:[1700,2200,2900,3500], descent:[35,38,42,48],
           peakHeight:[28,32,40,46], aoa:[-2,1,5,8], carry:[200,230,270,310] },
  '3w':  { clubSpeed:[83,92,105,118], ballSpeed:[120,135,158,175], smash:[1.40,1.43,1.48,1.51],
           launch:[10,12,15,19], spin:[2500,3000,3800,4500], descent:[35,40,45,50],
           peakHeight:[26,30,38,44], aoa:[-3,-1,2,4], carry:[180,210,245,275] },
  '5w':  { clubSpeed:[80,88,100,112], ballSpeed:[115,130,150,165], smash:[1.38,1.42,1.47,1.50],
           launch:[11,13,17,21], spin:[3000,3500,4500,5500], descent:[36,42,47,52],
           peakHeight:[26,30,38,44], aoa:[-4,-2,1,3], carry:[170,195,225,250] },
  '7w':  { clubSpeed:[78,86,98,108], ballSpeed:[110,125,145,160], smash:[1.36,1.40,1.45,1.50],
           launch:[12,14,19,23], spin:[3500,4000,5000,6000], descent:[37,42,48,54],
           peakHeight:[27,30,38,44], aoa:[-4,-2,0,2], carry:[160,180,215,240] },
  '2h':  { clubSpeed:[80,88,100,112], ballSpeed:[115,130,150,165], smash:[1.34,1.40,1.46,1.50],
           launch:[10,12,15,20], spin:[3500,4000,5000,6000], descent:[34,40,46,52],
           peakHeight:[25,28,36,42], aoa:[-4,-2.5,-1,1], carry:[170,190,220,245] },
  '3h':  { clubSpeed:[80,88,100,112], ballSpeed:[115,130,148,162], smash:[1.34,1.40,1.46,1.50],
           launch:[11,13,16,21], spin:[3800,4500,5500,6500], descent:[35,40,46,52],
           peakHeight:[26,30,36,42], aoa:[-4,-3,-1,1], carry:[165,185,215,240] },
  '4h':  { clubSpeed:[78,86,98,110], ballSpeed:[112,125,145,158], smash:[1.32,1.38,1.44,1.48],
           launch:[12,14,17,22], spin:[4000,4800,5800,7000], descent:[35,41,47,53],
           peakHeight:[26,30,36,42], aoa:[-4,-3,-1,0], carry:[160,180,210,230] },
  '5h':  { clubSpeed:[78,85,96,108], ballSpeed:[110,123,143,156], smash:[1.32,1.36,1.42,1.46],
           launch:[12,14,18,23], spin:[4200,5000,6000,7500], descent:[36,42,48,54],
           peakHeight:[26,30,36,42], aoa:[-4,-3,-1.5,0], carry:[155,175,205,225] },
  '2i':  { clubSpeed:[85,92,105,115], ballSpeed:[118,135,155,170], smash:[1.30,1.36,1.42,1.48],
           launch:[10,12,15,19], spin:[3500,4000,5000,6500], descent:[30,35,40,46],
           peakHeight:[22,26,32,38], aoa:[-3,-2,-0.5,0.5], carry:[165,185,215,240] },
  '3i':  { clubSpeed:[86,93,104,114], ballSpeed:[120,135,150,165], smash:[1.30,1.36,1.42,1.48],
           launch:[10,12,15,19], spin:[3800,4300,5300,6800], descent:[30,35,40,46],
           peakHeight:[23,27,33,39], aoa:[-3.5,-2.5,-1,0], carry:[160,180,210,230] },
  '4i':  { clubSpeed:[86,94,104,114], ballSpeed:[120,135,150,165], smash:[1.30,1.36,1.42,1.48],
           launch:[11,13,16,20], spin:[4000,4500,5500,7000], descent:[31,36,42,48],
           peakHeight:[24,28,34,40], aoa:[-3.5,-2.5,-1,0], carry:[160,175,190,205] },
  '5i':  { clubSpeed:[84,92,102,112], ballSpeed:[115,130,145,160], smash:[1.30,1.34,1.40,1.46],
           launch:[12,14,17,22], spin:[4500,5000,6500,8000], descent:[33,38,44,50],
           peakHeight:[26,30,34,40], aoa:[-4,-3,-1.5,-1], carry:[150,165,180,195] },
  '6i':  { clubSpeed:[82,90,100,110], ballSpeed:[110,125,140,155], smash:[1.28,1.32,1.38,1.44],
           launch:[13,15,18,23], spin:[5500,6000,7000,8500], descent:[35,40,46,52],
           peakHeight:[26,30,36,42], aoa:[-4,-3.5,-2,-1], carry:[140,155,170,185] },
  '7i':  { clubSpeed:[80,88,98,108], ballSpeed:[105,120,135,150], smash:[1.25,1.30,1.37,1.43],
           launch:[14,16,20,25], spin:[6000,6500,7500,9000], descent:[36,42,48,55],
           peakHeight:[26,30,38,44], aoa:[-5,-4,-2,-1], carry:[130,145,160,175] },
  '8i':  { clubSpeed:[78,85,95,105], ballSpeed:[100,115,130,145], smash:[1.22,1.28,1.35,1.42],
           launch:[16,19,24,28], spin:[6500,7500,8500,10000], descent:[38,45,50,56],
           peakHeight:[26,32,38,44], aoa:[-5,-4,-3,-1], carry:[120,135,150,165] },
  '9i':  { clubSpeed:[75,82,92,100], ballSpeed:[95,110,125,135], smash:[1.18,1.25,1.33,1.40],
           launch:[18,22,27,32], spin:[7000,8000,9500,11000], descent:[40,45,52,58],
           peakHeight:[24,30,36,42], aoa:[-6,-5,-3,-1], carry:[110,125,140,155] },
  'PW':  { clubSpeed:[70,80,90,100], ballSpeed:[85,100,115,130], smash:[1.10,1.20,1.28,1.35],
           launch:[20,24,30,36], spin:[7500,9000,10500,12000], descent:[40,45,52,60],
           peakHeight:[20,26,34,42], aoa:[-7,-5,-3,-1], carry:[90,110,130,145] },
  'GW':  { clubSpeed:[65,75,85,95], ballSpeed:[78,92,108,122], smash:[1.08,1.18,1.26,1.32],
           launch:[22,26,32,38], spin:[8500,9500,11000,12500], descent:[42,48,55,62],
           peakHeight:[18,24,32,40], aoa:[-8,-6,-4,-2], carry:[75,95,115,130] },
  'SW':  { clubSpeed:[60,70,80,90], ballSpeed:[70,82,98,112], smash:[1.05,1.15,1.24,1.30],
           launch:[24,28,34,40], spin:[9000,10000,11500,13000], descent:[44,50,58,65],
           peakHeight:[16,22,30,38], aoa:[-9,-7,-4,-2], carry:[65,80,100,120] },
  'LW':  { clubSpeed:[55,65,75,85], ballSpeed:[60,72,88,100], smash:[1.03,1.10,1.20,1.28],
           launch:[26,30,38,46], spin:[9500,10500,12000,14000], descent:[46,52,60,70],
           peakHeight:[14,18,26,34], aoa:[-10,-8,-5,-2], carry:[50,65,85,105] },
};

/** Resolve a benchmark window for a club, falling back to 7i if unknown. */
export function getWindow(club) {
  return OPTIMAL_WINDOWS[normalizeClubName(club)] || OPTIMAL_WINDOWS['7i'];
}

/**
 * Strike tolerance bands. Distance from face centre in mm — euclidean (combined
 * horizontal + vertical). Bands are interpreted as upper bounds:
 *   distance <= centred -> "Centred" (pure)
 *   distance <= near    -> "Near centre" (good)
 *   distance <= off     -> "Off centre" (acceptable)
 *   distance >  off     -> "Miss" (poor)
 *
 * idealRadius is the reference for the "% out of sweet spot" calculation. A
 * value of 1.0× = exactly at the edge of the centred zone; 2.0× = twice as far
 * out, and so on. We deliberately use the centred-zone boundary (not the face
 * size) as the reference because what matters is energy transfer, not whether
 * you hit the face at all.
 *
 * Values reflect typical published club-fitter data plus accepted coaching
 * benchmarks. Drivers have larger sweet spots due to face size, MOI design,
 * and trampoline effect; irons and wedges have small, demanding sweet zones.
 */
const STRIKE_BANDS = {
  driver:  { centred: 12, near: 22, off: 35, idealRadius: 12 },
  wood:    { centred: 10, near: 18, off: 28, idealRadius: 10 },
  hybrid:  { centred: 9,  near: 16, off: 25, idealRadius: 9 },
  iron:    { centred: 8,  near: 15, off: 25, idealRadius: 8 },
  wedge:   { centred: 8,  near: 14, off: 22, idealRadius: 8 },
};

function clubCategory(club) {
  const c = normalizeClubName(club);
  if (c === 'Dr') return 'driver';
  if (/^[0-9]w$/.test(c)) return 'wood';
  if (/^[0-9]h$/.test(c)) return 'hybrid';
  if (/^[0-9]i$/.test(c)) return 'iron';
  if (['PW', 'GW', 'SW', 'LW'].includes(c)) return 'wedge';
  // Numeric loft names (e.g. "50°", "56°") — treat as wedges.
  if (/^\d+°$/.test(club)) return 'wedge';
  return 'iron'; // safe fallback
}

/**
 * Classify a face-impact distance for a given club.
 * Returns {band, distMm, pctOfIdeal} where:
 *   band: 'centred' | 'near' | 'off' | 'miss'
 *   distMm: euclidean distance from centre, mm
 *   pctOfIdeal: distance relative to the centred-zone radius (1.0 = at edge)
 */
export function classifyStrike(club, faceImpactH, faceImpactV) {
  if (faceImpactH == null || faceImpactV == null) return null;
  const dist = Math.sqrt(faceImpactH * faceImpactH + faceImpactV * faceImpactV);
  const bands = STRIKE_BANDS[clubCategory(club)];
  let band;
  if (dist <= bands.centred) band = 'centred';
  else if (dist <= bands.near) band = 'near';
  else if (dist <= bands.off) band = 'off';
  else band = 'miss';
  return {
    band,
    distMm: dist,
    pctOfIdeal: dist / bands.idealRadius,
  };
}

/** Look up the raw tolerance bands for a club. Useful for showing the explainer. */
export function getStrikeBands(club) {
  return STRIKE_BANDS[clubCategory(club)];
}
