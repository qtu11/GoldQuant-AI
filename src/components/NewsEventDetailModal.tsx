'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  ExternalLink,
  Clock,
  TrendingUp,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { renderMarkdownLite } from '../utils/markdownLite';

export interface NewsEventDetail {
  id: string;
  title: string;
  currency: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
  minutesUntil: number;
  goldRelevant: boolean;
  status: 'upcoming' | 'live' | 'passed';
}

interface Props {
  event: NewsEventDetail | null;
  onClose: () => void;
}

function impactClass(impact: string) {
  if (impact === 'High') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (impact === 'Medium') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-white/5 text-dark-text-muted border-dark-border';
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function etaText(mins: number, status: string) {
  if (status === 'live') return 'Đang trong cửa sổ release (±15–30 phút)';
  if (mins < 0) {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    return h > 0 ? `Đã qua ${h}h ${m}m` : `Đã qua ${m} phút`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `Còn khoảng ${h}h ${m}m` : `Còn khoảng ${m} phút`;
}

function isSpeechEvent(title: string) {
  return /speak|speech|address|testimony|remarks|press conference/i.test(title || '');
}

function displayStat(
  value: string | undefined,
  kind: 'forecast' | 'previous' | 'actual',
  e: NewsEventDetail
): { text: string; muted: boolean } {
  const v = (value || '').trim();
  if (v) return { text: v, muted: false };

  if (isSpeechEvent(e.title)) {
    return {
      text: kind === 'actual' ? '—' : 'N/A (diễn thuyết)',
      muted: true,
    };
  }

  if (kind === 'actual') {
    if (e.status === 'passed') return { text: 'Chưa công bố', muted: true };
    if (e.status === 'live') return { text: 'Đang chờ…', muted: true };
    return { text: 'Chờ release', muted: true };
  }

  return { text: 'Chưa có số', muted: true };
}

function liveMinutes(dateIso: string): {
  minutesUntil: number;
  status: NewsEventDetail['status'];
} {
  const ts = Date.parse(dateIso);
  const minutesUntil = Number.isFinite(ts)
    ? Math.round((ts - Date.now()) / 60000)
    : 99999;
  let status: NewsEventDetail['status'] = 'upcoming';
  if (minutesUntil < -30) status = 'passed';
  else if (minutesUntil >= -30 && minutesUntil <= 15) status = 'live';
  return { minutesUntil, status };
}

function buildAnalysisPrompt(e: NewsEventDetail, goldPrice?: number): string {
  const px =
    goldPrice != null && goldPrice > 0
      ? `$${goldPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'N/A';
  return (
    `Phân tích chi tiết sự kiện kinh tế sau cho Chủ tịch Tú (tiếng Việt, Markdown đầy đủ, KHÔNG cắt giữa câu):\n\n` +
    `### Sự kiện\n` +
    `- Tên: ${e.title}\n` +
    `- Đồng tiền: ${e.currency}\n` +
    `- Impact (FF): ${e.impact}\n` +
    `- Thời gian (ISO): ${e.date}\n` +
    `- Forecast: ${e.forecast || 'N/A'}\n` +
    `- Previous: ${e.previous || 'N/A'}\n` +
    `- Actual: ${e.actual || 'Chưa có / N/A'}\n` +
    `- Trạng thái: ${e.status}\n` +
    `- Giá XAUUSD live: ${px}\n` +
    `\n### Cấu trúc bắt buộc (viết đủ 6 mục, mỗi mục 2–4 câu):\n` +
    `1. **Giải thích ngắn** sự kiện này là gì.\n` +
    `2. **Kịch bản số liệu** Actual vs Forecast (nếu diễn thuyết: nói rõ không có F/P).\n` +
    `3. **Tác động XAUUSD** bias + mức độ + cơ chế.\n` +
    `4. **EURUSD / GBPUSD / USDJPY** (mỗi cặp 1–2 câu).\n` +
    `5. **Gợi ý risk** cho gold scalper (lot / cửa sổ phút).\n` +
    `6. **Disclaimer** không phải lời khuyên đầu tư.\n` +
    `Dùng bullet, **in đậm** kết luận. Viết trọn bài.`
  );
}



export default function NewsEventDetailModal({ event, onClose }: Props) {
  const [live, setLive] = useState<NewsEventDetail | null>(event);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goldPrice, setGoldPrice] = useState<number | null>(null);
  const [weekLabel, setWeekLabel] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc đóng
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  // Countdown live
  useEffect(() => {
    if (!event) {
      setLive(null);
      return;
    }
    const tick = () => {
      setLive((prev) => {
        const base = prev && prev.id === event.id ? prev : event;
        const { minutesUntil, status } = liveMinutes(base.date);
        return { ...base, minutesUntil, status };
      });
    };
    tick();
    const iv = window.setInterval(tick, 30_000);
    return () => window.clearInterval(iv);
  }, [event]);

  /** Làm mới F/P/A + tuần hiện tại từ calendar API */
  const refreshEventData = useCallback(
    async (base: NewsEventDetail): Promise<NewsEventDetail> => {
      setRefreshing(true);
      try {
        const [calRes, goldRes] = await Promise.all([
          fetch('/api/quant/calendar?upcoming=0&limit=200', { cache: 'no-store' }),
          fetch('/api/quant/gold-price', { cache: 'no-store' }),
        ]);
        const cal = await calRes.json();
        const g = await goldRes.json();

        if (g?.quote?.priceUsd > 0) setGoldPrice(g.quote.priceUsd as number);
        if (cal?.weekLabel) setWeekLabel(String(cal.weekLabel));
        if (cal?.source) setDataSource(String(cal.source));
        if (cal?.fetchedAt) setFetchedAt(String(cal.fetchedAt));

        const list = Array.isArray(cal?.events)
          ? (cal.events as NewsEventDetail[])
          : [];
        const found =
          list.find((e) => e.id === base.id) ||
          list.find(
            (e) =>
              e.title.toLowerCase() === base.title.toLowerCase() &&
              e.currency.toUpperCase() === base.currency.toUpperCase() &&
              e.date.slice(0, 10) === base.date.slice(0, 10)
          ) ||
          list.find(
            (e) =>
              e.title.toLowerCase() === base.title.toLowerCase() &&
              e.currency.toUpperCase() === base.currency.toUpperCase()
          );

        if (found) {
          const { minutesUntil, status } = liveMinutes(found.date);
          const next: NewsEventDetail = {
            ...found,
            forecast: found.forecast || '',
            previous: found.previous || '',
            actual: found.actual || '',
            minutesUntil,
            status,
          };
          setLive(next);
          return next;
        }

        const { minutesUntil, status } = liveMinutes(base.date);
        const next = { ...base, minutesUntil, status };
        setLive(next);
        return next;
      } catch {
        const { minutesUntil, status } = liveMinutes(base.date);
        const next = { ...base, minutesUntil, status };
        setLive(next);
        return next;
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  const runAnalysis = async (e: NewsEventDetail) => {
    setLoading(true);
    setError(null);
    try {
      let px = goldPrice ?? undefined;
      if (px == null) {
        try {
          const gRes = await fetch('/api/quant/gold-price?force=1', {
            cache: 'no-store',
          });
          const g = await gRes.json();
          if (g?.ok && g.quote?.priceUsd > 0) {
            px = g.quote.priceUsd as number;
            setGoldPrice(px ?? null);
          }
        } catch {
          /* optional */
        }
      }

      const res = await fetch('/api/quant/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildAnalysisPrompt(e, px),
          history: [],
          portfolioContext: '',
        }),
      });
      const data = await res.json();
      if (data.market?.priceUsd) setGoldPrice(data.market.priceUsd);
      if (!data.reply) throw new Error('AI không trả lời');
      setAnalysis(String(data.reply));
      // Cuộn lên đầu bài phân tích khi có reply mới
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không phân tích được');
      setAnalysis(
        `### Nhận định nhanh (offline fallback)\n\n` +
          `Sự kiện **${e.title}** (${e.currency}, impact **${e.impact}**).\n\n` +
          `- **Forecast**: ${e.forecast || 'N/A'} · **Previous**: ${e.previous || 'N/A'} · **Actual**: ${e.actual || 'chưa có'}\n` +
          `- **XAUUSD**: Tin ${e.currency} High/Med thường làm biến động DXY & real yield → vàng nhạy cảm. ` +
          `Tránh oversize ±15–30 phút quanh release.\n` +
          `- **EURUSD / GBPUSD**: Phụ thuộc surprise Actual vs Forecast; USD mạnh → EUR/GBP yếu.\n` +
          `- **USDJPY**: Theo USD + risk sentiment / yields.\n\n` +
          `6. **Disclaimer**: không phải lời khuyên đầu tư chắc chắn.\n\n` +
          `_Bật GEMINI_API_KEY / kiểm tra quota để nhận phân tích AI đầy đủ._`
      );
    } finally {
      setLoading(false);
    }
  };

  // Mở tin → refresh tuần + AI
  useEffect(() => {
    if (!event) return;
    setAnalysis('');
    setError(null);
    setLive(event);
    let cancelled = false;
    void (async () => {
      const fresh = await refreshEventData(event);
      if (cancelled) return;
      await runAnalysis(fresh);
    })();
    const goldIv = window.setInterval(() => {
      void fetch('/api/quant/gold-price')
        .then((r) => r.json())
        .then((g) => {
          if (g?.quote?.priceUsd > 0) setGoldPrice(g.quote.priceUsd);
        })
        .catch(() => {});
    }, 45_000);
    const dataIv = window.setInterval(() => {
      void refreshEventData(event);
    }, 3 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(goldIv);
      window.clearInterval(dataIv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  // Khóa scroll body khi mở modal
  useEffect(() => {
    if (!event) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [event]);

  if (!event || !live || !mounted) return null;

  const fStat = displayStat(live.forecast, 'forecast', live);
  const pStat = displayStat(live.previous, 'previous', live);
  const aStat = displayStat(live.actual, 'actual', live);

  const modal = (
    <div
      className="gq-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
    >
      <div className="gq-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-dark-border flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="font-mono font-black text-neon-cyan text-sm">
                {live.currency}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${impactClass(live.impact)}`}
              >
                {live.impact}
              </span>
              {live.goldRelevant && (
                <span className="text-[10px] text-neon-yellow font-bold">
                  ★ XAU relevant
                </span>
              )}
              {live.status === 'live' && (
                <span className="text-[10px] text-neon-pink font-black animate-pulse">
                  LIVE
                </span>
              )}
              {refreshing && (
                <span className="text-[9px] text-dark-text-muted flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cập nhật tuần…
                </span>
              )}
            </div>
            <h3
              id="news-modal-title"
              className="text-base font-black text-white leading-snug break-words"
            >
              {live.title}
            </h3>
            <p className="text-[11px] text-dark-text-muted mt-1 flex items-start gap-1.5 flex-wrap">
              <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {formatWhen(live.date)} (VN) · {etaText(live.minutesUntil, live.status)}
              </span>
            </p>
            {(weekLabel || dataSource) && (
              <p className="text-[9px] text-dark-text-muted mt-0.5 font-mono break-all">
                Tuần {weekLabel || '—'}
                {dataSource ? ` · ${dataSource}` : ''}
                {fetchedAt
                  ? ` · sync ${new Date(fetchedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-dark-border text-dark-text-muted hover:text-white flex-shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 border-b border-dark-border flex-shrink-0">
          {(
            [
              ['Forecast', fStat, 'text-neon-cyan'],
              ['Previous', pStat, 'text-white'],
              ['Actual', aStat, 'text-neon-green'],
            ] as const
          ).map(([label, st, cls]) => (
            <div
              key={label}
              className="rounded-xl bg-dark-card border border-dark-border p-2.5 min-w-0"
            >
              <span className="text-[9px] text-dark-text-muted uppercase font-bold block">
                {label}
              </span>
              <span
                className={`font-mono font-black text-sm break-words ${
                  st.muted ? 'text-dark-text-muted text-[11px]' : cls
                }`}
              >
                {st.text}
              </span>
            </div>
          ))}
          <div className="rounded-xl bg-dark-card border border-dark-border p-2.5 min-w-0">
            <span className="text-[9px] text-dark-text-muted uppercase font-bold block">
              XAUUSD
            </span>
            <span className="font-mono font-black text-neon-yellow text-sm flex items-center gap-1">
              <TrendingUp className="w-3 h-3 flex-shrink-0" />
              {goldPrice
                ? `$${goldPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : '…'}
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-dark-border/80 flex-shrink-0">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-neon-purple flex-shrink-0" />
            <span className="truncate">AI nhận định · XAU / EUR / majors</span>
          </h4>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => void refreshEventData(live)}
              disabled={refreshing}
              className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-cyan hover:border-neon-cyan/40 disabled:opacity-40"
              title="Làm mới số liệu tuần hiện tại"
            >
              {refreshing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Số liệu
            </button>
            <button
              type="button"
              onClick={() => void runAnalysis(live)}
              disabled={loading}
              className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Phân tích lại
            </button>
          </div>
        </div>

        {/* BODY — scroll only here */}
        <div ref={scrollRef} className="gq-modal-body">
          {loading && !analysis && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-dark-text-muted text-xs">
              <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
              <p>Đang lấy lịch tuần này + giá live + phân tích AI…</p>
            </div>
          )}

          {error && (
            <div className="flex gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {analysis && (
            <div
              className={`text-sm leading-relaxed text-dark-text-light break-words ${
                loading ? 'opacity-60' : ''
              }`}
              dangerouslySetInnerHTML={{
                __html: renderMarkdownLite(analysis),
              }}
            />
          )}

          {!loading && !analysis && !error && (
            <p className="text-xs text-dark-text-muted text-center py-8">
              Chọn tin → AI phân tích. Bấm «Phân tích lại» nếu trống.
            </p>
          )}

          <div className="h-8" aria-hidden />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-dark-border flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <p className="text-[9px] text-dark-text-muted max-w-[70%]">
            Lịch tuần hiện tại · cuộn vùng giữa để đọc hết AI · Không phải lời khuyên đầu tư
          </p>
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-bold text-neon-yellow flex items-center gap-1 hover:underline"
          >
            Mở FF Calendar <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
