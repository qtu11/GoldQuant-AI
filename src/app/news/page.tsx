'use client';

import React from 'react';
import NewsCalendar from '../../components/NewsCalendar';
import NewsAlertPanel from '../../components/NewsAlertPanel';
import { CalendarDays, BookOpen } from 'lucide-react';

export default function NewsPage() {
  return (
    <div className="space-y-4 animate-in pb-2">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-neon-yellow" />
          Economic <span className="neon-gradient-text">News</span>
        </h2>
        <p className="text-[11px] text-dark-text-muted mt-1">
          Full tuần FF · cảnh báo XAU <strong className="text-neon-yellow">trước 5h</strong> + LIVE
          · Telegram · 🇻🇳 VN / 🇺🇸 US Eastern
        </p>
      </div>

      {/* 2 cột cao đều, không min-h ảo tạo khoảng trống */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch">
        <div className="xl:col-span-3 min-h-[520px] max-h-[min(72vh,720px)]">
          <NewsCalendar />
        </div>
        <div className="xl:col-span-2 min-h-[520px] max-h-[min(72vh,720px)]">
          <NewsAlertPanel />
        </div>
      </div>

      {/* Chu kỳ + nguồn — compact 1 hàng */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="neon-card-premium neon-card-static p-4 kpi-purple space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-neon-purple" />
            <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
              Chu kỳ tin Mỹ → XAU
            </h3>
          </div>
          <p className="text-[11px] text-dark-text-muted leading-relaxed">
            <strong className="text-white">T2</strong> êm ·{' '}
            <strong className="text-white">T3–T4</strong> PMI/JOLTs ·{' '}
            <strong className="text-neon-yellow">T5</strong> Claims/CPI/PPI/PCE ·{' '}
            <strong className="text-rose-300">T6</strong> NFP (T6 đầu tháng).
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            {[
              { w: '1', t: 'ISM · NFP', s: 'Cực mạnh', c: 'text-rose-300' },
              { w: '2', t: 'CPI · PPI', s: 'Rất mạnh', c: 'text-orange-300' },
              { w: '3', t: 'Retail', s: 'Mạnh', c: 'text-neon-yellow' },
              { w: '4', t: 'GDP · PCE', s: 'Mạnh+', c: 'text-orange-300' },
            ].map((r) => (
              <div
                key={r.w}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center"
              >
                <div className="font-mono text-neon-cyan font-bold">T{r.w}</div>
                <div className="text-white/80 truncate">{r.t}</div>
                <div className={`${r.c} font-semibold`}>{r.s}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-dark-text-muted leading-relaxed">
            FOMC 8×/năm (3/6/9/12 + Dot-plot) · T8 Jackson Hole · 20/12–đầu T1 low liquidity
          </p>
        </div>

        <div className="neon-card-premium neon-card-static p-4 kpi-cyan space-y-2">
          <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
            Nguồn & cấu hình
          </h3>
          <ul className="text-[11px] text-dark-text-muted space-y-1 leading-relaxed list-disc pl-4">
            <li>
              Live:{' '}
              <code className="text-[10px] text-neon-cyan">
                nfs.faireconomy.media/ff_calendar_thisweek.json
              </code>
            </li>
            <li>
              Cảnh báo: ≤ <strong className="text-white">5h</strong> + LIVE · poll 60s / 3p tab ẩn
            </li>
            <li>
              Env: <code className="text-neon-yellow">TELEGRAM_BOT_TOKEN</code> +{' '}
              <code className="text-neon-yellow">TELEGRAM_CHAT_ID</code>
            </li>
          </ul>
          <a
            href="https://www.forexfactory.com/calendar?week"
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] text-neon-yellow font-bold hover:underline"
          >
            Forex Factory Calendar →
          </a>
        </div>
      </div>
    </div>
  );
}
