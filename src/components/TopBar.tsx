'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useTradingStore } from '../store/useTradingStore';
import { Bell, Sparkles, Activity, FileDown, Search, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import DailyBriefButton from './DailyBriefButton';
import LiveGoldTicker from './LiveGoldTicker';
import { openWeeklyReport } from '../utils/weeklyReport';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Risk Dashboard', subtitle: 'Tổng quan rủi ro & hiệu suất danh mục' },
  '/owners': { title: 'Owners / PnL', subtitle: 'Lợi nhuận theo chủ sở hữu' },
  '/notifications': { title: 'Notifications', subtitle: 'Cảnh báo realtime từ hệ thống' },
  '/tools': { title: 'Trading Tools', subtitle: 'Position size · Prop · Risk rules' },
  '/news': { title: 'News Calendar', subtitle: 'Forex Factory · tin High Impact · XAU' },
  '/rebate': { title: 'Rebate Calculator', subtitle: 'Ước tính hoàn phí XAUUSD' },
  '/admin': { title: 'Admin Portal', subtitle: 'Quản trị tài khoản & cấu hình AI' },
};

/** Nút / chip header — luôn căn giữa dọc-ngang, cùng chiều cao */
const chip =
  'inline-flex items-center justify-center h-10 gap-1.5 px-3 rounded-full text-[12px] font-semibold leading-none whitespace-nowrap pressable transition-colors';

export default function TopBar() {
  const pathname = usePathname();
  const { notifications, accounts, activeAccountId, setActiveAccount } = useTradingStore();
  const unread = notifications.filter((n) => !n.read).length;
  const meta = PAGE_TITLES[pathname] || { title: 'GoldQuant AI', subtitle: 'Risk Manager Pro' };
  const showOverview = pathname === '/' && !!activeAccountId;

  return (
    <header className="topbar w-full px-3 sm:px-4 md:px-5 min-h-[72px] flex items-center">
      {/* Grid 3 cột: trái | giữa | phải — căn giữa thật */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        {/* LEFT — title */}
        <div className="min-w-0 flex items-center gap-2.5 justify-self-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-base md:text-[17px] font-semibold text-white tracking-tight leading-none truncate">
                {meta.title}
              </h2>
              <span className="hidden sm:inline-flex items-center justify-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-semibold uppercase tracking-wider badge-neon-cyan leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green live-dot flex-shrink-0" />
                <Activity className="w-3 h-3 stroke-[1.75] flex-shrink-0" />
                <span className="leading-none">Live</span>
              </span>
            </div>
            <p className="text-[11px] text-dark-text-muted truncate mt-1 font-medium leading-none">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* CENTER — gold ticker (absolute center on desktop) */}
        <div className="justify-self-center order-last lg:order-none w-full lg:w-auto flex justify-center">
          <LiveGoldTicker />
        </div>

        {/* RIGHT — actions, căn giữa dọc */}
        <div className="justify-self-end flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            type="button"
            className={`hidden md:inline-flex ${chip} w-10 px-0 btn-glass text-dark-text-muted hover:text-neon-cyan`}
            title="Search"
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>(
                'input[type="search"], input[placeholder*="Search"]'
              );
              el?.focus();
            }}
          >
            <Search className="w-4 h-4 stroke-[1.75]" />
          </button>

          <DailyBriefButton />

          <button
            type="button"
            onClick={() => openWeeklyReport(accounts)}
            className={`hidden sm:inline-flex ${chip} btn-glass text-neon-purple hover:text-white`}
            title="Xuất weekly report HTML/PDF"
          >
            <FileDown className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0" />
            <span className="hidden lg:inline leading-none">Report</span>
          </button>

          {showOverview && (
            <button
              type="button"
              onClick={() => setActiveAccount(null)}
              className={`hidden sm:inline-flex ${chip} btn-glass text-neon-cyan border-neon-cyan/25`}
              title="Về Portfolio Overview"
            >
              <LayoutGrid className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0" />
              <span className="leading-none">Overview</span>
            </button>
          )}

          <div
            className={`hidden sm:inline-flex ${chip} btn-glass text-dark-text-muted pointer-events-none`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green pulse-glow-green flex-shrink-0" />
            <span className="text-neon-cyan font-mono leading-none">{accounts.length}</span>
            <span className="leading-none">ACC</span>
          </div>

          <Link
            href="/notifications"
            className={`relative inline-flex ${chip} w-10 px-0 btn-glass text-dark-text-muted hover:text-neon-pink`}
          >
            <Bell className="w-4 h-4 stroke-[1.75]" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-neon-pink text-[9px] font-bold text-dark-bg flex items-center justify-center leading-none pulse-glow-pink">
                {unread}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-2 pl-2 ml-0.5 border-l border-white/10 h-10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-cyan/90 via-neon-purple/90 to-neon-purple flex items-center justify-center text-dark-bg shadow-[0_0_20px_rgba(76,201,255,0.25)] border border-white/20 flex-shrink-0">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="hidden xl:flex flex-col justify-center min-w-0">
              <p className="text-xs font-semibold text-white leading-none">Chủ tịch Tú</p>
              <p className="text-[10px] text-dark-text-muted font-medium leading-none mt-1">
                Pro Trader
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
