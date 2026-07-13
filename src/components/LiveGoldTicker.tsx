'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Quote {
  priceUsd: number;
  source: string;
  updatedAtReadable: string;
  stale?: boolean;
}

/**
 * Ticker XAU luôn hiện trên TopBar — dễ thấy “có hoạt động”.
 */
export default function LiveGoldTicker() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newsCount, setNewsCount] = useState<number | null>(null);

  const loadGold = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const gRes = await fetch(
        `/api/quant/gold-price${force ? '?force=1' : ''}`,
        { cache: 'no-store' }
      );
      const g = await gRes.json();
      if (g?.ok && g.quote?.priceUsd > 0) {
        setQuote({
          priceUsd: g.quote.priceUsd,
          source: g.quote.source,
          updatedAtReadable: g.quote.updatedAtReadable,
          stale: g.quote.stale,
        });
      } else {
        setError('Không lấy được giá');
      }
    } catch {
      setError('Lỗi mạng / API');
    } finally {
      setLoading(false);
    }
  }, []);

  // Calendar count — ít lần hơn (tránh FF 429)
  const loadNewsCount = useCallback(async () => {
    try {
      const cRes = await fetch(
        '/api/quant/calendar?upcoming=1&impact=High&limit=50',
        { cache: 'force-cache' }
      );
      const c = await cRes.json();
      if (c?.ok && Array.isArray(c.events)) {
        setNewsCount(c.events.length);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void loadGold(false);
      void loadNewsCount();
    }, 80);
    // Giá: 60s · Tin: 10 phút (không spam FF)
    const goldIv = window.setInterval(() => void loadGold(false), 60_000);
    const newsIv = window.setInterval(() => void loadNewsCount(), 10 * 60_000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(goldIv);
      window.clearInterval(newsIv);
    };
  }, [loadGold, loadNewsCount]);

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="btn-glass inline-flex items-center gap-2 h-10 px-3 min-w-0 border-neon-yellow/20">
        <TrendingUp className="w-3.5 h-3.5 text-neon-yellow flex-shrink-0 stroke-[1.75]" />
        <div className="flex flex-col justify-center min-w-0 leading-none">
          <span className="text-[8px] font-semibold uppercase tracking-wider text-neon-yellow/70 leading-none">
            XAUUSD
          </span>
          {quote ? (
            <span className="text-[13px] font-semibold font-mono text-neon-yellow tabular-nums leading-none mt-0.5">
              $
              {quote.priceUsd.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          ) : error ? (
            <span className="text-[10px] text-neon-pink font-semibold leading-none mt-0.5">
              {error}
            </span>
          ) : (
            <span className="text-[10px] text-dark-text-muted leading-none mt-0.5">…</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void loadGold(true)}
          disabled={loading}
          className="w-7 h-7 inline-flex items-center justify-center rounded-full text-neon-yellow/80 hover:text-neon-yellow hover:bg-white/5 disabled:opacity-40 pressable flex-shrink-0"
          title="Refresh giá vàng"
        >
          <RefreshCw className={`w-3 h-3 stroke-[1.75] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Link
        href="/news"
        className="hidden md:inline-flex btn-glass items-center justify-center gap-1.5 h-10 px-3 text-[10px] font-semibold text-neon-pink hover:border-neon-pink/40 pressable leading-none"
        title="Economic Calendar"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neon-pink live-dot flex-shrink-0" />
        <span className="leading-none">NEWS {newsCount != null ? newsCount : '—'}</span>
      </Link>
    </div>
  );
}
