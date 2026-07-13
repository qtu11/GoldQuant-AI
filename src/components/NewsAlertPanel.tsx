'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface MajorAlert {
  eventId: string;
  title: string;
  currency: string;
  date: string;
  dateUs?: string;
  dateVn?: string;
  impact: string;
  phase: 'pre5h' | 'live';
  tier: 'extreme' | 'very_high' | 'high';
  minutesUntil: number;
  hoursUntil: number;
  reason: string;
  tip: string;
}

interface AlertApi {
  ok: boolean;
  checkedAt?: string;
  upcomingMajors?: MajorAlert[];
  weekEventCount?: number;
  majorCount?: number;
  weekKey?: string;
  telegramConfigured?: boolean;
  telegramOk?: boolean;
  source?: string;
  weekLabel?: string;
  weekRollover?: boolean;
  message?: string;
  sent?: MajorAlert[];
}

function eta(mins: number) {
  if (mins <= 25 && mins >= -15) return 'LIVE';
  if (mins < 0) return `−${Math.abs(mins)}m`;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? `${m}m` : ''}`;
}

function tierBadge(tier: string) {
  if (tier === 'extreme')
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (tier === 'very_high')
    return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
}

export default function NewsAlertPanel() {
  const [data, setData] = useState<AlertApi | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async (dry = true) => {
    setLoading(true);
    try {
      const q = dry ? '?dry=1' : '';
      const res = await fetch(`/api/quant/news-alerts${q}`, { cache: 'no-store' });
      const json = (await res.json()) as AlertApi;
      if (json?.ok) {
        setData(json);
        if (json.message) setStatus(json.message);
      } else {
        setStatus('Lịch tin đang cập nhật…');
      }
    } catch {
      setStatus('Tạm chưa tải được — hệ thống sẽ tự thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const t = window.setInterval(() => void load(true), 90_000);
    return () => window.clearInterval(t);
  }, [load]);

  const majors = data?.upcomingMajors || [];

  return (
    <div className="neon-card-premium p-3.5 kpi-pink space-y-2.5 h-full flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="icon-tile icon-tile-pink !w-7 !h-7">
            <BellRing className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
              Cảnh báo tin XAU · full tuần
            </h3>
            <p className="text-[9px] text-dark-text-muted mt-0.5 truncate">
              Telegram <strong className="text-neon-yellow">≤5h</strong> +{' '}
              <strong className="text-rose-300">LIVE</strong> · 🇻🇳/🇺🇸
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="btn-glass p-2 text-dark-text-muted hover:text-neon-cyan pressable disabled:opacity-50"
          title="Làm mới"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 flex-shrink-0">
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-neon-green/30 bg-neon-green/10 text-neon-green">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {data?.weekEventCount ?? '—'} SK
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-neon-yellow/30 bg-neon-yellow/10 text-neon-yellow">
          {data?.majorCount ?? majors.length} major
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
            data?.telegramConfigured
              ? 'border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan'
              : 'border-white/10 bg-white/5 text-dark-text-muted'
          }`}
        >
          <Zap className="w-2.5 h-2.5" />
          {data?.telegramConfigured ? 'TG OK' : 'Set Telegram env'}
        </span>
        {data?.weekLabel && (
          <span className="text-[9px] text-dark-text-muted font-mono px-1.5 py-0.5">
            {data.weekLabel}
          </span>
        )}
      </div>

      {status && (
        <p className="text-[10px] text-neon-cyan/90 bg-neon-cyan/5 border border-neon-cyan/15 rounded-lg px-2.5 py-1.5 flex-shrink-0 leading-snug">
          {status}
        </p>
      )}

      <div className="flex-1 space-y-1 overflow-y-auto min-h-0 pr-0.5">
        {majors.length === 0 && !loading && (
          <div className="text-center py-6 px-3">
            <Clock className="w-6 h-6 text-dark-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-[11px] text-dark-text-muted leading-relaxed">
              Chưa có major còn lại trong tuần. Hết tuần → tự nạp FF mới.
            </p>
          </div>
        )}

        {majors.map((a) => {
          const in5hWindow = a.minutesUntil > 30 && a.minutesUntil <= 300;
          const live = a.minutesUntil <= 25 && a.minutesUntil >= -15;
          return (
            <div
              key={`${a.eventId}-${a.minutesUntil}`}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 space-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-white truncate min-w-0">
                  {a.title}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${tierBadge(a.tier)}`}
                  >
                    {a.tier === 'very_high' ? 'V.HIGH' : a.tier.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      live ? 'text-rose-400' : 'text-neon-yellow'
                    }`}
                  >
                    {eta(a.minutesUntil)}
                  </span>
                </div>
              </div>
              <p
                className="text-[9px] text-dark-text-muted truncate"
                title={`${a.dateVn || ''} | ${a.dateUs || ''}`}
              >
                🇻🇳 {a.dateVn || '—'}
                <span className="text-white/20 mx-1">·</span>
                🇺🇸 {a.dateUs || '—'}
              </p>
              <p className="text-[9px] text-dark-text-muted/90 truncate" title={a.reason}>
                {a.reason}
              </p>
              {(in5hWindow || live) && (
                <p
                  className={`text-[8px] font-semibold ${
                    live ? 'text-rose-400' : 'text-neon-pink'
                  }`}
                >
                  {live ? '● LIVE window' : '● Cửa sổ ≤5h — Telegram'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-1.5 border-t border-white/5 flex-shrink-0 flex items-center justify-between gap-2">
        <p className="text-[9px] text-dark-text-muted truncate">
          Poll 60s · tuần mới auto ·{' '}
          <code className="text-neon-yellow">weekKey</code>
        </p>
        <a
          href="https://www.forexfactory.com/calendar?week"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-bold text-neon-yellow hover:underline shrink-0"
        >
          FF →
        </a>
      </div>
    </div>
  );
}
