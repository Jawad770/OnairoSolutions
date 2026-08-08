/**
 * Timezone helpers — never rely on the server's local zone.
 * Store UTC instants; keep the IANA timezone label for display/editing.
 */

const DEFAULT_TZ = "Asia/Karachi";

function normalizeTimezone(tz) {
  const value = String(tz || DEFAULT_TZ).trim() || DEFAULT_TZ;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Parse a datetime-local style string (YYYY-MM-DDTHH:mm or with seconds)
 * as a wall-clock time in `timezone`, return a UTC Date.
 */
function zonedLocalToUtc(localValue, timezone) {
  if (!localValue) return null;
  const raw = String(localValue).trim();
  if (!raw) return null;
  const tz = normalizeTimezone(timezone);
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/
  );
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] || 0);

  // Iterate to resolve DST: guess UTC, read wall time in tz, adjust.
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(new Date(guess), tz);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = target - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

function zonedParts(date, timezone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Format a UTC Date as datetime-local value in the given timezone. */
function utcToZonedLocalInput(date, timezone) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = zonedParts(d, normalizeTimezone(timezone));
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

module.exports = {
  DEFAULT_TZ,
  normalizeTimezone,
  zonedLocalToUtc,
  utcToZonedLocalInput,
  zonedParts,
};
