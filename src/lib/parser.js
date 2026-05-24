import * as XLSX from 'xlsx';
import { normalizeClubName } from './clubs';

/**
 * Convert an Excel serial date (days since 1900) to a JS Date.
 * Accounts for Excel's 1900-leap-year quirk via the -25569 offset to unix epoch.
 */
function excelSerialToDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractional = serial - Math.floor(serial);
  const totalSeconds = Math.floor(86400 * fractional);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  dateInfo.setUTCHours(hours, minutes, seconds);
  return dateInfo;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * Parse a Foresight FSX Play Excel export into our internal shot model.
 *
 * Robust to:
 *   - Whitespace in column headers (FSX sometimes pads with leading/trailing spaces)
 *   - Mixed case column headers
 *   - Variations in club naming (Driver vs Dr, Pitching Wedge vs PW)
 *   - Empty rows
 *   - Missing columns (returns null for any field not in the export)
 *
 * Returns { sessionId, sessionLabel, shots }.
 */
export function parseForesightFile(arrayBuffer, fileName) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });

  // Normalise all column keys (trim, lowercase, collapse whitespace) so lookups
  // are robust to formatting changes in the export.
  const normKey = (k) => String(k).trim().replace(/\s+/g, ' ').toLowerCase();
  const rows = rawRows.map((r) => {
    const o = {};
    for (const k of Object.keys(r)) o[normKey(k)] = r[k];
    return o;
  });
  const get = (row, key) => {
    const nk = normKey(key);
    return row[nk] !== undefined ? row[nk] : null;
  };

  const sessionId = `S-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const sessionLabel = fileName.replace(/\.(xlsx|xls|csv)$/i, '');

  const shots = rows
    .map((r) => {
      const created = get(r, 'Shot Created Date');
      const dt =
        typeof created === 'number'
          ? excelSerialToDate(created)
          : created
          ? new Date(created)
          : null;
      const club = normalizeClubName(get(r, 'Club Name') || 'Unknown');
      const ballSpeed = num(get(r, 'Ball Speed (mph)'));
      const clubSpeed = num(get(r, 'Club Speed (mph)'));
      const efficiency = num(get(r, 'Efficiency'));

      const shot = {
        sessionId,
        sessionLabel,
        shotNumber: num(get(r, 'Shot Number')),
        club,
        clubType: get(r, 'Club Type') || '',
        createdAt: dt ? dt.toISOString() : null,
        ballSpeed,
        clubSpeed,
        clubSpeedImpact: num(get(r, 'Club Speed at Impact Location (mph)')),
        efficiency: efficiency || (ballSpeed && clubSpeed ? ballSpeed / clubSpeed : null),
        launchAngle: num(get(r, 'Launch Angle (deg)')),
        pushPull: num(get(r, 'Push/Pull (deg L-/R+)')),
        backSpin: num(get(r, 'Back Spin (rpm)')),
        sideSpin: num(get(r, 'Side Spin (rpm L-/R+)')),
        totalSpin: num(get(r, 'Total Spin (rpm)')),
        carry: num(get(r, 'Carry (yds)')),
        totalDist: num(get(r, 'Total Distance (yds)')),
        offline: num(get(r, 'Offline (yds L-/R+)')),
        peakHeight: num(get(r, 'Peak Height (yds)')),
        descentAngle: num(get(r, 'Descent Angle (deg)')),
        angleOfAttack: num(get(r, 'Angle of Attack (deg)')),
        clubPath: num(get(r, 'Club Path (deg out-in-/in-out+)')),
        faceToTarget: num(get(r, 'Face to Target (deg closed-/open+)')),
        lie: num(get(r, 'Lie (deg toe down-/toe up+)')),
        loft: num(get(r, 'Loft (deg)')),
        faceImpactH: num(get(r, 'Face Impact Horizontal (mm toe-/heel+)')),
        faceImpactV: num(get(r, 'Face Impact Vertical (mm low-/high+)')),
        closureRate: num(get(r, 'Closure Rate (deg/sec)')),
      };
      // Derived fields
      if (shot.faceToTarget != null && shot.clubPath != null) {
        shot.faceToPath = shot.faceToTarget - shot.clubPath;
      }
      if (shot.loft != null && shot.angleOfAttack != null) {
        shot.spinLoft = shot.loft - shot.angleOfAttack;
      }
      // Dedup key: timestamp + club + ball speed — survives re-imports.
      shot.dedup = `${shot.createdAt}|${shot.club}|${shot.ballSpeed}`;
      return shot;
    })
    .filter((s) => s.ballSpeed != null); // drop entirely empty rows

  return { sessionId, sessionLabel, shots };
}
