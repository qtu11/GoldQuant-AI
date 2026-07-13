'use client';

/**
 * Poll news-alerts → luôn đẩy vào Notifications (in-app):
 * - sent: cửa sổ ≤5h / LIVE
 * - digest: major trong 48h tới (info)
 * Không phụ thuộc Telegram.
 */

import { useEffect, useRef } from 'react';
import { useTradingStore } from '../store/useTradingStore';

const POLL_VISIBLE_MS = 60_000;
const POLL_HIDDEN_MS = 3 * 60_000;
const BOOT_DELAY_MS = 2_500;

interface AlertItem {
  eventId: string;
  title: string;
  phase: 'pre5h' | 'live';
  tier: string;
  hoursUntil: number;
  minutesUntil: number;
  date: string;
  dateVn?: string;
  dateUs?: string;
  reason?: string;
}

function pushNewsNotifications(
  items: { alert: AlertItem; kind: 'due' | 'digest' }[]
) {
  if (!items.length) return;

  const { notifications } = useTradingStore.getState();
  const stamp = Date.now();
  const fresh: typeof notifications = [];

  items.forEach(({ alert: a, kind }, i) => {
    const icon =
      a.tier === 'extreme' ? '🔴' : a.tier === 'very_high' ? '🟠' : '🟡';
    const when = a.dateVn || a.date;
    if (kind === 'due') {
      const phase =
        a.phase === 'pre5h'
          ? `Còn ~${a.hoursUntil}h (trước 5h)`
          : 'LIVE / sắp công bố';
      fresh.push({
        id: `news_due_${stamp}_${i}_${a.eventId}`,
        accountId: 'news',
        type:
          a.phase === 'live' || a.tier === 'extreme' ? 'critical' : 'warning',
        message: `[Tin XAU ${icon}] ${a.title} · ${phase} · VN ${when}`,
        time: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        read: false,
      });
    } else {
      const eta =
        a.minutesUntil < 60
          ? `${a.minutesUntil}m`
          : `${Math.round(a.hoursUntil * 10) / 10}h`;
      fresh.push({
        id: `news_dig_${stamp}_${i}_${a.eventId}`,
        accountId: 'news',
        type: 'info',
        message: `[Lịch tin ${icon}] ${a.title} · còn ~${eta} · VN ${when}${
          a.reason ? ` · ${a.reason}` : ''
        }`,
        time: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        read: false,
      });
    }
  });

  if (fresh.length) {
    useTradingStore.getState().prependNotifications(fresh);
  }
}

export default function NewsAlertWatcher({ enabled }: { enabled: boolean }) {
  const clientSeenRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    try {
      const raw = sessionStorage.getItem('goldquant_news_client_seen');
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) arr.forEach((k) => clientSeenRef.current.add(k));
      }
    } catch {
      /* ignore */
    }

    const persistSeen = () => {
      try {
        sessionStorage.setItem(
          'goldquant_news_client_seen',
          JSON.stringify(Array.from(clientSeenRef.current).slice(-120))
        );
      } catch {
        /* ignore */
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const hidden =
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden';
      const ms = hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
      timerRef.current = setTimeout(() => {
        void tick().finally(() => scheduleNext());
      }, ms);
    };

    const tick = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;
      try {
        const res = await fetch('/api/quant/news-alerts', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!data?.ok || cancelled) return;

        const sent = (Array.isArray(data.sent) ? data.sent : []) as AlertItem[];
        const digest = (Array.isArray(data.digest)
          ? data.digest
          : []) as AlertItem[];

        const batch: { alert: AlertItem; kind: 'due' | 'digest' }[] = [];

        sent.forEach((a) => {
          const key = `due:${a.eventId}:${a.phase}`;
          if (clientSeenRef.current.has(key)) return;
          clientSeenRef.current.add(key);
          batch.push({ alert: a, kind: 'due' });
        });

        digest.forEach((a) => {
          const key = `dig:${a.eventId}`;
          if (clientSeenRef.current.has(key)) return;
          clientSeenRef.current.add(key);
          batch.push({ alert: a, kind: 'digest' });
        });

        // Fallback: nếu server không trả digest (cache cũ) — client tự lấy từ upcomingMajors
        if (!digest.length && Array.isArray(data.upcomingMajors)) {
          const majors = data.upcomingMajors as AlertItem[];
          majors
            .filter(
              (a) =>
                a.minutesUntil > 0 &&
                a.minutesUntil <= 48 * 60 &&
                !clientSeenRef.current.has(`dig:${a.eventId}`)
            )
            .slice(0, 5)
            .forEach((a) => {
              clientSeenRef.current.add(`dig:${a.eventId}`);
              batch.push({ alert: a, kind: 'digest' });
            });
        }

        if (batch.length) {
          pushNewsNotifications(batch);
          persistSeen();
        }
      } catch {
        /* silent */
      } finally {
        runningRef.current = false;
      }
    };

    const boot = window.setTimeout(() => {
      void tick().finally(() => scheduleNext());
    }, BOOT_DELAY_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current);
        void tick().finally(() => scheduleNext());
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);

  return null;
}
