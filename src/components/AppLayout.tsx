'use client';

import React, { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CreateAccountModal from './CreateAccountModal';
import CreateOwnerModal from './CreateOwnerModal';
import PageTransition from './ui/PageTransition';
import { useRouter } from 'next/navigation';
import { useToolsStore } from '../store/useToolsStore';
import { useTradingStore } from '../store/useTradingStore';
import { useAuthStore } from '../store/useAuthStore';
import LoginPage from './LoginPage';
import NewsAlertWatcher from './NewsAlertWatcher';
import {
  breachKey,
  evaluateRiskRules,
  formatBreachesForTelegram,
} from '../utils/riskRules';
import { sendTelegramAlert } from '../utils/telegram';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateOwnerOpen, setIsCreateOwnerOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  const hydrate = useToolsStore((s) => s.hydrate);
  const riskRules = useToolsStore((s) => s.riskRules);
  const setLastBreachKeys = useToolsStore((s) => s.setLastBreachKeys);
  const accounts = useTradingStore((s) => s.accounts);
  const owners = useTradingStore((s) => s.owners);
  const checkedRef = useRef<string>('');

  const handleCreateClick = () => {
    // Owner-first: chưa có chủ → tạo chủ; đã có → tạo MT5
    if (owners.length === 0) {
      setIsCreateOwnerOpen(true);
    } else {
      setIsCreateModalOpen(true);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    hydrate();
    // Khôi phục notifications (gồm tin XAU) từ localStorage
    useTradingStore.getState().hydrateNotifications();
  }, [hydrate, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !riskRules.enabled || accounts.length === 0) return;

    const fingerprint =
      accounts
        .map((a) => `${a.id}:${a.riskScore}:${a.stats.maxDrawdown}:${a.stats.totalTrades}`)
        .join('|') + `|rules:${riskRules.maxDrawdownPct}:${riskRules.maxRiskScore}`;
    if (fingerprint === checkedRef.current) return;
    checkedRef.current = fingerprint;

    const breaches = evaluateRiskRules(accounts, riskRules);
    if (!breaches.length) return;

    const prevKeys = useToolsStore.getState().lastBreachKeys;
    const keys = breaches.map(breachKey);
    const newOnes = breaches.filter((b) => !prevKeys.includes(breachKey(b)));
    if (!newOnes.length) return;

    const { notifications } = useTradingStore.getState();
    const stamp = Date.now();
    const newNotifs = newOnes.map((b, i) => ({
      id: `rule_${stamp}_${i}_${b.rule}_${b.accountId}`,
      accountId: b.accountId,
      type: (b.severity === 'critical' ? 'critical' : 'warning') as
        | 'warning'
        | 'critical'
        | 'info',
      message: `[Rule] ${b.message}`,
      time: 'Vừa xong',
      read: false,
    }));
    useTradingStore.setState({
      notifications: [...newNotifs, ...notifications].slice(0, 50),
    });

    // Chỉ Telegram critical (tránh spam warning mỗi lần loadAccounts)
    const critical = newOnes.filter((b) => b.severity === 'critical');
    if (riskRules.telegramOnBreach && critical.length > 0) {
      void sendTelegramAlert(formatBreachesForTelegram(critical));
    }
    // Lưu cả warning keys để không bắn lại in-app/TG trong ngày
    setLastBreachKeys([...new Set([...prevKeys, ...keys])].slice(-80));
  }, [accounts, riskRules, setLastBreachKeys, isAuthenticated]);

  // Loading state
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center space-y-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
          <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin pulse-glow-gold"></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-extrabold text-gold animate-pulse uppercase tracking-widest font-mono">
            Verifying Security Credentials...
          </p>
          <p className="text-[10px] text-dark-text-muted">Loading secure financial modules</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-light relative">
      {/* Canh tin vàng: ~5h trước + LIVE → Telegram + in-app (im lặng nếu lỗi) */}
      <NewsAlertWatcher enabled={isAuthenticated} />
      {/* Depth layer 0–1 */}
      <div className="ambient-bg" aria-hidden>
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
        <div className="ambient-blob-3" />
      </div>
      <div className="hud-grid" aria-hidden />
      <div className="hud-vignette" aria-hidden />

      {/* Floating sidebar */}
      <Sidebar
        onCreateAccountClick={handleCreateClick}
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
      />

      {/* Content column */}
      <div
        className={`relative z-10 min-h-screen flex flex-col transition-[margin] duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
          sidebarExpanded ? 'lg:ml-[268px]' : 'lg:ml-[100px]'
        } ml-0`}
      >
        {/* z-20 < modal portal 9999; sticky chỉ trên content */}
        <div className="sticky top-0 z-20 px-3 sm:px-4 md:px-5 pt-3 sm:pt-4">
          <TopBar />
        </div>
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 pb-24 lg:pb-8 pt-5 md:pt-6 max-w-[1440px] w-full mx-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      <CreateOwnerModal
        isOpen={isCreateOwnerOpen}
        onClose={() => setIsCreateOwnerOpen(false)}
        onCreated={(_name, key) => {
          router.push(`/owners?owner=${encodeURIComponent(key)}`);
        }}
      />
    </div>
  );
}

