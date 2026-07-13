/**
 * US Eastern (FF calendar) ↔ UTC ↔ Vietnam (Asia/Ho_Chi_Minh, UTC+7)
 * Forex Factory wall times = America/New_York (EST UTC-5 / EDT UTC-4).
 */

/** Chủ nhật thứ N trong tháng (1-based n) — 00:00 UTC của ngày đó */
function nthSundayUtc(year: number, monthIndex: number, n: number): number {
  // monthIndex 0=Jan
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const t = Date.UTC(year, monthIndex, day, 0, 0, 0);
    if (new Date(t).getUTCDay() === 0) {
      count += 1;
      if (count === n) return t;
    }
  }
  return Date.UTC(year, monthIndex, 1);
}

/**
 * US DST (post-2007):
 * - Starts: 2nd Sunday March 02:00 local Eastern
 * - Ends: 1st Sunday November 02:00 local Eastern
 * Returns true if EDT (UTC-4) at this Eastern wall clock instant.
 */
export function isUsEasternDst(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number
): boolean {
  const start = nthSundayUtc(year, 2, 2); // March 2nd Sunday 00:00 UTC (approx day)
  const end = nthSundayUtc(year, 10, 1); // Nov 1st Sunday

  // Compare as Eastern wall "minutes from year" using fixed offsets for boundary
  // Build comparable numbers: YYYYMMDDHHMM
  const wall =
    year * 1e8 +
    (monthIndex + 1) * 1e6 +
    day * 1e4 +
    hour * 100 +
    minute;

  const startD = new Date(start);
  const endD = new Date(end);
  // DST starts 02:00 local on 2nd Sun March
  const startWall =
    year * 1e8 +
    3 * 1e6 +
    startD.getUTCDate() * 1e4 +
    2 * 100 +
    0;
  // DST ends 02:00 local on 1st Sun November
  const endWall =
    year * 1e8 +
    11 * 1e6 +
    endD.getUTCDate() * 1e4 +
    2 * 100 +
    0;

  return wall >= startWall && wall < endWall;
}

/**
 * Convert US Eastern wall-clock → UTC epoch ms.
 */
export function easternWallToUtcMs(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): number {
  const dst = isUsEasternDst(year, monthIndex, day, hour, minute);
  // EDT = UTC-4 → UTC = local + 4h; EST = UTC-5 → UTC = local + 5h
  const offsetH = dst ? 4 : 5;
  return Date.UTC(year, monthIndex, day, hour + offsetH, minute, second);
}

/** Format ms → US Eastern display */
export function formatUsEastern(ms: number): string {
  try {
    return new Date(ms).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/** Format ms → Vietnam (GMT+7) */
export function formatVietnam(ms: number): string {
  try {
    return new Date(ms).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/** Monday 00:00 Asia/Ho_Chi_Minh as UTC ms (week key VN) */
export function mondayVnWeekStartMs(now = Date.now()): number {
  // Get VN calendar parts via formatter
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(now));

  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  const wd = get('weekday'); // Sun Mon ...
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = map[wd] ?? new Date(now).getUTCDay();
  // days since Monday
  const sinceMon = dow === 0 ? 6 : dow - 1;

  // VN is UTC+7 fixed — Monday 00:00 VN = UTC previous day 17:00
  const noonUtcGuess = Date.UTC(year, month - 1, day, 12, 0, 0); // rough
  // Better: construct from parts as if UTC then subtract 7h for VN midnight of that day
  const dayStartVnAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 3600 * 1000;
  void noonUtcGuess;
  return dayStartVnAsUtc - sinceMon * 86400000;
}

/** Key tuần: YYYY-MM-DD của Monday (VN) */
export function currentWeekKeyVn(now = Date.now()): string {
  const mon = mondayVnWeekStartMs(now);
  // mon is UTC instant of Mon 00:00 VN → format date in VN
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(mon));
  return parts; // YYYY-MM-DD
}

export function weekLabelVn(now = Date.now()): string {
  const mon = mondayVnWeekStartMs(now);
  const sun = mon + 6 * 86400000;
  const f = (ms: number) =>
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(ms));
  return `${f(mon)} – ${f(sun)}`;
}
