'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import NewsEventDetailModal, {
  type NewsEventDetail,
} from './NewsEventDetailModal';

interface CalEvent {
  id: string;
  title: string;
  currency: string;
  date: string;
  dateUs?: string;
  dateVn?: string;
  timeMs?: number;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
  minutesUntil: number;
  goldRelevant: boolean;
  status: 'upcoming' | 'live' | 'passed';
}

interface CalResponse {
  ok: boolean;
  events: CalEvent[];
  source?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  weekLabel?: string;
  weekKey?: string;
  totalWeek?: number;
  eventCount?: number;
  highImpactUpcoming?: number;
  usdHighUpcoming?: number;
  error?: string;
  warning?: string;
  fromCache?: boolean;
  rateLimited?: boolean;
  hint?: string;
}

/** Countdown live phía client (không đợi poll API) */
function withClientCountdown(list: CalEvent[]): CalEvent[] {
  return list.map((e) => {
    const ts = Date.parse(e.date);
    const minutesUntil = Number.isFinite(ts)
      ? Math.round((ts - Date.now()) / 60000)
      : e.minutesUntil;
    let status: CalEvent['status'] = 'upcoming';
    if (minutesUntil < -30) status = 'passed';
    else if (minutesUntil >= -30 && minutesUntil <= 15) status = 'live';
    return { ...e, minutesUntil, status };
  });
}

const PAGE_SIZE = 8;

function impactClass(impact: string) {
  if (impact === 'High') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (impact === 'Medium') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-white/5 text-dark-text-muted border-dark-border';
}

function formatWhenVn(e: CalEvent) {
  if (e.dateVn) return e.dateVn;
  try {
    return new Date(e.date).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return e.date;
  }
}

function formatWhenUs(e: CalEvent) {
  if (e.dateUs) return e.dateUs;
  try {
    return new Date(e.date).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

function etaLabel(mins: number, status: string) {
  if (status === 'live') return 'LIVE ±';
  if (mins < 0) return `−${Math.abs(mins)}m`;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? m + 'm' : ''}`;
}

/** Tạo dãy nút trang: 1 2 3 … 8 hoặc 1 … 4 5 6 … 10 */
function buildPageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | '…')[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) items.push('…');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < total - 1) items.push('…');
  items.push(total);
  return items;
}

export default function NewsCalendar() {
  const [data, setData] = useState<CalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [goldOnly, setGoldOnly] = useState(true);
  const [usdOnly, setUsdOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NewsEventDetail | null>(null);
  const [tick, setTick] = useState(0);

  // Full tuần (không limit) — filter gold/USD client-side
  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        upcoming: '0', // cả tuần gồm đã qua
        limit: '0', // full tuần
      });
      if (force) q.set('force', '1');
      const res = await fetch(`/api/quant/calendar?${q}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as CalResponse;
      setData(json);
      setPage(1);
    } catch {
      setData({
        ok: false,
        events: [],
        error: undefined,
        warning: 'Tạm chưa tải lịch — thử Refresh.',
      });
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Lần đầu force=false (dùng cache tuần hiện tại); interval 10p
    // Mỗi giờ force=1 để bắt FF tuần mới khi sang Monday
    void load(false);
    const soft = setInterval(() => void load(false), 10 * 60 * 1000);
    const hard = setInterval(() => void load(true), 60 * 60 * 1000);
    return () => {
      clearInterval(soft);
      clearInterval(hard);
    };
  }, [load]);

  // Countdown ETA mỗi 30s (theo ngày/giờ hiện tại)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Đổi filter → về trang 1
  useEffect(() => {
    setPage(1);
  }, [goldOnly, usdOnly]);

  const events = useMemo(() => {
    void tick; // recompute countdown
    let list = withClientCountdown(data?.events || []);
    if (goldOnly) {
      const gold = list.filter((e) => e.goldRelevant);
      // Ưu tiên data release có F/P; fallback High/Med
      list = gold.length
        ? gold
        : list.filter((e) => e.impact === 'High' || e.impact === 'Medium');
    }
    if (usdOnly) list = list.filter((e) => e.currency === 'USD');
    // Ưu tiên sự kiện còn F/P hiển thị + upcoming trước
    list = [...list].sort((a, b) => {
      const score = (e: CalEvent) =>
        (e.status === 'passed' ? 2 : e.status === 'live' ? 0 : 1) * 1e12 +
        e.minutesUntil * 1000 -
        ((e.forecast || e.previous) ? 1 : 0);
      return score(a) - score(b);
    });
    return list;
  }, [data?.events, goldOnly, usdOnly, tick]);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageEvents = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return events.slice(start, start + PAGE_SIZE);
  }, [events, safePage]);

  const pageItems = useMemo(
    () => buildPageItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    <div className="neon-card-premium neon-card-static kpi-orange h-full flex flex-col p-3.5 overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="icon-tile icon-tile-yellow !w-7 !h-7">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">
              Economic Calendar
            </h4>
            <p className="text-[9px] text-dark-text-muted truncate">
              {data?.weekLabel ? `Tuần ${data.weekLabel} · ` : ''}
              Full {data?.totalWeek ?? data?.eventCount ?? data?.events?.length ?? '—'} SK ·{' '}
              {data?.highImpactUpcoming ?? '—'} High · lọc {events.length}
              {data?.fromCache ? ' · cache' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-yellow"
            title="Mở Forex Factory"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-dark-border text-neon-yellow hover:border-neon-yellow disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setGoldOnly((v) => !v);
            setPage(1);
          }}
          className={`text-[9px] px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${
            goldOnly
              ? 'border-neon-yellow/50 text-neon-yellow bg-neon-yellow/10'
              : 'border-dark-border text-dark-text-muted'
          }`}
        >
          <Filter className="w-3 h-3" /> XAU relevant
        </button>
        <button
          type="button"
          onClick={() => {
            setUsdOnly((v) => !v);
            setPage(1);
          }}
          className={`text-[9px] px-2 py-1 rounded-lg border font-bold ${
            usdOnly
              ? 'border-neon-cyan/50 text-neon-cyan bg-neon-cyan/10'
              : 'border-dark-border text-dark-text-muted'
          }`}
        >
          USD only
        </button>
      </div>

      {!data?.ok && data?.error && (
        <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 mb-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {data.error}
            {data.hint ? ` — ${data.hint}` : ''}
          </span>
        </div>
      )}

      {data?.ok && (data.rateLimited || data.warning) && (
        <div className="flex items-start gap-2 text-[10px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {data.warning || 'Đang dùng cache (tránh HTTP 429).'}
            {data.fromCache ? ' · Cache' : ''}
          </span>
        </div>
      )}

      {/* Event list — dense, fill height, scroll nếu dài */}
      <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden min-h-0">
        {loading && !events.length && <div className="shimmer h-12 rounded-xl" />}
        {data?.ok && events.length === 0 && (
          <p className="text-xs text-dark-text-muted text-center py-6">
            Không có sự kiện khớp filter trong tuần này.
          </p>
        )}
        {pageEvents.map((e) => (
          <button
            type="button"
            key={e.id}
            onClick={() => setSelected(e)}
            className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer hover:border-neon-cyan/50 hover:bg-dark-card-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon-cyan/50 ${
              e.status === 'live'
                ? 'border-neon-pink/50 bg-neon-pink/10'
                : e.goldRelevant
                  ? 'border-neon-yellow/20 bg-dark-card'
                  : 'border-dark-border bg-dark-card/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-mono font-bold text-neon-cyan text-[11px]">
                    {e.currency}
                  </span>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded border font-bold ${impactClass(e.impact)}`}
                  >
                    {e.impact}
                  </span>
                  {e.goldRelevant && (
                    <span className="text-[8px] text-neon-yellow font-bold">★XAU</span>
                  )}
                  {e.status === 'live' && (
                    <span className="text-[8px] text-neon-pink font-black animate-pulse">
                      LIVE
                    </span>
                  )}
                  <span className="text-[10px] text-white font-semibold truncate max-w-[min(100%,280px)]">
                    {e.title}
                  </span>
                </div>
                <p
                  className="text-[9px] text-dark-text-muted mt-0.5 truncate"
                  title={`${formatWhenVn(e)} | ${formatWhenUs(e)}`}
                >
                  🇻🇳 {formatWhenVn(e)}
                  <span className="text-white/20 mx-1">·</span>
                  🇺🇸 {formatWhenUs(e)}
                </p>
              </div>
              <div className="text-right flex-shrink-0 pl-1">
                <span
                  className={`font-mono text-[10px] font-bold block ${
                    e.status === 'live' ? 'text-neon-pink' : 'text-neon-purple'
                  }`}
                >
                  {etaLabel(e.minutesUntil, e.status)}
                </span>
                <p className="text-[8px] text-dark-text-muted font-mono mt-0.5 whitespace-nowrap">
                  F:{e.forecast || '—'} P:{e.previous || '—'}
                  {e.actual ? ` A:${e.actual}` : ''}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Pagination: < 1 2 … > */}
      {events.length > 0 && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-dark-border/60 flex-shrink-0">
          <span className="text-[9px] text-dark-text-muted font-mono">
            {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, events.length)} / {events.length}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goPage(safePage - 1)}
              disabled={safePage <= 1}
              className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-cyan hover:border-neon-cyan/40 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {pageItems.map((item, idx) =>
              item === '…' ? (
                <span
                  key={`e-${idx}`}
                  className="w-7 text-center text-[10px] text-dark-text-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goPage(item)}
                  className={`min-w-7 h-7 px-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    item === safePage
                      ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(0,212,255,0.25)]'
                      : 'border-dark-border text-dark-text-muted hover:text-white hover:border-white/20'
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => goPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-cyan hover:border-neon-cyan/40 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <p className="text-[9px] text-dark-text-muted mt-1.5 flex-shrink-0">
        Nguồn: Forex Factory · {PAGE_SIZE}/trang · Bấm tin để xem AI impact
      </p>

      <NewsEventDetailModal
        event={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
