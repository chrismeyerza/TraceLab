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

/**
 * Parse a Foresight FSX Play timestamp string ("MM/DD/YYYY HH:MM:SS").
 * Returns a Date or null. Treats the input as local time (Foresight does not
 * include timezone info; assuming local matches the user's expectation).
 */
function parseFsxDate(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) {
    // Fall through to JS Date parsing for ISO or other formats
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, mo, d, y, h, mi, sec] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi, +sec);
}

/**
 * IEEE 754 single-precision FLT_MAX (~3.4028e+38). Foresight emits this sentinel
 * when a measurement was not captured (typically club data on a shot where the
 * unit saw the ball but missed the club). We treat any value above 1e30 as
 * missing data and convert to null.
 */
const FLT_MAX_THRESHOLD = 1e30;

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return null;
  if (Math.abs(n) > FLT_MAX_THRESHOLD) return null;
  return n;
}

/**
 * Minimal CSV parser tailored for FSX Play exports.
 * Handles: UTF-8 BOM, CRLF/LF line endings, quoted fields with embedded commas,
 * doubled quotes inside quoted fields ("" -> "). Returns an array of row objects
 * keyed by the header row.
 *
 * Deliberately not using a library — FSX Play CSVs are well-formed and a few
 * dozen lines of code avoids a 50KB dependency.
 */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        // swallow; \n will commit the row
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  // Final row (no trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = r[idx] !== undefined ? r[idx] : null;
    });
    return o;
  });
}

/**
 * Resolve the "Club Name" field. Foresight FSX Play sometimes stores the club's
 * loft as the name (e.g. "50" for a 50° wedge) with the category in "Club Type"
 * (e.g. "Wedge", "Iron", "Driver"). Convention chosen by the user: for numeric
 * wedge names keep them as "50°" / "52°" rather than guessing PW/GW/SW.
 *
 * For other shapes (e.g. "7i" + "Iron") the existing alias map handles things.
 */
function resolveClubName(rawName, rawType) {
  if (rawName == null || rawName === '') {
    // Fall back to Club Type alone if no name was given
    return rawType ? normalizeClubName(rawType) : 'Unknown';
  }
  const s = String(rawName).trim();
  // If the name is purely numeric, treat it as loft. Append a degree sign for
  // readability and to avoid colliding with iron numbers ("7" vs "7i").
  if (/^\d+(\.\d+)?$/.test(s)) {
    const loft = parseFloat(s);
    return `${Math.round(loft)}°`;
  }
  return normalizeClubName(s);
}

/**
 * Parse a Foresight FSX Play export (CSV or XLSX) into our internal shot model.
 *
 * Robust to:
 *   - Whitespace in column headers (FSX sometimes pads with leading/trailing spaces)
 *   - Mixed case column headers
 *   - Variations in club naming (Driver vs Dr, Pitching Wedge vs PW)
 *   - Numeric club names ("50" for a 50° wedge)
 *   - FLT_MAX sentinel values (Foresight's "no data captured" flag for club
 *     fields on shots where ball flight was tracked but club wasn't) — these
 *     are converted to null so downstream stats skip them rather than treating
 *     them as real zeros.
 *   - Empty rows
 *   - Missing columns (returns null for any field not in the export)
 *
 * Accepts either an ArrayBuffer (xlsx) or a string (csv). The caller in
 * App.jsx detects file type from the extension and reads accordingly.
 *
 * Returns { sessionId, sessionLabel, shots }.
 */
export function parseForesightFile(input, fileName) {
  const isCsv = /\.csv$/i.test(fileName) || typeof input === 'string';

  let rawRows;
  if (isCsv) {
    const text = typeof input === 'string'
      ? input
      : new TextDecoder('utf-8').decode(input);
    rawRows = parseCsv(text);
  } else {
    const wb = XLSX.read(input, { type: 'array' });
    const sheetName = wb.SheetNames.includes('Data') ? 'Data' : wb.SheetNames[0];
    rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  }

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

  // Provisional id used during parsing — replaced after we know the earliest
  // shot's timestamp, so the final session id is stable, meaningful, and
  // identical when the same physical session is re-imported.
  const provisionalSessionId = `S-tmp-${Math.random().toString(36).slice(2, 8)}`;
  const sessionLabel = fileName.replace(/\.(xlsx|xls|csv)$/i, '');

  const shots = rows
    .map((r) => {
      const created = get(r, 'Shot Created Date');
      let dt = null;
      if (typeof created === 'number') {
        dt = excelSerialToDate(created);
      } else if (typeof created === 'string') {
        dt = parseFsxDate(created);
      } else if (created instanceof Date) {
        dt = created;
      }
      const club = resolveClubName(get(r, 'Club Name'), get(r, 'Club Type'));
      const ballSpeed = num(get(r, 'Ball Speed (mph)'));
      const clubSpeed = num(get(r, 'Club Speed (mph)'));

      // Detect the "club data not captured" pattern. Foresight emits FLT_MAX
      // on the primary unmeasured field (typically Club Speed) and then fills
      // dependent fields with literal 0s as placeholders. num() has already
      // mapped FLT_MAX -> null; if clubSpeed is null we treat the whole suite
      // of club-impact fields as missing rather than trusting their cascading
      // zeros, which would silently contaminate averages with bogus values.
      const clubDataMissing = clubSpeed == null;

      const efficiencyRaw = num(get(r, 'Efficiency'));
      const efficiency = clubDataMissing ? null
        : (efficiencyRaw != null ? efficiencyRaw
          : (ballSpeed != null && clubSpeed != null && clubSpeed > 0)
            ? ballSpeed / clubSpeed
            : null);

      // Helper: returns num(value), or null if clubDataMissing is true.
      const clubNum = (v) => clubDataMissing ? null : num(v);

      const shot = {
        sessionId: provisionalSessionId,
        sessionLabel,
        shotNumber: num(get(r, 'Shot Number')),
        club,
        clubType: get(r, 'Club Type') || '',
        createdAt: dt ? dt.toISOString() : null,
        ballSpeed,
        clubSpeed,
        clubSpeedImpact: clubNum(get(r, 'Club Speed at Impact Location (mph)')),
        efficiency,
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
        // Club-impact fields. All depend on the unit having captured the club
        // at impact; clubNum() preserves them as null if club data is missing.
        angleOfAttack: clubNum(get(r, 'Angle of Attack (deg)')),
        clubPath: clubNum(get(r, 'Club Path (deg out-in-/in-out+)')),
        faceToTarget: clubNum(get(r, 'Face to Target (deg closed-/open+)')),
        lie: clubNum(get(r, 'Lie (deg toe down-/toe up+)')),
        loft: clubNum(get(r, 'Loft (deg)')),
        faceImpactH: clubNum(get(r, 'Face Impact Horizontal (mm toe-/heel+)')),
        faceImpactV: clubNum(get(r, 'Face Impact Vertical (mm low-/high+)')),
        closureRate: clubNum(get(r, 'Closure Rate (deg/sec)')),
      };

      // --- Derived fields ----------------------------------------------------
      // Each derivation guards against null inputs so a partial shot (e.g. one
      // with missing club data due to FLT_MAX) produces null for the derived
      // field rather than contaminating averages with bogus zeros.

      // Face to Path: positive = open-to-path (fade-biased for RH),
      // negative = closed-to-path (draw-biased for RH).
      if (shot.faceToTarget != null && shot.clubPath != null) {
        shot.faceToPath = shot.faceToTarget - shot.clubPath;
      } else {
        shot.faceToPath = null;
      }

      // Spin Loft: positive = spin-generating geometry. Spin loft of zero
      // produces no spin (a knuckleball); typical values: driver 10-15°,
      // mid-iron 20-25°, wedges 35-50°.
      if (shot.loft != null && shot.angleOfAttack != null) {
        shot.spinLoft = shot.loft - shot.angleOfAttack;
      } else {
        shot.spinLoft = null;
      }

      // Spin Axis (tilt): atan2(sideSpin, backSpin), in degrees.
      // Positive = tilted right (fade for RH), negative = tilted left (draw).
      // backSpin can be very small or zero on putts/topped shots — guard for that.
      if (shot.sideSpin != null && shot.backSpin != null && shot.backSpin > 0) {
        shot.spinAxis = (Math.atan2(shot.sideSpin, shot.backSpin) * 180) / Math.PI;
      } else {
        shot.spinAxis = null;
      }

      // Run Distance: total - carry. Useful for green-holding analysis.
      if (shot.totalDist != null && shot.carry != null) {
        shot.runDistance = shot.totalDist - shot.carry;
      } else {
        shot.runDistance = null;
      }

      // Curvature (yds): lateral deviation of the ball from its initial start
      // line at landing. Approximation: assumes a straight initial trajectory,
      // which is fine for analysis purposes. Sign convention matches Offline
      // (negative left, positive right relative to target line — but here it's
      // relative to start line, isolating the curve from start direction).
      if (shot.offline != null && shot.carry != null && shot.pushPull != null) {
        const startLineDeflection = shot.carry * Math.tan((shot.pushPull * Math.PI) / 180);
        shot.curvature = shot.offline - startLineDeflection;
      } else {
        shot.curvature = null;
      }

      // Dedup key: timestamp + ball speed. Deliberately omits club so that
      // relabelling a shot (in the Shots view) doesn't change its identity —
      // re-importing the original CSV after a relabel still dedupes correctly.
      shot.dedup = `${shot.createdAt}|${shot.ballSpeed}`;
      return shot;
    })
    .filter((s) => s.ballSpeed != null); // drop entirely empty rows

  // Derive the real session id from the earliest shot's timestamp. This makes
  // ids meaningful (sortable as date+time), stable across re-imports of the
  // same physical session, and free of "import-time" noise. Format:
  //   S-YYYYMMDD-HHMM (e.g. S-20260520-1745).
  // If no shot has a timestamp we fall back to the provisional id rather than
  // breaking session storage.
  let sessionId = provisionalSessionId;
  const timestamps = shots
    .map((s) => (s.createdAt ? new Date(s.createdAt).getTime() : null))
    .filter((t) => t != null);
  if (timestamps.length) {
    const earliest = new Date(Math.min(...timestamps));
    const pad = (n) => String(n).padStart(2, '0');
    sessionId =
      'S-' +
      earliest.getFullYear() +
      pad(earliest.getMonth() + 1) +
      pad(earliest.getDate()) +
      '-' +
      pad(earliest.getHours()) +
      pad(earliest.getMinutes());
    // Patch each shot with the real id
    for (const s of shots) s.sessionId = sessionId;
  }

  return { sessionId, sessionLabel, shots };
}
