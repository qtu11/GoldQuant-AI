'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTradingStore, TradingAccount } from '../store/useTradingStore';
import AccountCard from '../components/AccountCard';
import AccountCardCompact from '../components/AccountCardCompact';
import OwnerRow from '../components/OwnerRow';
import DetailDashboard from '../components/DetailDashboard';
import DetailTransactions from '../components/DetailTransactions';
import FileUpload, { type FileUploadHandle } from '../components/FileUpload';
import UpdateCapitalModal from '../components/UpdateCapitalModal';
import CreateAccountModal from '../components/CreateAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import RiskGauge from '../components/RiskGauge';
import AiAdvisorChat from '../components/AiAdvisorChat';
import MonteCarloChart from '../components/MonteCarloChart';
import CompareAccounts from '../components/CompareAccounts';
import NewsCalendar from '../components/NewsCalendar';
import NewsAlertPanel from '../components/NewsAlertPanel';
import CapitalMovesPanel from '../components/CapitalMovesPanel';
import OpenPositionsPanel from '../components/OpenPositionsPanel';
import BotResearchPanel from '../components/BotResearchPanel';
import InfoTip from '../components/InfoTip';
import { calculatePortfolioQuantMetrics, QuantMetricsResponse } from '../utils/quantService';
import { toUsd, formatVnd, formatUsd, getUsdVndRate, usdToVnd } from '../utils/currency';
import { parseDate } from '../utils/fileParser';
import { totalFloatingPnl } from '../utils/capitalEquity';
import { openWeeklyReport } from '../utils/weeklyReport';
import {
  filterTradesByPeriod,
  calculateStats,
  equityAtCutoff,
  filterCapitalMovesByPeriod,
  periodCutoffMs,
} from '../utils/analytics';
import {
  groupAccountsByOwner,
  normalizeOwnerKey,
  UNASSIGNED_OWNER_KEY,
} from '../utils/ownerStats';
import { 
  ArrowLeft, 
  Plus, 
  Upload, 
  LineChart, 
  Layers, 
  DollarSign, 
  TrendingUp, 
  Target, 
  ShieldAlert, 
  Sparkles,
  Database,
  Settings,
  Coins,
  TrendingDown,
  Wallet,
  Activity,
  FileDown,
  Users,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import SegmentedControl from '../components/ui/SegmentedControl';
import GlassChip from '../components/ui/GlassChip';

export default function Home() {
  const { accounts, activeAccountId, setActiveAccount, loadAccounts, isLoading } = useTradingStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'capital' | 'positions' | 'bot'>('dashboard');
  const [period, setPeriod] = useState<string>('all');
  const [portfolioPeriod, setPortfolioPeriod] = useState<string>('all');
  /** 'all' | ownerKey — lọc thẻ TK trên overview */
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [isUpdateCapitalOpen, setIsUpdateCapitalOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  // currencyMode gắn theo account: đổi account → dùng currency tài khoản; user có thể override
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'USC'>('USD');
  const [currencyBoundId, setCurrencyBoundId] = useState<string | null>(null);
  const [vndRate, setVndRate] = useState<number>(25850);
  const [portfolioQuant, setPortfolioQuant] = useState<QuantMetricsResponse | null>(null);
  /** Ref upload — header "Upload History" luôn mở được file picker */
  const historyUploadRef = useRef<FileUploadHandle>(null);

  const openHistoryUpload = () => {
    setActiveTab('transactions');
    // FileUpload luôn mount (mọi tab) — mở OS file dialog
    if (historyUploadRef.current) {
      historyUploadRef.current.openPicker();
    } else {
      requestAnimationFrame(() => historyUploadRef.current?.openPicker());
    }
  };

  // Khởi tạo Firebase + tỷ giá
  useEffect(() => {
    loadAccounts();
    let cancelled = false;
    getUsdVndRate()
      .then((result) => {
        if (!cancelled) setVndRate(result.rate);
      })
      .catch(() => {
        /* fallback rate đã có default */
      });
    return () => {
      cancelled = true;
    };
  }, [loadAccounts]);

  // Quant gộp theo ownerFilter — khớp KPI / MC startEquity
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const quantAccounts =
        ownerFilter === 'all'
          ? accounts
          : accounts.filter((a) => normalizeOwnerKey(a.ownerName) === ownerFilter);

      if (quantAccounts.length === 0) {
        if (!cancelled) setPortfolioQuant(null);
        return;
      }

      const totalEquityUsd = quantAccounts.reduce(
        (sum, a) => sum + toUsd(a.currentEquity, a.currency),
        0
      );
      const accountsWithTrades = quantAccounts.filter((a) => a.stats.totalTrades > 0);
      const avgDrawdown =
        accountsWithTrades.length > 0
          ? accountsWithTrades.reduce((sum, a) => sum + a.stats.maxDrawdown, 0) /
            accountsWithTrades.length
          : 0;

      type EqEvent = { time: number; day: string; pnl: number };
      const events: EqEvent[] = [];
      const totalInitialUsd = quantAccounts.reduce(
        (sum, a) => sum + toUsd(a.initialCapital, a.currency),
        0
      );

      // Trade events (cho daily returns / VaR — không lẫn nạp-rút)
      const tradeEvents: EqEvent[] = [];
      quantAccounts.forEach((a) => {
        (a.trades || []).forEach((t) => {
          const d = parseDate(t.closeTime || t.openTime);
          const tMs = d.getTime();
          if (isNaN(tMs)) return;
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const net = t.profit + t.commission + t.swap;
          tradeEvents.push({ time: tMs, day, pnl: toUsd(net, a.currency) });
        });
        // Capital moves chỉ vào equity path (maxDD), không vào dailyReturns
        (a.capitalMoves || []).forEach((m) => {
          const raw = m.date || m.createdAt || '';
          const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
          const tMs = d.getTime();
          if (isNaN(tMs)) return;
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const signed = (Number(m.amount) || 0) * (m.type === 'deposit' ? 1 : -1);
          events.push({ time: tMs, day, pnl: toUsd(signed, a.currency) });
        });
      });
      tradeEvents.forEach((e) => events.push(e));
      events.sort((a, b) => a.time - b.time);
      tradeEvents.sort((a, b) => a.time - b.time);

      // Daily returns = trade PnL only
      const dayMap = new Map<string, number>();
      tradeEvents.forEach((e) => {
        dayMap.set(e.day, (dayMap.get(e.day) || 0) + e.pnl);
      });

      const equityHistory: number[] = [totalInitialUsd || totalEquityUsd || 1];
      const dailyReturns: number[] = [];
      let runningEq = totalInitialUsd || totalEquityUsd || 1;

      Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([, dayPnl]) => {
          if (runningEq > 0) dailyReturns.push(dayPnl / runningEq);
          runningEq += dayPnl;
          equityHistory.push(runningEq);
        });

      // Per-trade returns (fraction of equity trước lệnh) — MC dùng khi chỉ 1 ngày
      const tradeReturns: number[] = [];
      let eqForTrade = totalInitialUsd || totalEquityUsd || 1;
      type AnyEv = { time: number; pnl: number; isTrade: boolean };
      const seq: AnyEv[] = [];
      quantAccounts.forEach((a) => {
        (a.capitalMoves || []).forEach((m) => {
          const raw = m.date || m.createdAt || '';
          const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
          const tMs = d.getTime();
          if (isNaN(tMs)) return;
          const signed = (Number(m.amount) || 0) * (m.type === 'deposit' ? 1 : -1);
          seq.push({ time: tMs, pnl: toUsd(signed, a.currency), isTrade: false });
        });
      });
      tradeEvents.forEach((e) => {
        seq.push({ time: e.time, pnl: e.pnl, isTrade: true });
      });
      seq.sort((a, b) => a.time - b.time);
      seq.forEach((ev) => {
        if (ev.isTrade && eqForTrade > 0) {
          tradeReturns.push(ev.pnl / eqForTrade);
        }
        eqForTrade += ev.pnl;
        if (eqForTrade < 1) eqForTrade = 1;
      });

      // Equity curve full (trades + nạp/rút) cho maxDD quant
      let eqCurve = totalInitialUsd || totalEquityUsd || 1;
      const tradeEquitySeries = [eqCurve];
      events.forEach((e) => {
        eqCurve += e.pnl;
        tradeEquitySeries.push(eqCurve);
      });

      const liveEquity = totalEquityUsd > 0 ? totalEquityUsd : runningEq;

      try {
        const res = await calculatePortfolioQuantMetrics({
          equityHistory:
            tradeEquitySeries.length > 1 ? tradeEquitySeries : equityHistory,
          dailyReturns,
          tradeReturns,
          currentEquity: liveEquity,
          currentDrawdown: avgDrawdown,
          maxDdLimit: 8,
          // Chưa có MT5 margin realtime — neutral (>500) để không phình risk score ảo
          marginLevel: 1000,
          allocations: quantAccounts.map((a) => toUsd(a.currentEquity, a.currency)),
          anomalyCount: 0,
          sampleTrades: tradeEvents.length,
          sampleDays: dayMap.size,
        });
        if (!cancelled) setPortfolioQuant(res);
      } catch {
        if (!cancelled) setPortfolioQuant(null);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [accounts, ownerFilter]);

  // Lấy tài khoản đang được chọn
  const activeAccount = accounts.find(acc => acc.id === activeAccountId);

  // Currency: bind theo account, user override khi toggle
  const effectiveCurrencyMode: 'USD' | 'USC' =
    activeAccount && currencyBoundId === activeAccount.id
      ? currencyMode
      : activeAccount?.currency || currencyMode;

  const setCurrencyModeForAccount = (mode: 'USD' | 'USC') => {
    setCurrencyMode(mode);
    if (activeAccountId) setCurrencyBoundId(activeAccountId);
  };

  // Hiển thị màn hình loading chuyên nghiệp
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
          <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin pulse-glow-gold"></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-extrabold text-gold animate-pulse uppercase tracking-widest font-mono">
            Connecting GoldQuant Firestore...
          </p>
          <p className="text-[10px] text-dark-text-muted">Loading secure financial modules</p>
        </div>
      </div>
    );
  }

  // --- TRANG TỔNG QUAN (RISK DASHBOARD) ---
  if (!activeAccountId || !activeAccount) {
    const ownerGroups = groupAccountsByOwner(accounts);
    const filteredAccounts =
      ownerFilter === 'all'
        ? accounts
        : accounts.filter((a) => normalizeOwnerKey(a.ownerName) === ownerFilter);

    const totalAccounts = filteredAccounts.length;
    // Period filter portfolio: tính lại stats theo period cho KPI
    const periodStats = filteredAccounts.map((a) => {
      const allTrades = a.trades || [];
      const allMoves = a.capitalMoves || [];
      const ft = filterTradesByPeriod(allTrades, portfolioPeriod);
      const cutoff = periodCutoffMs(allTrades, portfolioPeriod);
      const startCap =
        cutoff == null
          ? a.initialCapital
          : equityAtCutoff(allTrades, a.initialCapital, allMoves, cutoff);
      const movesInPeriod =
        cutoff == null ? allMoves : filterCapitalMovesByPeriod(allMoves, cutoff);
      return {
        acc: a,
        stats: calculateStats(ft, startCap, movesInPeriod),
      };
    });
    const totalEquityUsd = filteredAccounts.reduce((sum, a) => sum + toUsd(a.currentEquity, a.currency), 0);
    const totalEquityUsc = filteredAccounts.every((a) => a.currency === 'USC')
      ? filteredAccounts.reduce((s, a) => s + (a.currentEquity || 0), 0)
      : null;
    const totalProfitUsd = periodStats.reduce(
      (sum, { acc, stats }) => sum + toUsd(stats.netProfit, acc.currency),
      0
    );
    const totalFloatUsd = filteredAccounts.reduce(
      (sum, a) => sum + toUsd(totalFloatingPnl(a.openPositions || [], 100, a.currency), a.currency),
      0
    );
    const accountsWithTrades = periodStats.filter((p) => p.stats.totalTrades > 0);
    const avgProfitFactor = accountsWithTrades.length > 0 
      ? Math.round((accountsWithTrades.reduce((sum, p) => sum + p.stats.profitFactor, 0) / accountsWithTrades.length) * 100) / 100 
      : 0;
    const avgDrawdown = accountsWithTrades.length > 0 
      ? Math.round((accountsWithTrades.reduce((sum, p) => sum + p.stats.maxDrawdown, 0) / accountsWithTrades.length) * 10) / 10 
      : 0;
    const totalTrades = periodStats.reduce((sum, p) => sum + p.stats.totalTrades, 0);
    const avgRiskScore = totalAccounts > 0 
      ? Math.round(filteredAccounts.reduce((sum, a) => sum + a.riskScore, 0) / totalAccounts) 
      : 0;
    const unassignedCount =
      ownerGroups.find((g) => g.ownerKey === UNASSIGNED_OWNER_KEY)?.accountCount || 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header — TopBar đã có title; giữ CTA + meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="icon-tile icon-tile-yellow">
                <Coins className="w-4 h-4 stroke-[1.75]" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">
                Portfolio <span className="neon-gradient-text">Overview</span>
              </h2>
            </div>
            <p className="text-xs text-dark-text-muted mt-1.5 font-medium">
              {totalAccounts} TK
              {ownerFilter !== 'all' ? ' (đã lọc)' : ''} · Floating{' '}
              {totalFloatUsd >= 0 ? '+' : ''}${Math.round(totalFloatUsd).toLocaleString()} · period KPI
              {unassignedCount > 0 && ownerFilter === 'all' && (
                <span className="text-neon-yellow"> · {unassignedCount} chưa phân</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={portfolioPeriod}
              onChange={setPortfolioPeriod}
              options={[
                { value: 'all', label: 'All' },
                { value: '1w', label: '1W' },
                { value: '1m', label: '1M' },
                { value: '1q', label: '1Q' },
              ]}
            />
            <Link
              href="/owners"
              className="btn-glass py-2 px-3.5 flex items-center gap-1.5 text-xs font-semibold text-neon-purple hover:text-white pressable"
            >
              <Users className="w-3.5 h-3.5 stroke-[1.75]" />
              Owners
            </Link>
            <button
              onClick={() => openWeeklyReport(filteredAccounts)}
              className="btn-glass py-2 px-3.5 flex items-center gap-1.5 text-xs font-semibold text-neon-purple hover:text-white pressable"
            >
              <FileDown className="w-3.5 h-3.5 stroke-[1.75]" />
              Report
            </button>
            <Link
              href="/owners"
              className="btn-neon py-2.5 px-5 flex items-center justify-center gap-2 text-sm pressable"
            >
              <Users className="w-4 h-4 stroke-[1.75]" />
              <span>Owners / Tạo TK</span>
            </Link>
          </div>
        </div>

        {/* Filter theo chủ sở hữu */}
        {ownerGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider mr-1">
              Owner
            </span>
            <GlassChip
              active={ownerFilter === 'all'}
              onClick={() => setOwnerFilter('all')}
              tone="cyan"
            >
              Tất cả ({accounts.length})
            </GlassChip>
            {ownerGroups.map((g) => (
              <GlassChip
                key={g.ownerKey}
                active={ownerFilter === g.ownerKey}
                onClick={() => setOwnerFilter(g.ownerKey)}
                tone={g.unassigned ? 'yellow' : 'purple'}
              >
                {g.ownerName} ({g.accountCount})
              </GlassChip>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* KPI glass grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              <div className="neon-card-premium gold-glow-hover neon-border-animate p-5 flex flex-col justify-between kpi-yellow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Total Equity</span>
                  <div className="icon-tile icon-tile-yellow"><DollarSign className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4">
                  <span className="text-xl font-semibold text-white font-mono leading-tight block tracking-tight">
                    {formatUsd(totalEquityUsd)}
                  </span>
                  <span className="text-[10px] text-neon-yellow/80 font-mono mt-1 block">
                    {totalEquityUsc != null
                      ? `${Math.round(totalEquityUsc).toLocaleString('en-US')} USC · 100 USC=$1 · `
                      : ''}
                    ≈ {formatVnd(usdToVnd(totalEquityUsd, vndRate))}
                  </span>
                </div>
              </div>

              <div className="neon-card-premium gold-glow-hover p-5 flex flex-col justify-between kpi-green">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Total Profit</span>
                  <div className="icon-tile icon-tile-green"><TrendingUp className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4">
                  <span className={`text-xl font-semibold font-mono leading-tight block tracking-tight ${totalProfitUsd >= 0 ? 'text-neon-green' : 'text-neon-pink'}`}>
                    {formatUsd(totalProfitUsd, true)}
                  </span>
                  <span className={`text-[10px] font-mono mt-1 block ${totalProfitUsd >= 0 ? 'text-neon-green/70' : 'text-neon-pink/70'}`}>
                    Cộng dồn · ≈ {totalProfitUsd >= 0 ? '+' : '−'}{formatVnd(Math.abs(usdToVnd(totalProfitUsd, vndRate)))}
                  </span>
                </div>
              </div>

              <div className="neon-card-premium gold-glow-hover p-5 flex flex-col justify-between kpi-cyan">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Avg Profit Factor</span>
                  <div className="icon-tile icon-tile-cyan"><LineChart className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-neon-cyan font-mono leading-tight block">
                    {totalAccounts > 0 ? avgProfitFactor : '—'}
                  </span>
                  <span className="text-[9px] text-dark-text-muted block mt-1">
                    {totalAccounts > 0 ? 'Độ an toàn hệ thống' : 'Chưa có tài khoản'}
                  </span>
                </div>
              </div>

              <div className="neon-card-premium gold-glow-hover p-5 flex flex-col justify-between kpi-pink">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Avg Drawdown</span>
                  <div className="icon-tile icon-tile-pink"><TrendingDown className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-neon-pink font-mono leading-tight block">
                    {totalAccounts > 0 ? `${avgDrawdown}%` : '—'}
                  </span>
                  <span className="text-[9px] text-dark-text-muted block mt-1">Sụt giảm tài sản gộp</span>
                </div>
              </div>

              <div className="neon-card-premium gold-glow-hover p-5 flex flex-col justify-between kpi-blue">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Total Trades</span>
                  <div className="icon-tile icon-tile-blue"><Target className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-semibold text-neon-blue font-mono leading-tight block">
                    {totalTrades}
                  </span>
                  <span className="text-[9px] text-dark-text-muted block mt-1">Lệnh đã hoàn thành</span>
                </div>
              </div>

              <div className="neon-card-premium gold-glow-hover p-5 flex flex-col justify-between kpi-purple">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">Value at Risk (VaR 95%)</span>
                  <div className="icon-tile icon-tile-purple"><ShieldAlert className="w-4 h-4 stroke-[1.75]" /></div>
                </div>
                <div className="mt-4 flex flex-col justify-end">
                  <span className="text-xl font-semibold text-neon-purple font-mono leading-tight block">
                    {portfolioQuant && totalAccounts > 0
                      ? formatUsd(portfolioQuant.var95)
                      : '—'}
                  </span>
                  <span className="text-[9px] text-dark-text-muted block mt-1">
                    {totalAccounts > 0
                      ? `≈ ${formatVnd(usdToVnd(portfolioQuant?.var95 || 0, vndRate))} · 1 ngày`
                      : 'Cần tài khoản + lịch sử'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Trading Accounts</h3>
                <button 
                  onClick={() => { 
                    if (filteredAccounts.length > 0) {
                      setEditingAccount(filteredAccounts[0]);
                      setIsEditAccountOpen(true);
                    } else if (accounts.length > 0) {
                      setEditingAccount(accounts[0]);
                      setIsEditAccountOpen(true);
                    } else {
                      alert('Vui lòng tạo tài khoản trước!');
                    }
                  }}
                  className="btn-glass p-1.5 text-dark-text-muted hover:text-neon-cyan pressable"
                  title="Quản lý / Chỉnh sửa tài khoản"
                >
                  <Settings className="w-3.5 h-3.5 stroke-[1.75]" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-3 items-start content-start">
                {(() => {
                  const ownerGroups2 = groupAccountsByOwner(filteredAccounts);
                  return ownerGroups2.map((g, i) => (
                    <OwnerRow
                      key={g.ownerKey}
                      ownerName={g.accounts[0]?.ownerName || ''}
                      accounts={g.accounts}
                      accentIndex={i}
                      period={portfolioPeriod}
                      onSelectAccount={(id) => setActiveAccount(id)}
                      onEditAccount={(acc, e) => {
                        e.stopPropagation();
                        setEditingAccount(acc);
                        setIsEditAccountOpen(true);
                      }}
                    />
                  ));
                })()}
                
                <Link
                  href="/owners"
                  className="w-full self-start min-h-[100px] rounded-2xl border border-dashed border-white/20 bg-transparent hover:border-neon-cyan/45 hover:bg-neon-cyan/[0.04] flex flex-col items-center justify-center text-center p-4 transition-all pressable group"
                >
                  <div className="w-9 h-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center mb-2 text-dark-text-muted group-hover:text-neon-cyan group-hover:border-neon-cyan/40 transition-colors">
                    <Users className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <span className="text-xs font-semibold text-white group-hover:text-neon-cyan transition-colors">Owners → Tạo TK MT5</span>
                  <span className="text-[10px] text-dark-text-muted mt-1 px-4 leading-normal">Tạo chủ sở hữu trước, rồi gắn MT5</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Cột phải: Risk Gauge & AI Assistant Copilot (chiếm 1/3) */}
          <div className="lg:col-span-1 space-y-6">
            <RiskGauge
              score={
                totalAccounts === 0
                  ? null
                  : portfolioQuant
                    ? portfolioQuant.riskScore
                    : avgRiskScore
              }
            />
            <AiAdvisorChat />
          </div>

        </div>

        {/* Quant + Compare */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 items-stretch">
          <MonteCarloChart
            paths={portfolioQuant?.monteCarloPaths || []}
            startEquity={filteredAccounts.reduce((s, a) => s + toUsd(a.currentEquity, a.currency), 0)}
            meta={portfolioQuant?.mcMeta}
          />
          <div className="h-full min-h-[360px]">
            <CompareAccounts accounts={filteredAccounts} />
          </div>
        </div>

        {/* Economic calendar + auto 5h alerts — dense, equal height */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch">
          <div className="xl:col-span-3 min-h-[480px] max-h-[min(68vh,640px)]">
            <NewsCalendar />
          </div>
          <div className="xl:col-span-2 min-h-[480px] max-h-[min(68vh,640px)]">
            <NewsAlertPanel />
          </div>
        </div>

        {/* Modal tạo tài khoản */}
        <CreateAccountModal 
          isOpen={isCreateAccountOpen} 
          onClose={() => setIsCreateAccountOpen(false)} 
        />

        {/* Modal chỉnh sửa tài khoản */}
        <EditAccountModal
          isOpen={isEditAccountOpen}
          onClose={() => {
            setIsEditAccountOpen(false);
            setEditingAccount(null);
          }}
          account={editingAccount}
        />
      </div>
    );
  }

  // --- TRANG CHI TIẾT TÀI KHOẢN ---
  // Gợi ý: Calendar + AI đầy đủ nằm ở Overview (nút TopBar "Overview")
  const isUscAccount = activeAccount.currency === 'USC';
  // Quy đổi đúng 2 chiều: USC↔USD (trước đây USD account + mode USC hiển thị sai, không ×100)
  let displayEquity: number;
  let displayInitialCapital: number;
  let displayCurrencyLabel: string;
  
  if (effectiveCurrencyMode === 'USC') {
    displayEquity = isUscAccount ? activeAccount.currentEquity : activeAccount.currentEquity * 100;
    displayInitialCapital = isUscAccount ? activeAccount.initialCapital : activeAccount.initialCapital * 100;
    displayCurrencyLabel = 'USC';
  } else {
    displayEquity = isUscAccount ? activeAccount.currentEquity / 100 : activeAccount.currentEquity;
    displayInitialCapital = isUscAccount ? activeAccount.initialCapital / 100 : activeAccount.initialCapital;
    displayCurrencyLabel = 'USD';
  }
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Nút quay lại trang chủ tổng quan */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => setActiveAccount(null)}
          className="flex items-center gap-2 text-xs text-dark-text-muted hover:text-neon-cyan transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Overview (AI + Calendar + Monte Carlo)</span>
        </button>
        <a
          href="/news"
          className="text-[10px] font-bold text-neon-yellow border border-neon-yellow/30 px-2 py-1 rounded-lg hover:bg-neon-yellow/10"
        >
          Lịch tin FF →
        </a>
      </div>

      {/* Account Info Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-dark-border">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black text-white font-mono leading-none tracking-tight flex items-center gap-2">
              <span>{activeAccount.id}</span>
              {activeAccount.accountName && (
                <span className="text-xs font-bold text-neon-purple px-2.5 py-0.5 rounded-lg badge-neon-pink uppercase font-sans tracking-wide">
                  {activeAccount.accountName}
                </span>
              )}
              <button 
                onClick={() => {
                  setEditingAccount(activeAccount);
                  setIsEditAccountOpen(true);
                }}
                className="p-1.5 rounded-lg bg-dark-card hover:bg-dark-input text-dark-text-muted hover:text-neon-cyan border border-dark-border transition-all cursor-pointer"
                title="Chỉnh sửa hoặc Xóa tài khoản này"
              >
                <Settings className="w-4 h-4" />
              </button>
            </h2>
            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 ${
              activeAccount.status === 'Healthy' 
                ? 'badge-neon-green' 
                : activeAccount.status === 'Moderate'
                  ? 'badge-neon-amber'
                  : 'badge-neon-red'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                activeAccount.status === 'Healthy' 
                  ? 'bg-neon-green pulse-glow-green' 
                  : activeAccount.status === 'Moderate'
                    ? 'bg-neon-yellow'
                    : 'bg-rose-400'
              }`} />
              {activeAccount.status}
            </span>

            {activeAccount.leverage && (
              <span className="px-2 py-0.5 rounded-lg bg-dark-card border border-dark-border text-neon-yellow text-xs font-bold font-mono">
                1:{activeAccount.leverage}
              </span>
            )}

            <div className="flex bg-dark-card border border-dark-border p-0.5 rounded-xl">
              <button
                onClick={() => setCurrencyModeForAccount('USC')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  effectiveCurrencyMode === 'USC' 
                    ? 'bg-neon-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]' 
                    : 'text-dark-text-muted hover:text-white'
                }`}
              >
                USC
              </button>
              <button
                onClick={() => setCurrencyModeForAccount('USD')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  effectiveCurrencyMode === 'USD' 
                    ? 'btn-neon-yellow text-dark-bg' 
                    : 'text-dark-text-muted hover:text-white'
                }`}
              >
                USD
              </button>
            </div>
          </div>
          
          <p className="text-xs text-dark-text-muted font-semibold tracking-wide">
            {activeAccount.broker} · {activeAccount.server} · {activeAccount.platform} · {activeAccount.symbol} · {activeAccount.accountType}
            {isUscAccount && <span className="text-neon-cyan/80 ml-2">(Cent · 100 USC = 1 USD)</span>}
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-6 self-start xl:self-auto w-full md:w-auto">
          <div className="flex gap-8 border-r border-dark-border pr-6 hidden md:flex font-mono">
            <div>
              <span className="text-[10px] font-bold text-dark-text-muted uppercase block tracking-wider">Initial Capital</span>
              <span className="text-lg font-black text-white mt-1 block">
                {effectiveCurrencyMode === 'USC' ? '' : '$'}{Math.round(displayInitialCapital).toLocaleString()} {displayCurrencyLabel}
              </span>
              {effectiveCurrencyMode === 'USD' && (
                <span className="text-[9px] text-dark-text-muted block mt-0.5">≈ {formatVnd(usdToVnd(displayInitialCapital, vndRate))}</span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-dark-text-muted uppercase block tracking-wider">Current Equity</span>
              <span className="text-lg font-black text-neon-cyan mt-1 block">
                {effectiveCurrencyMode === 'USC' ? '' : '$'}{Math.round(displayEquity).toLocaleString()} {displayCurrencyLabel}
              </span>
              {effectiveCurrencyMode === 'USD' && (
                <span className="text-[9px] text-neon-cyan/60 block mt-0.5">≈ {formatVnd(usdToVnd(displayEquity, vndRate))}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsUpdateCapitalOpen(true)}
                className="btn-glass py-2.5 px-3.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-white hover:text-neon-cyan pressable"
              >
                <Database className="w-4 h-4 stroke-[1.75]" />
                <span>Update Capital</span>
              </button>
              <InfoTip title="Update Capital" align="right">
                <p>Cập nhật vốn ban đầu / equity khi số MT5 khác dashboard.</p>
                <p>Đồng bộ nạp/rút ảo để load lại không ghi đè.</p>
              </InfoTip>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openHistoryUpload}
                className="btn-glass py-2.5 px-3.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-neon-purple hover:text-white pressable"
              >
                <Upload className="w-4 h-4 stroke-[1.75]" />
                <span>Upload History</span>
              </button>
              <InfoTip title="Upload History" align="right">
                <p>
                  <strong className="text-white">Bấm nút</strong> → chọn file MT5 ngay (CSV /
                  HTML / Excel / TXT).
                </p>
                <p>MT5 → History → Report → Save as…</p>
              </InfoTip>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const { sharpeRatio, maxDrawdown, roi, profitFactor, totalTrades } =
                    activeAccount.stats;
                  if (totalTrades === 0) {
                    alert(
                      'Chưa có lịch sử. Bấm Upload History để nạp file MT5 trước.'
                    );
                    openHistoryUpload();
                    return;
                  }
                  if (
                    sharpeRatio >= 1.5 &&
                    maxDrawdown < 5 &&
                    roi > 0 &&
                    profitFactor >= 1.5
                  ) {
                    const scalePct = Math.min(
                      25,
                      Math.max(5, Math.round(5 + sharpeRatio * 3))
                    );
                    alert(
                      `AI Capital Scaling — KHUYẾN NGHỊ TĂNG ${scalePct}%\n\n` +
                        `• Sharpe: ${sharpeRatio}\n• Max DD: ${maxDrawdown}%\n• ROI: ${roi}%\n• PF: ${profitFactor}\n\n` +
                        `Hiệu suất ổn định. Có thể tăng quy mô ~${scalePct}%.`
                    );
                  } else if (maxDrawdown > 15 || sharpeRatio < 0 || profitFactor < 1) {
                    alert(
                      `AI Capital Scaling — KHUYẾN NGHỊ GIẢM 20%\n\n` +
                        `• Sharpe: ${sharpeRatio}\n• Max DD: ${maxDrawdown}%\n• ROI: ${roi}%\n• PF: ${profitFactor}\n\n` +
                        `Rủi ro cao — giảm lot ~20%.`
                    );
                  } else {
                    alert(
                      `AI Capital Scaling — GIỮ NGUYÊN\n\n` +
                        `• Sharpe: ${sharpeRatio}\n• Max DD: ${maxDrawdown}%\n• ROI: ${roi}%\n• PF: ${profitFactor}\n\n` +
                        `Chỉ số trung tính. Duy trì quy mô hiện tại.`
                    );
                  }
                }}
                className="btn-neon py-2.5 px-3.5 flex items-center justify-center gap-1.5 text-xs pressable"
              >
                <Sparkles className="w-4 h-4 stroke-[1.75]" />
                <span>AI Scale</span>
              </button>
              <InfoTip title="AI Capital Scaling" align="right">
                <p>Gợi ý tăng / giữ / giảm vốn theo Sharpe, Max DD, ROI, PF.</p>
                <p>Cần đã upload lịch sử. Không phải lời khuyên đầu tư chắc chắn.</p>
              </InfoTip>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — liquid glass capsules */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl overflow-x-auto max-w-full">
        {(
          [
            { id: 'dashboard' as const, label: 'Dashboard', icon: Layers },
            { id: 'transactions' as const, label: 'Transactions', icon: Database },
            { id: 'capital' as const, label: 'Capital', icon: Wallet },
            { id: 'positions' as const, label: 'Open Positions', icon: Activity },
            { id: 'bot' as const, label: 'Nghiên cứu bot', icon: Bot },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-full transition-all duration-300 flex items-center gap-2 cursor-pointer whitespace-nowrap pressable ${
              activeTab === t.id
                ? 'bg-gradient-to-r from-neon-cyan/90 to-neon-purple/85 text-dark-bg shadow-[0_0_20px_rgba(76,201,255,0.2)]'
                : 'text-dark-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Upload luôn có trên mọi tab — bấm header Upload History → mở picker */}
      <div className="mt-2">
        <FileUpload
          ref={historyUploadRef}
          accountId={activeAccount.id}
          variant="compact"
        />
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <DetailDashboard 
          account={activeAccount} 
          period={period}
          setPeriod={setPeriod}
          currencyMode={effectiveCurrencyMode}
        />
      )}
      {activeTab === 'transactions' && (
        <DetailTransactions
          trades={activeAccount.trades || []}
          currency={activeAccount.currency}
        />
      )}
      {activeTab === 'capital' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CapitalMovesPanel accountId={activeAccount.id} />
          <div className="neon-card-premium neon-card-static p-5 kpi-cyan space-y-3">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Equity breakdown
              </h4>
              <InfoTip title="Công thức equity">
                <p>
                  <strong className="text-white">Closed Equity</strong> = Initial + Trade PnL +
                  Net nạp/rút.
                </p>
                <p>
                  <strong className="text-white">Floating</strong> = PnL lệnh đang mở (chưa đóng).
                </p>
                <p>Dùng tab Capital để ghi nạp/rút — equity tự đồng bộ.</p>
              </InfoTip>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between"><span className="text-dark-text-muted">Initial</span><span className="text-white">{activeAccount.initialCapital.toLocaleString()} {activeAccount.currency}</span></div>
              <div className="flex justify-between"><span className="text-dark-text-muted">Trade PnL</span><span className={activeAccount.stats.netProfit >= 0 ? 'text-neon-green' : 'text-rose-400'}>{activeAccount.stats.netProfit >= 0 ? '+' : ''}{activeAccount.stats.netProfit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-dark-text-muted">Net D/W</span><span className="text-neon-yellow">{((activeAccount.capitalMoves || []).reduce((s, m) => s + (m.type === 'deposit' ? m.amount : -m.amount), 0)).toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-dark-border pt-2"><span className="text-dark-text-muted font-sans font-bold">Closed Equity</span><span className="text-neon-cyan font-black">{activeAccount.currentEquity.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-dark-text-muted">Floating</span><span className={totalFloatingPnl(activeAccount.openPositions || [], 100, activeAccount.currency) >= 0 ? 'text-neon-green' : 'text-rose-400'}>{totalFloatingPnl(activeAccount.openPositions || [], 100, activeAccount.currency) >= 0 ? '+' : ''}{totalFloatingPnl(activeAccount.openPositions || [], 100, activeAccount.currency).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'positions' && (
        <OpenPositionsPanel accountId={activeAccount.id} />
      )}
      {activeTab === 'bot' && (
        <BotResearchPanel account={activeAccount} />
      )}

      {/* Modal cập nhật vốn */}
      <UpdateCapitalModal 
        isOpen={isUpdateCapitalOpen} 
        onClose={() => setIsUpdateCapitalOpen(false)} 
        accountId={activeAccount.id}
      />
      
      {/* Modal chỉnh sửa tài khoản */}
      <EditAccountModal
        isOpen={isEditAccountOpen}
        onClose={() => {
          setIsEditAccountOpen(false);
          setEditingAccount(null);
        }}
        account={activeAccount}
      />
    </div>
  );
}
