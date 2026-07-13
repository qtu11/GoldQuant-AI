/**
 * Gold news alerts — full tuần FF → lọc tin lớn → Telegram trước 5h (catch-up)
 * Phân biệt giờ Mỹ (Eastern) / Việt Nam (GMT+7)
 * Tự force refresh khi đổi tuần (weekKey).
 */

import fs from 'fs';
import path from 'path';
import {
  fetchForexFactoryWeek,
  type CalendarEvent,
  type CalendarSnapshot,
} from './economicCalendar';
import {
  currentWeekKeyVn,
  formatUsEastern,
  formatVietnam,
} from './timezoneUsVn';

export type AlertPhase = 'pre5h' | 'live';

export interface GoldNewsAlert {
  eventId: string;
  title: string;
  currency: string;
  date: string;
  dateUs: string;
  dateVn: string;
  impact: string;
  phase: AlertPhase;
  tier: 'extreme' | 'very_high' | 'high';
  minutesUntil: number;
  hoursUntil: number;
  reason: string;
  tip: string;
  forecast?: string;
  previous?: string;
}

export interface NewsAlertRunResult {
  ok: true;
  checkedAt: string;
  /** In-app + (khi TG OK) Telegram — luôn fill khi có due mới */
  sent: GoldNewsAlert[];
  /** Chỉ Telegram vừa gửi OK */
  telegramSent: GoldNewsAlert[];
  pending: GoldNewsAlert[];
  /** Major ≤48h — client inject digest Notifications */
  digest: GoldNewsAlert[];
  /** Toàn bộ major trong tuần (preview UI) */
  upcomingMajors: GoldNewsAlert[];
  weekEventCount: number;
  majorCount: number;
  weekKey: string;
  weekLabel: string;
  telegramOk: boolean;
  telegramConfigured: boolean;
  source: string;
  weekRollover?: boolean;
  message?: string;
}

const DISK_DIR = path.join(process.cwd(), '.data');
const SENT_FILE = path.join(DISK_DIR, 'news-alerts-sent.json');
const WEEK_META_FILE = path.join(DISK_DIR, 'news-alerts-week.json');

/**
 * Pre-5h: khi còn ≤ 5h (300m) và còn > 30m → gửi 1 lần (catch-up).
 * LIVE: −15m → +25m quanh giờ công bố.
 */
const PRE5H_MAX_MIN = 300;
const PRE5H_MIN_MIN = 30;
const LIVE_MIN = -15;
const LIVE_MAX = 25;
/** Digest in-app: major trong 48h tới */
const DIGEST_MAX_MIN = 48 * 60;

const FORCE_REFRESH_MS = 45 * 60 * 1000;

interface SentStore {
  /** app::eventId::phase | tg::eventId::phase | digest::eventId */
  keys: string[];
  weekKey: string;
  updatedAt: string;
}

function readSent(weekKey: string): Set<string> {
  try {
    if (!fs.existsSync(SENT_FILE)) return new Set();
    const j = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')) as SentStore;
    if (j.weekKey && j.weekKey !== weekKey) return new Set();
    return new Set(Array.isArray(j.keys) ? j.keys.slice(-600) : []);
  } catch {
    return new Set();
  }
}

function writeSent(keys: Set<string>, weekKey: string) {
  try {
    if (!fs.existsSync(DISK_DIR)) fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      SENT_FILE,
      JSON.stringify(
        {
          keys: Array.from(keys).slice(-600),
          weekKey,
          updatedAt: new Date().toISOString(),
        } satisfies SentStore,
        null,
        0
      ),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

function appKey(eventId: string, phase: AlertPhase) {
  return `app::${eventId}::${phase}`;
}
function tgKey(eventId: string, phase: AlertPhase) {
  return `tg::${eventId}::${phase}`;
}
function digestKey(eventId: string) {
  return `digest::${eventId}`;
}

function readLastFetchMeta(): { weekKey: string; at: number } | null {
  try {
    if (!fs.existsSync(WEEK_META_FILE)) return null;
    return JSON.parse(fs.readFileSync(WEEK_META_FILE, 'utf8')) as {
      weekKey: string;
      at: number;
    };
  } catch {
    return null;
  }
}

function writeLastFetchMeta(weekKey: string) {
  try {
    if (!fs.existsSync(DISK_DIR)) fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      WEEK_META_FILE,
      JSON.stringify({ weekKey, at: Date.now() }),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

/** Phân loại tin vàng lớn theo chu kỳ Mỹ */
export function classifyGoldMajor(ev: CalendarEvent): {
  tier: GoldNewsAlert['tier'];
  reason: string;
  tip: string;
} | null {
  const t = `${ev.title}`.toLowerCase();
  const cur = (ev.currency || '').toUpperCase();
  const impact = ev.impact;

  if (cur !== 'USD' && !(cur === 'CNY' && impact === 'High')) {
    if (
      (cur === 'EUR' || cur === 'GBP') &&
      impact === 'High' &&
      /(rate|ecb|boe|interest)/i.test(t)
    ) {
      return {
        tier: 'high',
        reason: `${cur} lãi suất High Impact — spillover XAU`,
        tip: 'Giảm lot / tránh entry mới ±30 phút quanh tin.',
      };
    }
    return null;
  }

  if (
    /non-?farm|nonfarm|nfp|payrolls?/i.test(t) ||
    /fomc|federal funds|interest rate decision|fed interest/i.test(t) ||
    /powell|fed chair|fomc press/i.test(t)
  ) {
    const isNfp = /non-?farm|nonfarm|nfp|payrolls?/i.test(t);
    return {
      tier: 'extreme',
      reason: isNfp
        ? 'NFP — Thứ Sáu đầu tháng · biến động XAU cực mạnh'
        : 'FOMC / Fed — lãi suất & Dot-plot (3/6/9/12 quan trọng nhất)',
      tip: isNfp
        ? 'Tuần 1 tháng: tránh scale-in trước NFP; giảm size 30–50% nếu hold.'
        : 'Tránh entry mới ±30–60 phút; quét 2 đầu thường gặp quanh FOMC.',
    };
  }

  if (
    /\bcpi\b|consumer price/i.test(t) ||
    /\bppi\b|producer price/i.test(t) ||
    /\bpce\b|core pce|personal consumption/i.test(t) ||
    /core inflation|core cpi|core ppi/i.test(t)
  ) {
    return {
      tier: 'very_high',
      reason: 'Lạm phát (CPI/PPI/PCE) — định hình kỳ vọng Fed & giá vàng',
      tip: 'Thường thứ 5 tuần 2–4; siết risk, ưu tiên flat trước tin đỏ.',
    };
  }

  if (
    /\badp\b/i.test(t) ||
    /jolt/i.test(t) ||
    /\bism\b|manufacturing pmi|services pmi|s&p global pmi/i.test(t) ||
    /unemployment claims|jobless claims|initial claims/i.test(t) ||
    /\bgdp\b|gross domestic/i.test(t) ||
    /retail sales/i.test(t) ||
    /jackson hole/i.test(t) ||
    /consumer confidence|michigan/i.test(t)
  ) {
    let reason = 'Tin Mỹ quan trọng với XAU (việc làm / PMI / GDP / bán lẻ)';
    if (/claims/i.test(t)) reason = 'Jobless Claims — cố định thứ Năm hàng tuần';
    if (/\bism\b|pmi/i.test(t))
      reason = 'ISM/PMI — thường tuần 1 (khởi động tháng)';
    if (/\bgdp\b/i.test(t)) reason = 'GDP — thường tuần 4';
    if (/jackson hole/i.test(t))
      reason = 'Jackson Hole (cuối T8) — bẻ lái dài hạn XAU';
    return {
      tier: 'high',
      reason,
      tip: 'High Impact: giảm lot; không FOMO ngay sau tin.',
    };
  }

  if (cur === 'USD' && impact === 'High') {
    return {
      tier: 'high',
      reason: 'USD High Impact — flash risk XAU',
      tip: 'Theo dõi spread; tránh oversize quanh giờ công bố.',
    };
  }

  return null;
}

function eventTimeMs(ev: CalendarEvent): number {
  if (ev.timeMs && Number.isFinite(ev.timeMs)) return ev.timeMs;
  const p = Date.parse(ev.date);
  return Number.isFinite(p) ? p : 0;
}

function toAlert(
  ev: CalendarEvent,
  phase: AlertPhase,
  cls: NonNullable<ReturnType<typeof classifyGoldMajor>>
): GoldNewsAlert {
  const ms = eventTimeMs(ev);
  return {
    eventId: ev.id,
    title: ev.title,
    currency: ev.currency,
    date: ev.date,
    dateUs: ev.dateUs || formatUsEastern(ms),
    dateVn: ev.dateVn || formatVietnam(ms),
    impact: ev.impact,
    phase,
    tier: cls.tier,
    minutesUntil: ev.minutesUntil,
    hoursUntil: Math.round((ev.minutesUntil / 60) * 10) / 10,
    reason: cls.reason,
    tip: cls.tip,
    forecast: ev.forecast,
    previous: ev.previous,
  };
}

/**
 * Tin major đến mốc gửi:
 * - pre5h: 30m < remaining ≤ 300m (5h) — gửi 1 lần (catch-up nếu poll trễ)
 * - live: −15m … +25m
 */
export function collectDueAlerts(events: CalendarEvent[]): GoldNewsAlert[] {
  const due: GoldNewsAlert[] = [];
  for (const ev of events) {
    const cls = classifyGoldMajor(ev);
    if (!cls) continue;
    const m = ev.minutesUntil;
    if (m > PRE5H_MIN_MIN && m <= PRE5H_MAX_MIN) {
      due.push(toAlert(ev, 'pre5h', cls));
    } else if (m >= LIVE_MIN && m <= LIVE_MAX) {
      due.push(toAlert(ev, 'live', cls));
    }
  }
  const rank = { extreme: 0, very_high: 1, high: 2 };
  due.sort(
    (a, b) => rank[a.tier] - rank[b.tier] || a.minutesUntil - b.minutesUntil
  );
  return due;
}

/** Toàn bộ major trong full tuần (còn lại hoặc đã qua gần đây) */
export function collectWeekMajors(events: CalendarEvent[]): GoldNewsAlert[] {
  const list: GoldNewsAlert[] = [];
  for (const ev of events) {
    const cls = classifyGoldMajor(ev);
    if (!cls) continue;
    // Full tuần: bỏ tin đã qua > 12h
    if (ev.minutesUntil < -12 * 60) continue;
    const phase: AlertPhase =
      ev.minutesUntil <= LIVE_MAX && ev.minutesUntil >= LIVE_MIN
        ? 'live'
        : 'pre5h';
    list.push(toAlert(ev, phase, cls));
  }
  list.sort((a, b) => a.minutesUntil - b.minutesUntil);
  return list;
}

/** @deprecated alias */
export function collectUpcomingMajors(
  events: CalendarEvent[],
  _withinHours = 168
): GoldNewsAlert[] {
  return collectWeekMajors(events);
}

function tierIcon(tier: GoldNewsAlert['tier']) {
  if (tier === 'extreme') return '🔴';
  if (tier === 'very_high') return '🟠';
  return '🟡';
}

export function formatNewsAlertTelegram(alerts: GoldNewsAlert[]): string {
  if (!alerts.length) return '';
  const lines = alerts.map((a) => {
    const phaseLabel =
      a.phase === 'pre5h'
        ? `⏰ TRƯỚC 5 GIỜ (còn ~${a.hoursUntil}h / ${a.minutesUntil}m)`
        : '🚨 LIVE / SẮP CÔNG BỐ';
    const fpa = [
      a.forecast ? `F: ${a.forecast}` : '',
      a.previous ? `P: ${a.previous}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      `${tierIcon(a.tier)} <b>${a.title}</b> [${a.currency} · ${a.impact}]\n` +
      `${phaseLabel}\n` +
      `🇻🇳 VN (GMT+7): <b>${a.dateVn}</b>\n` +
      `🇺🇸 US (Eastern): <b>${a.dateUs}</b>\n` +
      `📌 ${a.reason}\n` +
      (fpa ? `📊 ${fpa}\n` : '') +
      `💡 ${a.tip}`
    );
  });
  return (
    `🪙 <b>[GoldQuant] Cảnh báo tin XAU</b>\n` +
    `Full tuần · auto 5h trước + LIVE\n` +
    `Giờ: <b>VN GMT+7</b> · <b>US Eastern EST/EDT</b>\n\n` +
    lines.join('\n\n')
  );
}

export async function sendTelegramServer(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return !!data.ok;
  } catch {
    return false;
  }
}

async function loadFullWeek(opts?: {
  force?: boolean;
}): Promise<{ snap: CalendarSnapshot; weekRollover: boolean }> {
  const keyNow = currentWeekKeyVn();
  const meta = readLastFetchMeta();
  const weekRollover = !!(meta?.weekKey && meta.weekKey !== keyNow);
  const stale =
    !meta?.at || Date.now() - meta.at > FORCE_REFRESH_MS || weekRollover;
  const force = !!opts?.force || stale || weekRollover;

  const snap = await fetchForexFactoryWeek(force);
  writeLastFetchMeta(snap.weekKey || keyNow);
  return { snap, weekRollover };
}

/**
 * 1 vòng: full tuần → in-app (luôn) + Telegram (nếu config) + digest 48h
 */
export async function runNewsAlertCheck(opts?: {
  dryRun?: boolean;
  force?: boolean;
}): Promise<NewsAlertRunResult> {
  const dryRun = !!opts?.dryRun;
  const { snap, weekRollover } = await loadFullWeek({ force: opts?.force });
  const weekKey = snap.weekKey || currentWeekKeyVn();

  const allEvents = snap.events || [];
  const due = collectDueAlerts(allEvents);
  const upcomingMajors = collectWeekMajors(allEvents);

  const keys = readSent(weekKey);

  // In-app: due chưa push app
  const pendingApp = due.filter(
    (a) => !keys.has(appKey(a.eventId, a.phase))
  );
  // Telegram: due chưa gửi TG
  const pendingTg = due.filter(
    (a) => !keys.has(tgKey(a.eventId, a.phase))
  );

  // Digest: major 0 < t ≤ 48h, chưa digest
  const digestCandidates = upcomingMajors.filter(
    (a) =>
      a.minutesUntil > 0 &&
      a.minutesUntil <= DIGEST_MAX_MIN &&
      !keys.has(digestKey(a.eventId))
  );
  // Ưu tiên extreme / very_high, tối đa 8
  const rank = { extreme: 0, very_high: 1, high: 2 };
  const digestReady = [...digestCandidates]
    .sort(
      (a, b) =>
        rank[a.tier] - rank[b.tier] || a.minutesUntil - b.minutesUntil
    )
    .slice(0, 8);

  const telegramConfigured = !!(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );
  let telegramOk = false;
  const telegramSent: GoldNewsAlert[] = [];
  const justInApp: GoldNewsAlert[] = [];
  const justDigest: GoldNewsAlert[] = [];

  if (!dryRun) {
    // 1) In-app luôn — không phụ thuộc Telegram
    pendingApp.forEach((a) => {
      keys.add(appKey(a.eventId, a.phase));
      justInApp.push(a);
    });

    // 2) Digest (info) — lần đầu thấy tin trong 48h
    digestReady.forEach((a) => {
      keys.add(digestKey(a.eventId));
      justDigest.push(a);
    });

    // 3) Telegram độc lập
    if (pendingTg.length && telegramConfigured) {
      const msg = formatNewsAlertTelegram(pendingTg);
      telegramOk = await sendTelegramServer(msg);
      if (telegramOk) {
        pendingTg.forEach((a) => {
          keys.add(tgKey(a.eventId, a.phase));
          telegramSent.push(a);
        });
      }
    } else if (pendingTg.length && !telegramConfigured) {
      // Không có TG: đánh dấu tg key để không retry vô hạn; in-app đã cover
      pendingTg.forEach((a) => keys.add(tgKey(a.eventId, a.phase)));
    }

    writeSent(keys, weekKey);
  } else if (weekRollover) {
    writeSent(keys, weekKey);
  }

  const sent = dryRun ? pendingApp : justInApp;

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    sent,
    telegramSent: dryRun ? [] : telegramSent,
    pending: dryRun ? pendingApp : pendingApp.filter((a) => !justInApp.includes(a)),
    digest: dryRun ? digestReady : justDigest,
    upcomingMajors,
    weekEventCount: allEvents.length,
    majorCount: upcomingMajors.length,
    weekKey,
    weekLabel: snap.weekLabel,
    telegramOk,
    telegramConfigured,
    source: snap.source,
    weekRollover,
    message: weekRollover
      ? `Đã chuyển tuần mới (${weekKey}) · ${allEvents.length} SK`
      : justInApp.length || justDigest.length
        ? `Notifications: ${justInApp.length} cảnh báo + ${justDigest.length} tin sắp tới` +
          (telegramSent.length ? ` · TG ${telegramSent.length}` : '')
        : pendingApp.length === 0 && digestReady.length === 0
          ? `Full tuần ${allEvents.length} SK · ${upcomingMajors.length} major · chưa có tin mới cần báo`
          : dryRun
            ? `Preview: ${pendingApp.length} due · ${digestReady.length} digest (48h)`
            : undefined,
  };
}
