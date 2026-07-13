'use client';

import React, { useEffect, useMemo } from 'react';
import { useTradingStore } from '../../store/useTradingStore';
import {
  Bell,
  ShieldAlert,
  Info,
  ShieldCheck,
  Newspaper,
  RefreshCw,
} from 'lucide-react';

function sourceLabel(accountId: string) {
  if (accountId === 'news') return { label: 'Tin tức XAU', tone: 'text-neon-yellow' };
  if (accountId === 'system') return { label: 'Hệ thống', tone: 'text-neon-cyan' };
  return { label: `TK ${accountId}`, tone: 'text-gold' };
}

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead, hydrateNotifications } =
    useTradingStore();

  useEffect(() => {
    hydrateNotifications();
  }, [hydrateNotifications]);

  useEffect(() => {
    // Đánh dấu đã đọc sau khi mở trang (delay nhẹ để user thấy badge)
    const t = window.setTimeout(() => markAllNotificationsRead(), 800);
    return () => window.clearTimeout(t);
  }, [markAllNotificationsRead]);

  const newsCount = useMemo(
    () => notifications.filter((n) => n.accountId === 'news').length,
    [notifications]
  );

  const pullNewsNow = async () => {
    try {
      const res = await fetch('/api/quant/news-alerts', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.ok) return;

      const stamp = Date.now();
      const fresh: {
        id: string;
        accountId: string;
        type: 'warning' | 'info' | 'critical';
        message: string;
        time: string;
        read: boolean;
      }[] = [];

      const time = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      (data.sent || []).forEach(
        (
          a: {
            eventId: string;
            title: string;
            phase: string;
            tier: string;
            hoursUntil: number;
            dateVn?: string;
            date?: string;
          },
          i: number
        ) => {
          const icon =
            a.tier === 'extreme' ? '🔴' : a.tier === 'very_high' ? '🟠' : '🟡';
          const phase =
            a.phase === 'pre5h'
              ? `Còn ~${a.hoursUntil}h (trước 5h)`
              : 'LIVE / sắp công bố';
          fresh.push({
            id: `news_manual_due_${stamp}_${i}_${a.eventId}`,
            accountId: 'news',
            type:
              a.phase === 'live' || a.tier === 'extreme' ? 'critical' : 'warning',
            message: `[Tin XAU ${icon}] ${a.title} · ${phase} · VN ${a.dateVn || a.date}`,
            time,
            read: false,
          });
        }
      );

      (data.digest || []).forEach(
        (
          a: {
            eventId: string;
            title: string;
            tier: string;
            hoursUntil: number;
            minutesUntil: number;
            dateVn?: string;
            date?: string;
            reason?: string;
          },
          i: number
        ) => {
          const icon =
            a.tier === 'extreme' ? '🔴' : a.tier === 'very_high' ? '🟠' : '🟡';
          const eta =
            a.minutesUntil < 60
              ? `${a.minutesUntil}m`
              : `${Math.round(a.hoursUntil * 10) / 10}h`;
          fresh.push({
            id: `news_manual_dig_${stamp}_${i}_${a.eventId}`,
            accountId: 'news',
            type: 'info',
            message: `[Lịch tin ${icon}] ${a.title} · còn ~${eta} · VN ${
              a.dateVn || a.date
            }${a.reason ? ` · ${a.reason}` : ''}`,
            time,
            read: false,
          });
        }
      );

      // Nếu server đã mark hết digest, vẫn show top 5 upcoming để user thấy ngay
      if (
        !fresh.length &&
        Array.isArray(data.upcomingMajors) &&
        data.upcomingMajors.length
      ) {
        data.upcomingMajors
          .filter(
            (a: { minutesUntil: number }) =>
              a.minutesUntil > 0 && a.minutesUntil <= 72 * 60
          )
          .slice(0, 6)
          .forEach(
            (
              a: {
                eventId: string;
                title: string;
                tier: string;
                hoursUntil: number;
                minutesUntil: number;
                dateVn?: string;
                date?: string;
              },
              i: number
            ) => {
              const icon =
                a.tier === 'extreme'
                  ? '🔴'
                  : a.tier === 'very_high'
                    ? '🟠'
                    : '🟡';
              const eta =
                a.minutesUntil < 60
                  ? `${a.minutesUntil}m`
                  : `${Math.round(a.hoursUntil * 10) / 10}h`;
              fresh.push({
                id: `news_preview_${stamp}_${i}_${a.eventId}`,
                accountId: 'news',
                type: 'info',
                message: `[Lịch tin ${icon}] ${a.title} · còn ~${eta} · VN ${
                  a.dateVn || a.date
                }`,
                time,
                read: false,
              });
            }
          );
      }

      if (fresh.length) {
        useTradingStore.getState().prependNotifications(fresh);
      } else {
        useTradingStore.getState().prependNotifications([
          {
            id: `news_empty_${stamp}`,
            accountId: 'news',
            type: 'info',
            message:
              'Chưa có tin major mới trong cửa sổ 5h/LIVE hoặc 48h digest. Xem tab News để theo dõi full tuần.',
            time,
            read: false,
          },
        ]);
      }
    } catch {
      /* silent */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
            Notifications
          </h2>
          <p className="text-xs text-dark-text-muted mt-1 font-medium">
            Cảnh báo risk TK · tin XAU (≤5h / LIVE) · lịch tin 48h
            {newsCount > 0 && (
              <span className="text-neon-yellow"> · {newsCount} tin tức</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void pullNewsNow()}
            className="btn-neon py-2 px-4 text-xs font-semibold flex items-center gap-2 pressable"
          >
            <Newspaper className="w-4 h-4 stroke-[1.75]" />
            <span>Lấy tin XAU ngay</span>
          </button>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="btn-glass py-2 px-4 text-xs font-semibold flex items-center gap-2 pressable hover:text-neon-cyan"
          >
            <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
            <span>Mark all as read</span>
          </button>
        </div>
      </div>

      <div className="neon-card-premium neon-card-static overflow-hidden divide-y divide-white/5">
        {notifications.length > 0 ? (
          notifications.map((n) => {
            const src = sourceLabel(n.accountId);
            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex gap-3 sm:gap-4 transition-all duration-300 glass-row ${
                  n.read
                    ? 'bg-transparent'
                    : 'bg-neon-cyan/[0.04] border-l-2 border-l-neon-cyan/50'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {n.accountId === 'news' ? (
                    <div className="p-2.5 bg-neon-yellow/10 text-neon-yellow rounded-full border border-neon-yellow/20">
                      <Newspaper className="w-5 h-5 stroke-[1.75]" />
                    </div>
                  ) : n.type === 'critical' ? (
                    <div className="p-2.5 bg-neon-pink/10 text-neon-pink rounded-full border border-neon-pink/20">
                      <ShieldAlert className="w-5 h-5 stroke-[1.75]" />
                    </div>
                  ) : n.type === 'warning' ? (
                    <div className="p-2.5 bg-neon-yellow/10 text-neon-yellow rounded-full border border-neon-yellow/20">
                      <ShieldAlert className="w-5 h-5 stroke-[1.75]" />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-neon-cyan/10 text-neon-cyan rounded-full border border-neon-cyan/20">
                      <Info className="w-5 h-5 stroke-[1.75]" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${src.tone}`}>
                      {src.label}
                    </span>
                    <span className="text-[10px] text-dark-text-muted font-mono flex-shrink-0">
                      {n.time}
                    </span>
                  </div>
                  <p className="text-sm text-dark-text-light leading-relaxed">
                    {n.message}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-dark-text-muted flex flex-col items-center justify-center">
            <Bell className="w-12 h-12 text-white/10 mb-3 stroke-[1.25]" />
            <span className="text-sm font-medium">Không có thông báo.</span>
            <button
              type="button"
              onClick={() => void pullNewsNow()}
              className="mt-4 text-xs text-neon-cyan font-semibold hover:underline inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Kéo tin XAU từ lịch tuần này
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
