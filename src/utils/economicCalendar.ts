/**
 * Economic Calendar — NEVER throws, NEVER 502-spam FF
 *
 * Priority:
 * 1. Memory cache (fresh 30m → serve; soft 6h → serve if blocked/fail)
 * 2. Disk .data/calendar-cache.json (bỏ nếu tuần cũ / toàn passed)
 * 3. Network (only if not blocked; once; deduped)
 * 4. Bundled seed — luôn shift về tuần hiện tại
 */

import fs from 'fs';
import path from 'path';
import seedRaw from '../data/calendar-seed.json';
import {
  currentWeekKeyVn,
  easternWallToUtcMs,
  formatUsEastern,
  formatVietnam,
  mondayVnWeekStartMs,
  weekLabelVn,
} from './timezoneUsVn';

export type NewsImpact = 'High' | 'Medium' | 'Low' | 'Holiday' | 'Unknown';

export interface CalendarEvent {
  id: string;
  title: string;
  currency: string;
  /** ISO UTC tuyệt đối */
  date: string;
  /** Epoch ms (UTC) */
  timeMs: number;
  /** Hiển thị giờ Mỹ (Eastern) */
  dateUs: string;
  /** Hiển thị giờ Việt Nam (GMT+7) */
  dateVn: string;
  impact: NewsImpact;
  forecast: string;
  previous: string;
  actual: string;
  minutesUntil: number;
  goldRelevant: boolean;
  status: 'upcoming' | 'live' | 'passed';
}

export interface CalendarSnapshot {
  events: CalendarEvent[];
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  weekLabel: string;
  /** Monday VN YYYY-MM-DD — dùng invalidate tuần */
  weekKey: string;
  eventCount: number;
  highImpactUpcoming: number;
  usdHighUpcoming: number;
  fromCache?: boolean;
  rateLimited?: boolean;
  warning?: string;
}

const FRESH_MS = 30 * 60 * 1000;
const SOFT_MS = 6 * 60 * 60 * 1000;
const BLOCK_429_MS = 30 * 60 * 1000;
const NETWORK_COOLDOWN_MS = 2 * 60 * 1000;

const FF_JSON = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_CSV = 'https://nfs.faireconomy.media/ff_calendar_thisweek.csv';
const DISK_DIR = path.join(process.cwd(), '.data');
const DISK_FILE = path.join(DISK_DIR, 'calendar-cache.json');

let mem: { snap: CalendarSnapshot; at: number } | null = null;
let inflight: Promise<CalendarSnapshot> | null = null;
let blockedUntil = 0;
let lastNetworkAt = 0;

const GOLD_KEYWORDS = [
  'cpi', 'ppi', 'nfp', 'non-farm', 'nonfarm', 'payroll', 'fomc',
  'federal funds', 'interest rate', 'fed chair', 'powell', 'gdp',
  'retail sales', 'unemployment', 'jobless', 'pce', 'ism', 'adp',
  'core inflation', 'crude', 'oil', 'housing', 'consumer confidence',
  'pmi', 'claims',
];

interface FfRaw {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

/** Chuẩn hoá ô số liệu FF (null / — / empty) */
export function normalizeStat(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^(null|undefined|n\/a|na|none|—|-|–)$/i.test(s)) return '';
  return s;
}

/**
 * Parse ngày FF → UTC ms.
 * - Chuỗi FF classic "M/D/YYYY h:mmam" = **US Eastern wall** (EST/EDT tự nhận DST)
 * - ISO có Z/offset → absolute
 * - ISO naive / YYYY-MM-DD HH:mm không Z → coi Eastern nếu có am/pm, else UTC
 */
export function parseFfDate(raw: string): number | null {
  const s = String(raw || '').trim();
  if (!s) return null;

  // M/D/YYYY h:mm am|pm  (FF JSON/CSV classic) — LUÔN Eastern wall
  const m = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (m) {
    let hour = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    const sec = parseInt(m[6] || '0', 10);
    const ap = (m[7] || '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    // Có am/pm → chắc Eastern; không am/pm vẫn FF Eastern mặc định
    const t = easternWallToUtcMs(year, month, day, hour, min, sec);
    return Number.isFinite(t) ? t : null;
  }

  // ISO với timezone (Z hoặc ±hh:mm)
  if (/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s) || s.includes('T')) {
    const iso = Date.parse(s);
    if (Number.isFinite(iso) && !Number.isNaN(iso)) return iso;
  }

  // YYYY-MM-DD HH:mm (không TZ) — FF đôi khi xuất; map Eastern
  const m2 = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (m2) {
    const t = easternWallToUtcMs(
      +m2[1],
      +m2[2] - 1,
      +m2[3],
      +m2[4],
      +m2[5],
      +(m2[6] || 0)
    );
    return Number.isFinite(t) ? t : null;
  }

  const fallback = Date.parse(s);
  return Number.isFinite(fallback) && !Number.isNaN(fallback) ? fallback : null;
}

/** Đưa seed (tuần mẫu) về đúng tuần hiện tại (theo Monday VN) */
export function shiftRawToCurrentWeek(raw: FfRaw[]): FfRaw[] {
  const times = raw
    .map((r) => parseFfDate(String(r.date || '')))
    .filter((t): t is number => t != null);
  if (!times.length) return raw;

  const seedMin = Math.min(...times);
  const seedMon = mondayVnWeekStartMs(seedMin);
  const nowMon = mondayVnWeekStartMs(Date.now());
  const delta = nowMon - seedMon;
  if (Math.abs(delta) < 12 * 3600 * 1000) return raw;

  return raw.map((r) => {
    const t = parseFfDate(String(r.date || ''));
    if (t == null) return r;
    return { ...r, date: new Date(t + delta).toISOString() };
  });
}

/**
 * Cache còn thuộc tuần hiện tại?
 * - weekKey khớp Monday VN, hoặc
 * - ≥1 sự kiện nằm trong [Mon VN − 12h, Mon+7d + 12h]
 */
function isCurrentWeekEvents(
  events: CalendarEvent[],
  weekKey?: string
): boolean {
  if (!events.length) return false;
  const keyNow = currentWeekKeyVn();
  if (weekKey && weekKey === keyNow) return true;

  const mon = mondayVnWeekStartMs();
  const next = mon + 7 * 86400000;
  const lo = mon - 12 * 3600000;
  const hi = next + 12 * 3600000;
  return events.some((e) => {
    const t = e.timeMs || parseFfDate(e.date) || Date.parse(e.date);
    return Number.isFinite(t) && t >= lo && t <= hi;
  });
}

function normalizeImpact(raw: string): NewsImpact {
  const s = (raw || '').trim();
  if (/high/i.test(s)) return 'High';
  if (/medium|med/i.test(s)) return 'Medium';
  if (/low/i.test(s)) return 'Low';
  if (/holiday/i.test(s)) return 'Holiday';
  return 'Unknown';
}

function isGoldRelevant(title: string, currency: string, impact: NewsImpact): boolean {
  const t = title.toLowerCase();
  if (currency === 'USD' && (impact === 'High' || impact === 'Medium')) return true;
  if (GOLD_KEYWORDS.some((k) => t.includes(k))) return true;
  if (currency === 'CNY' && impact === 'High') return true;
  if ((currency === 'EUR' || currency === 'GBP') && impact === 'High') return true;
  return false;
}

function statusFromMinutes(mins: number): CalendarEvent['status'] {
  if (mins < -30) return 'passed';
  if (mins >= -30 && mins <= 15) return 'live';
  return 'upcoming';
}

function makeId(row: { title: string; country: string; timeMs: number }) {
  const dayKey = Number.isFinite(row.timeMs)
    ? new Date(row.timeMs).toISOString().slice(0, 10)
    : 'na';
  return `${row.country}_${dayKey}_${row.title}`.replace(/\s+/g, '_').slice(0, 120);
}

function withLiveMinutes(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return events.map((e) => {
    const ts =
      e.timeMs ||
      parseFfDate(e.date) ||
      Date.parse(e.date) ||
      0;
    const minutesUntil = ts
      ? Math.round((ts - now) / 60000)
      : e.minutesUntil;
    return {
      ...e,
      timeMs: ts,
      date: ts ? new Date(ts).toISOString() : e.date,
      dateUs: ts ? formatUsEastern(ts) : e.dateUs || '',
      dateVn: ts ? formatVietnam(ts) : e.dateVn || '',
      forecast: normalizeStat(e.forecast),
      previous: normalizeStat(e.previous),
      actual: normalizeStat(e.actual),
      minutesUntil,
      status: statusFromMinutes(minutesUntil),
    };
  });
}

function counts(events: CalendarEvent[]) {
  const up = events.filter((e) => e.status !== 'passed');
  return {
    highImpactUpcoming: up.filter((e) => e.impact === 'High').length,
    usdHighUpcoming: up.filter(
      (e) => e.currency === 'USD' && e.impact === 'High'
    ).length,
  };
}

function wrap(
  events: CalendarEvent[],
  source: string,
  extra: Partial<CalendarSnapshot> = {}
): CalendarSnapshot {
  const live = withLiveMinutes(events);
  // Full tuần: sort theo thời gian, KHÔNG cắt bớt
  live.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
  const c = counts(live);
  const weekKey = extra.weekKey || currentWeekKeyVn();
  return {
    source,
    sourceUrl: 'https://www.forexfactory.com/calendar?week',
    ...extra,
    events: live,
    fetchedAt: extra.fetchedAt || new Date().toISOString(),
    weekLabel: extra.weekLabel || weekLabelVn(),
    weekKey,
    eventCount: live.length,
    highImpactUpcoming: c.highImpactUpcoming,
    usdHighUpcoming: c.usdHighUpcoming,
  };
}

function fromRaw(
  raw: FfRaw[],
  source: string,
  extra?: Partial<CalendarSnapshot>
): CalendarSnapshot {
  const events: CalendarEvent[] = raw
    .map((row) => {
      const title = String(row.title || '').trim();
      const currency = String(row.country || '').trim().toUpperCase();
      const ts = parseFfDate(String(row.date || ''));
      if (!title || ts == null) return null;
      const date = new Date(ts).toISOString();
      const impact = normalizeImpact(String(row.impact || ''));
      const minutesUntil = Math.round((ts - Date.now()) / 60000);
      return {
        id: makeId({ title, country: currency, timeMs: ts }),
        title,
        currency,
        date,
        timeMs: ts,
        dateUs: formatUsEastern(ts),
        dateVn: formatVietnam(ts),
        impact,
        forecast: normalizeStat(row.forecast),
        previous: normalizeStat(row.previous),
        actual: normalizeStat(row.actual),
        minutesUntil,
        goldRelevant: isGoldRelevant(title, currency, impact),
        status: statusFromMinutes(minutesUntil),
      } satisfies CalendarEvent;
    })
    .filter((e): e is CalendarEvent => e != null)
    .sort((a, b) => a.timeMs - b.timeMs);

  return wrap(events, source, extra);
}

function saveMem(snap: CalendarSnapshot, at = Date.now()) {
  mem = { snap, at };
}

function readDisk(): CalendarSnapshot | null {
  try {
    if (!fs.existsSync(DISK_FILE)) return null;
    const j = JSON.parse(fs.readFileSync(DISK_FILE, 'utf8')) as {
      snap: CalendarSnapshot;
      at: number;
    };
    if (!j?.snap?.events?.length) return null;
    // Tuần cũ (weekKey khác Monday VN) → bỏ disk, buộc fetch tuần mới
    if (!isCurrentWeekEvents(j.snap.events, j.snap.weekKey)) return null;
    saveMem(j.snap, j.at);
    return wrap(j.snap.events, j.snap.source, {
      fromCache: true,
      fetchedAt: j.snap.fetchedAt,
      weekKey: j.snap.weekKey,
      warning: `Disk cache tuần ${j.snap.weekKey || weekLabelVn()} — full ${j.snap.events.length} sự kiện.`,
    });
  } catch {
    return null;
  }
}

function writeDisk(snap: CalendarSnapshot) {
  try {
    if (!fs.existsSync(DISK_DIR)) fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      DISK_FILE,
      JSON.stringify({ snap, at: Date.now() }),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

function seed(warning: string, rateLimited = true): CalendarSnapshot {
  const shifted = shiftRawToCurrentWeek(seedRaw as FfRaw[]);
  return fromRaw(shifted, 'Offline seed · tuần hiện tại', {
    fromCache: true,
    rateLimited,
    warning,
  });
}

/** Local ưu tiên: mem (cùng tuần) → disk → seed shift */
function bestLocal(extra?: Partial<CalendarSnapshot>): CalendarSnapshot {
  if (
    mem?.snap?.events?.length &&
    isCurrentWeekEvents(mem.snap.events, mem.snap.weekKey)
  ) {
    return wrap(mem.snap.events, mem.snap.source, {
      fromCache: true,
      fetchedAt: mem.snap.fetchedAt,
      weekKey: mem.snap.weekKey,
      ...extra,
    });
  }
  const d = readDisk();
  if (d && isCurrentWeekEvents(d.events, d.weekKey)) {
    return { ...d, ...extra };
  }
  // mem/disk tuần cũ → seed mới theo ngày
  return seed(
    extra?.warning || 'Seed tuần hiện tại (cache cũ / FF offline).',
    extra?.rateLimited !== false
  );
}

function parseCsv(text: string): FfRaw[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const out: FfRaw[] = [];
  for (let i = 1; i < lines.length; i++) {
    const clean = (lines[i].match(/("([^"]|"")*"|[^,]*)/g) || lines[i].split(',')).map((p) =>
      p.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
    );
    if (clean.length < 4) continue;
    out.push({
      title: clean[0],
      country: clean[1],
      date: clean[2],
      impact: clean[3],
      forecast: clean[4] || '',
      previous: clean[5] || '',
      actual: clean[6] || '',
    });
  }
  return out;
}

async function networkFetch(): Promise<CalendarSnapshot> {
  lastNetworkAt = Date.now();
  const headers = {
    Accept: 'application/json,text/csv,*/*',
    'User-Agent': 'Mozilla/5.0 GoldQuantCalendar/2.0',
  };

  let got429 = false;

  try {
    const res = await fetch(FF_JSON, {
      signal: AbortSignal.timeout(8000),
      headers,
      cache: 'no-store',
    });
    if (res.status === 429) {
      got429 = true;
      blockedUntil = Date.now() + BLOCK_429_MS;
    } else if (res.ok) {
      const raw = (await res.json()) as FfRaw[];
      if (Array.isArray(raw) && raw.length > 0) {
        return fromRaw(raw, 'Forex Factory (JSON live)');
      }
    }
  } catch {
    /* try CSV */
  }

  if (got429) throw new Error('429');

  try {
    const res2 = await fetch(FF_CSV, {
      signal: AbortSignal.timeout(8000),
      headers: { ...headers, Accept: 'text/csv' },
      cache: 'no-store',
    });
    if (res2.status === 429) {
      blockedUntil = Date.now() + BLOCK_429_MS;
      throw new Error('429');
    }
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
    const raw = parseCsv(await res2.text());
    if (!raw.length) throw new Error('empty');
    return fromRaw(raw, 'Forex Factory (CSV live)');
  } catch (e) {
    if (e instanceof Error && e.message === '429') throw e;
    throw e instanceof Error ? e : new Error('network fail');
  }
}

/**
 * Public — NEVER throws.
 * @param force true → bỏ cache tươi, gọi FF lấy full tuần mới (week rollover / cron)
 */
export async function fetchForexFactoryWeek(
  force = false
): Promise<CalendarSnapshot> {
  const now = Date.now();
  const keyNow = currentWeekKeyVn();

  if (!mem) readDisk();

  // Mem tuần cũ → xoá (tự cập nhật tin tuần mới)
  if (mem && !isCurrentWeekEvents(mem.snap.events, mem.snap.weekKey)) {
    mem = null;
  }
  if (mem?.snap?.weekKey && mem.snap.weekKey !== keyNow) {
    mem = null;
  }

  // Force: luôn network (trừ đang 429 block)
  if (force && now >= blockedUntil) {
    try {
      const snap = await networkFetch();
      saveMem(snap);
      writeDisk(snap);
      return wrap(snap.events, snap.source, {
        fetchedAt: snap.fetchedAt,
        weekKey: snap.weekKey || keyNow,
        warning: `Force refresh full tuần · ${snap.events.length} sự kiện.`,
      });
    } catch (e) {
      const is429 = e instanceof Error && e.message === '429';
      if (is429) blockedUntil = Date.now() + BLOCK_429_MS;
      return bestLocal({
        rateLimited: is429,
        warning: is429
          ? 'Force fail 429 — giữ cache/seed tuần hiện tại.'
          : 'Force fail — giữ cache/seed tuần hiện tại.',
      });
    }
  }

  if (
    mem &&
    now - mem.at < FRESH_MS &&
    isCurrentWeekEvents(mem.snap.events, mem.snap.weekKey)
  ) {
    return wrap(mem.snap.events, mem.snap.source, {
      fromCache: true,
      fetchedAt: mem.snap.fetchedAt,
      weekKey: mem.snap.weekKey,
      warning: `Cache tươi full tuần (${mem.snap.events.length} SK) · countdown live.`,
    });
  }

  if (now < blockedUntil || now - lastNetworkAt < NETWORK_COOLDOWN_MS) {
    const wait = Math.max(0, Math.ceil((blockedUntil - now) / 60000));
    return bestLocal({
      rateLimited: now < blockedUntil,
      warning:
        now < blockedUntil
          ? `FF rate-limit. Chờ ~${wait || 1} phút. Cache/seed full tuần.`
          : 'Network cooldown 2 phút — cache/seed full tuần.',
    });
  }

  if (
    mem &&
    now - mem.at < SOFT_MS &&
    isCurrentWeekEvents(mem.snap.events, mem.snap.weekKey)
  ) {
    if (
      !inflight &&
      now >= blockedUntil &&
      now - lastNetworkAt >= NETWORK_COOLDOWN_MS
    ) {
      inflight = networkFetch()
        .then((snap) => {
          saveMem(snap);
          writeDisk(snap);
          return snap;
        })
        .catch((e) => {
          const is429 = e instanceof Error && e.message === '429';
          if (is429) blockedUntil = Date.now() + BLOCK_429_MS;
          return bestLocal({
            rateLimited: is429,
            warning: is429
              ? 'HTTP 429 nền — chặn FF 30 phút.'
              : 'Refresh nền fail — giữ cache tuần này.',
          });
        })
        .finally(() => {
          inflight = null;
        });
    }
    return wrap(mem.snap.events, mem.snap.source, {
      fromCache: true,
      fetchedAt: mem.snap.fetchedAt,
      weekKey: mem.snap.weekKey,
      warning: `Cache soft full tuần (${mem.snap.events.length} SK) — refresh nền nếu được.`,
    });
  }

  if (inflight) {
    try {
      return await inflight;
    } catch {
      return bestLocal({
        rateLimited: true,
        warning: 'Fetch fail — seed/cache full tuần hiện tại.',
      });
    }
  }

  inflight = (async () => {
    try {
      const snap = await networkFetch();
      saveMem(snap);
      writeDisk(snap);
      return snap;
    } catch (e) {
      const is429 = e instanceof Error && e.message === '429';
      if (is429) blockedUntil = Date.now() + BLOCK_429_MS;
      const local = bestLocal({
        rateLimited: is429,
        warning: is429
          ? 'HTTP 429 — chặn FF 30 phút. Seed/cache full tuần.'
          : 'Không fetch được FF. Seed full tuần hiện tại.',
      });
      saveMem(local, Date.now());
      writeDisk(local);
      return local;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  opts: {
    currency?: string;
    impact?: NewsImpact | 'High|Medium';
    goldOnly?: boolean;
    upcomingOnly?: boolean;
    /** Mặc định không limit — trả full tuần đã lọc */
    limit?: number;
  } = {}
): CalendarEvent[] {
  let list = [...events];
  if (opts.upcomingOnly) list = list.filter((e) => e.status !== 'passed');
  if (opts.currency) {
    const cur = opts.currency.toUpperCase();
    list = list.filter((e) => e.currency === cur);
  }
  if (opts.impact === 'High') list = list.filter((e) => e.impact === 'High');
  else if (opts.impact === 'High|Medium') {
    list = list.filter((e) => e.impact === 'High' || e.impact === 'Medium');
  }
  if (opts.goldOnly) list = list.filter((e) => e.goldRelevant);
  // Chỉ cắt khi caller truyền limit > 0 rõ ràng
  if (opts.limit != null && opts.limit > 0) list = list.slice(0, opts.limit);
  return list;
}

/** Match event tươi nhất theo title + currency (+ gần ngày) */
export function matchCalendarEvent(
  events: CalendarEvent[],
  ref: { id?: string; title: string; currency: string; date?: string }
): CalendarEvent | null {
  if (ref.id) {
    const byId = events.find((e) => e.id === ref.id);
    if (byId) return byId;
  }
  const same = events.filter(
    (e) =>
      e.title.toLowerCase() === ref.title.toLowerCase() &&
      e.currency.toUpperCase() === ref.currency.toUpperCase()
  );
  if (!same.length) return null;
  if (!ref.date) return same[0];
  const refT = parseFfDate(ref.date) ?? Date.parse(ref.date);
  same.sort(
    (a, b) =>
      Math.abs((parseFfDate(a.date) ?? 0) - refT) -
      Math.abs((parseFfDate(b.date) ?? 0) - refT)
  );
  return same[0];
}

export function formatCalendarForAI(snap: CalendarSnapshot, maxEvents = 12): string {
  const focus = filterCalendarEvents(snap.events, {
    upcomingOnly: true,
    goldOnly: true,
    limit: maxEvents,
  });
  const fb = filterCalendarEvents(snap.events, {
    upcomingOnly: true,
    impact: 'High|Medium',
    limit: maxEvents,
  });
  const list = focus.length ? focus : fb;
  if (!list.length) {
    return `[LỊCH KINH TẾ]\n${snap.warning || 'Trống'}\nNguồn: ${snap.source} · ${snap.weekLabel}`;
  }
  const lines = list.map((e) => {
    const when =
      e.minutesUntil >= 0
        ? `còn ${e.minutesUntil}m`
        : `đã qua ${Math.abs(e.minutesUntil)}m`;
    const vn = e.dateVn || formatVietnam(e.timeMs || Date.parse(e.date));
    const us = e.dateUs || formatUsEastern(e.timeMs || Date.parse(e.date));
    const f = e.forecast || '—';
    const p = e.previous || '—';
    const a = e.actual || 'chưa có';
    return `• [${e.impact}] ${e.currency} — ${e.title}\n  VN: ${vn} | US: ${us} · ${when} | F:${f} P:${p} A:${a}${
      e.goldRelevant ? ' ★XAU' : ''
    }`;
  });
  return (
    `[LỊCH KINH TẾ FULL TUẦN${snap.fromCache ? ' · CACHE/SEED' : ''} · ${snap.weekLabel} · key ${snap.weekKey || ''}]\n` +
    `Nguồn: ${snap.source} · ${snap.eventCount || snap.events.length} SK · ${snap.fetchedAt}` +
    (snap.warning ? `\n⚠️ ${snap.warning}` : '') +
    `\nHigh: ${snap.highImpactUpcoming} · USD High: ${snap.usdHighUpcoming}\n` +
    `Giờ: VN=Asia/Ho_Chi_Minh (GMT+7) · US=America/New_York (EST/EDT)\n` +
    lines.join('\n') +
    `\nDùng list này. Cấm bịa tin. Giảm lot quanh High Impact USD.`
  );
}

// Eager boot: disk tuần này hoặc seed shift
try {
  if (!mem) {
    const d = readDisk();
    if (!d) {
      const s = seed('Boot seed — tuần hiện tại. Chờ FF khi hết rate-limit.');
      saveMem(s);
      writeDisk(s);
    }
  }
} catch {
  /* ignore */
}
