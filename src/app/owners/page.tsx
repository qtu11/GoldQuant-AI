'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTradingStore, TradingAccount } from '../../store/useTradingStore';
import {
  groupAccountsByOwner,
  getOwnerSummary,
  normalizeOwnerKey,
  UNASSIGNED_OWNER_KEY,
  type OwnerSummary,
} from '../../utils/ownerStats';
import {
  toUsd,
  formatVnd,
  formatUsd,
  getUsdVndRate,
  usdToVnd,
  sumPortfolioUsd,
} from '../../utils/currency';
import {
  calculateStats,
  dayNetProfit,
  equityAtCutoff,
  filterCapitalMovesByPeriod,
  filterTradesByPeriod,
  periodCutoffMs,
} from '../../utils/analytics';
import SegmentedControl from '../../components/ui/SegmentedControl';
import AccountCard from '../../components/AccountCard';
import EditAccountModal from '../../components/EditAccountModal';
import CreateAccountModal from '../../components/CreateAccountModal';
import CreateOwnerModal from '../../components/CreateOwnerModal';
import {
  Users,
  User,
  ArrowLeft,
  TrendingUp,
  Wallet,
  Layers,
  Target,
  ShieldAlert,
  ChevronRight,
  Plus,
  UserX,
  Activity,
  UserPlus,
  Trash2,
} from 'lucide-react';

const PERIODS = [
  { v: 'all', l: 'All' },
  { v: '1w', l: '1W' },
  { v: '1m', l: '1M' },
  { v: '1q', l: '1Q' },
] as const;

function OwnerKpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  valueClass?: string;
}) {
  return (
    <div className={`neon-card-premium gold-glow-hover p-5 flex flex-col justify-between ${accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider">
          {label}
        </span>
        <div className="icon-tile">
          <Icon className="w-4 h-4 stroke-[1.75]" />
        </div>
      </div>
      <div className="mt-4">
        <span
          className={`text-lg font-semibold font-mono leading-tight block ${valueClass || 'text-white'}`}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[10px] text-dark-text-muted font-mono mt-1 block">{sub}</span>
        )}
      </div>
    </div>
  );
}

function OwnerRow({
  summary,
  vndRate,
  onOpen,
}: {
  summary: OwnerSummary;
  vndRate: number;
  onOpen: () => void;
}) {
  const profitPos = summary.totalProfitUsd >= 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full neon-card-premium gold-glow-hover p-5 text-left flex flex-col sm:flex-row sm:items-center gap-4 hover:border-neon-cyan/30 transition-all pressable group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border flex-shrink-0 ${
            summary.unassigned
              ? 'bg-white/5 border-white/10 text-dark-text-muted'
              : 'bg-neon-purple/15 border-neon-purple/30 text-neon-purple'
          }`}
        >
          {summary.unassigned ? (
            <UserX className="w-5 h-5 stroke-[1.75]" />
          ) : (
            <User className="w-5 h-5 stroke-[1.75]" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white group-hover:text-neon-cyan transition-colors truncate">
              {summary.ownerName}
            </h3>
            {summary.accountCount === 0 && !summary.unassigned && (
              <span className="text-[9px] font-semibold badge-neon-cyan px-1.5 py-0.5">
                Chưa có TK MT5
              </span>
            )}
            {summary.unassigned && (
              <span className="text-[9px] font-semibold badge-neon-amber px-1.5 py-0.5">
                Cần gán
              </span>
            )}
          </div>
          <p className="text-[11px] text-dark-text-muted mt-0.5">
            {summary.accountCount} TK MT5 · {summary.totalTrades} trades · Risk avg{' '}
            {summary.avgRiskScore || '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:gap-6 flex-shrink-0 w-full sm:w-auto">
        <div>
          <span className="text-[9px] font-semibold text-dark-text-muted uppercase block">Equity</span>
          <span className="text-sm font-semibold text-white font-mono">
            {formatUsd(summary.totalEquityUsd)}
          </span>
          <span className="text-[9px] text-dark-text-muted font-mono block">
            {formatVnd(usdToVnd(summary.totalEquityUsd, vndRate))}
          </span>
        </div>
        <div>
          <span className="text-[9px] font-semibold text-dark-text-muted uppercase block">Profit</span>
          <span
            className={`text-sm font-semibold font-mono ${
              profitPos ? 'text-neon-green' : 'text-neon-pink'
            }`}
          >
            {formatUsd(summary.totalProfitUsd, true)}
          </span>
          <span className="text-[9px] text-dark-text-muted font-mono block">
            ROI {summary.portfolioRoi >= 0 ? '+' : ''}
            {summary.portfolioRoi}%
          </span>
        </div>
        <div>
          <span className="text-[9px] font-semibold text-dark-text-muted uppercase block">Max DD</span>
          <span className="text-sm font-semibold text-neon-pink font-mono">
            {summary.accountCount > 0 ? `${summary.avgDrawdown}%` : '—'}
          </span>
          <span className="text-[9px] text-dark-text-muted font-mono block">
            PF {summary.accountCount > 0 ? summary.avgProfitFactor : '—'}
          </span>
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-dark-text-muted group-hover:text-neon-cyan flex-shrink-0 hidden sm:block stroke-[1.75]" />
    </button>
  );
}

function OwnersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    accounts,
    owners,
    loadAccounts,
    isLoading,
    setActiveAccount,
    deleteOwner,
  } = useTradingStore();
  const [period, setPeriod] = useState<string>('all');
  const [vndRate, setVndRate] = useState(25850);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateMt5Open, setIsCreateMt5Open] = useState(false);
  const [isCreateOwnerOpen, setIsCreateOwnerOpen] = useState(false);

  const selectedKey = searchParams.get('owner') || null;

  useEffect(() => {
    loadAccounts();
    let cancelled = false;
    getUsdVndRate()
      .then((r) => {
        if (!cancelled) setVndRate(r.rate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadAccounts]);

  const groupOpts = useMemo(
    () => ({ period, registeredOwners: owners, hideUnassigned: false }),
    [period, owners]
  );

  const summaries = useMemo(
    () => groupAccountsByOwner(accounts, groupOpts),
    [accounts, groupOpts]
  );

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    return getOwnerSummary(accounts, selectedKey, groupOpts);
  }, [accounts, selectedKey, groupOpts]);

  const selectedRegistry = useMemo(() => {
    if (!selectedKey || selectedKey === UNASSIGNED_OWNER_KEY) return null;
    return owners.find((o) => normalizeOwnerKey(o.name) === selectedKey) || null;
  }, [owners, selectedKey]);

  const openOwner = (key: string) => {
    router.push(`/owners?owner=${encodeURIComponent(key)}`);
  };

  const backToList = () => {
    router.push('/owners');
  };

  const openAccountDetail = (id: string) => {
    setActiveAccount(id);
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-neon-purple border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-neon-purple uppercase tracking-widest">
          Loading owners…
        </p>
      </div>
    );
  }

  // ——— Dashboard 1 chủ sở hữu ———
  if (selectedKey && selected) {
    const profitPos = selected.totalProfitUsd >= 0;
    const eqNative = sumPortfolioUsd(
      selected.accounts.map((a) => ({
        amount: a.currentEquity,
        currency: a.currency,
      }))
    );
    const initNative = sumPortfolioUsd(
      selected.accounts.map((a) => ({
        amount: a.initialCapital,
        currency: a.currency,
      }))
    );
    const todayUscOrUsd = selected.accounts.reduce((s, a) => {
      const d = dayNetProfit(a.trades || []);
      return s + toUsd(d, a.currency);
    }, 0);
    const todayNative = selected.accounts.reduce((s, a) => {
      if (a.currency !== 'USC') return s;
      return s + dayNetProfit(a.trades || []);
    }, 0);
    const centHint = eqNative.allUsc
      ? `${eqNative.totalUsc.toLocaleString('en-US')} USC · 100 USC = $1`
      : undefined;

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={backToList}
              className="flex items-center gap-1.5 text-xs text-dark-text-muted hover:text-neon-cyan mb-3 transition-colors pressable"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
              Tất cả chủ sở hữu
            </button>
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                  selected.unassigned
                    ? 'bg-white/5 border-white/10 text-dark-text-muted'
                    : 'bg-neon-purple/20 border-neon-purple/40 text-neon-purple'
                }`}
              >
                {selected.unassigned ? (
                  <UserX className="w-6 h-6 stroke-[1.75]" />
                ) : (
                  <User className="w-6 h-6 stroke-[1.75]" />
                )}
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">
                  {selected.ownerName}
                </h2>
                <p className="text-xs text-dark-text-muted mt-0.5">
                  Dashboard · {selected.accountCount} TK MT5
                  {eqNative.allUsc ? ' · toàn Cent (USC)' : ''}
                  {selectedRegistry?.note ? ` · ${selectedRegistry.note}` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={period}
              onChange={setPeriod}
              options={PERIODS.map((p) => ({ value: p.v, label: p.l }))}
            />
            {!selected.unassigned && (
              <button
                type="button"
                onClick={() => setIsCreateMt5Open(true)}
                className="btn-neon py-2.5 px-4 flex items-center gap-1.5 text-xs pressable"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                Thêm TK MT5
              </button>
            )}
            {selectedRegistry && selected.accountCount === 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Xóa chủ sở hữu "${selected.ownerName}"?`)) return;
                  try {
                    await deleteOwner(selectedRegistry.id);
                    backToList();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Không xóa được.');
                  }
                }}
                className="btn-glass py-2 px-3 text-xs text-neon-pink pressable flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                Xóa
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
          <OwnerKpiCard
            label="Tổng Equity (USD)"
            value={formatUsd(selected.totalEquityUsd)}
            sub={
              centHint
                ? `${centHint} · ≈ ${formatVnd(usdToVnd(selected.totalEquityUsd, vndRate))}`
                : `≈ ${formatVnd(usdToVnd(selected.totalEquityUsd, vndRate))}`
            }
            icon={Wallet}
            accent="kpi-yellow"
          />
          <OwnerKpiCard
            label="Vốn ban đầu (USD)"
            value={formatUsd(initNative.usd)}
            sub={
              initNative.allUsc
                ? `${initNative.totalUsc.toLocaleString('en-US')} USC · ≈ $${initNative.usd.toFixed(0)}`
                : `Quy USD gộp`
            }
            icon={Layers}
            accent="kpi-blue"
          />
          <OwnerKpiCard
            label="Lãi cộng dồn (USD)"
            value={formatUsd(selected.totalProfitUsd, true)}
            sub={`ROI ${selected.portfolioRoi}% · Equity = vốn + lãi`}
            icon={TrendingUp}
            accent="kpi-green"
            valueClass={profitPos ? 'text-neon-green' : 'text-neon-pink'}
          />
          <OwnerKpiCard
            label="PnL hôm nay (USD)"
            value={formatUsd(todayUscOrUsd, true)}
            sub={
              eqNative.allUsc && todayNative !== 0
                ? `${todayNative >= 0 ? '+' : ''}${Math.round(todayNative).toLocaleString('en-US')} USC`
                : 'Theo closeTime local'
            }
            icon={Activity}
            accent="kpi-cyan"
            valueClass={
              todayUscOrUsd >= 0 ? 'text-neon-cyan' : 'text-neon-pink'
            }
          />
          <OwnerKpiCard
            label="Rủi ro / Lệnh"
            value={
              selected.accountCount > 0
                ? `${selected.avgRiskScore} · ${selected.totalTrades}`
                : '—'
            }
            sub={`WR ${selected.avgWinRate}% · DD ${selected.avgDrawdown}% · PF ${selected.avgProfitFactor}`}
            icon={ShieldAlert}
            accent="kpi-pink"
            valueClass="text-neon-pink"
          />
        </div>

        {eqNative.allUsc && (
          <div className="rounded-2xl border border-neon-cyan/25 bg-neon-cyan/5 px-4 py-3 text-[11px] text-dark-text-muted leading-relaxed">
            <strong className="text-neon-cyan">Cent account (USC):</strong> 100 USC = 1 USD.
            {selected.accountCount} TK · vốn gộp{' '}
            <strong className="text-white">
              {initNative.totalUsc.toLocaleString('en-US')} USC ≈ ${initNative.usd.toFixed(2)}
            </strong>
            {' · '}equity gộp{' '}
            <strong className="text-white">
              {eqNative.totalUsc.toLocaleString('en-US')} USC ≈ ${selected.totalEquityUsd.toFixed(2)}
            </strong>
            {' · '}lãi cộng dồn ≈ ${selected.totalProfitUsd.toFixed(2)}.
            Công thức: <strong className="text-white">Equity = vốn ban đầu + PnL lệnh (cộng dồn) + nạp/rút</strong>.
            Upload .xlsx mỗi ngày → merge lệnh → tự cập nhật equity & lãi.
          </div>
        )}

        {selected.unassigned && (
          <div className="rounded-2xl border border-neon-yellow/30 bg-neon-yellow/5 px-4 py-3 text-xs text-neon-yellow">
            Các TK này chưa gán chủ. Mở <strong>Cấu hình</strong> trên từng thẻ để chọn chủ sở hữu đã đăng ký.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-neon-cyan stroke-[1.75]" />
              Tài khoản MT5 của {selected.ownerName}
            </h3>
            <span className="text-[10px] font-mono text-neon-cyan bg-neon-cyan/10 px-2 py-0.5 rounded-full border border-neon-cyan/20">
              {selected.accountCount.toString().padStart(2, '0')}
            </span>
          </div>

          {selected.accounts.length === 0 ? (
            <div className="neon-card-premium neon-card-static p-10 text-center space-y-3">
              <Layers className="w-10 h-10 text-white/15 mx-auto stroke-[1.25]" />
              <p className="text-sm text-dark-text-muted">
                Chưa có TK MT5. Nhập thông tin MT5 để quản lý rủi ro cho {selected.ownerName}.
              </p>
              {!selected.unassigned && (
                <button
                  type="button"
                  onClick={() => setIsCreateMt5Open(true)}
                  className="btn-neon py-2.5 px-5 text-sm inline-flex items-center gap-1.5 pressable"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                  Thêm TK MT5 đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start content-start">
              {selected.accounts.map((acc, i) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  accentIndex={i}
                  onSelect={() => openAccountDetail(acc.id)}
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingAccount(acc);
                    setIsEditOpen(true);
                  }}
                />
              ))}
              {!selected.unassigned && (
                <button
                  type="button"
                  onClick={() => setIsCreateMt5Open(true)}
                  className="w-full self-start min-h-[140px] rounded-3xl border border-dashed border-white/20 bg-transparent hover:border-neon-cyan/45 hover:bg-neon-cyan/[0.04] flex flex-col items-center justify-center text-center p-5 transition-all pressable group"
                >
                  <div className="w-11 h-11 rounded-full border border-white/15 bg-white/5 flex items-center justify-center mb-2.5 text-dark-text-muted group-hover:text-neon-cyan group-hover:border-neon-cyan/40 transition-colors">
                    <Plus className="w-5 h-5 stroke-[1.75]" />
                  </div>
                  <span className="text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors">
                    Thêm TK MT5
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {selected.accounts.length > 0 && (
          <div className="neon-card-premium neon-card-static overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-purple stroke-[1.75]" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Bảng tài khoản
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs glass-table">
                <thead>
                  <tr className="text-dark-text-muted border-b border-white/5">
                    <th className="px-4 py-3 font-semibold">MT5 ID</th>
                    <th className="px-4 py-3 font-semibold">Tên</th>
                    <th className="px-4 py-3 font-semibold">Broker</th>
                    <th className="px-4 py-3 font-semibold text-right">Equity ($)</th>
                    <th className="px-4 py-3 font-semibold text-right">Profit ($)</th>
                    <th className="px-4 py-3 font-semibold text-right">DD%</th>
                    <th className="px-4 py-3 font-semibold text-right">Risk</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {selected.accounts.map((acc) => {
                    const eq = toUsd(acc.currentEquity, acc.currency);
                    const allTrades = acc.trades || [];
                    const allMoves = acc.capitalMoves || [];
                    const ft = filterTradesByPeriod(allTrades, period);
                    const cutoff = periodCutoffMs(allTrades, period);
                    const startCap =
                      cutoff == null
                        ? acc.initialCapital
                        : equityAtCutoff(allTrades, acc.initialCapital, allMoves, cutoff);
                    const movesInPeriod =
                      cutoff == null
                        ? allMoves
                        : filterCapitalMovesByPeriod(allMoves, cutoff);
                    const periodStats = calculateStats(ft, startCap, movesInPeriod);
                    const pnl = toUsd(periodStats.netProfit, acc.currency);
                    return (
                      <tr
                        key={acc.id}
                        className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                        onClick={() => openAccountDetail(acc.id)}
                      >
                        <td className="px-4 py-3 font-mono text-neon-cyan">{acc.id}</td>
                        <td className="px-4 py-3 text-white">{acc.accountName || '—'}</td>
                        <td className="px-4 py-3 text-dark-text-muted">
                          {acc.broker} · {acc.server}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {formatUsd(eq)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono ${
                            pnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
                          }`}
                        >
                          {formatUsd(pnl, true)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-neon-pink">
                          {periodStats.maxDrawdown}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{acc.riskScore}</td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="w-4 h-4 text-dark-text-muted inline stroke-[1.75]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <EditAccountModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setEditingAccount(null);
          }}
          account={editingAccount}
        />
        <CreateAccountModal
          isOpen={isCreateMt5Open}
          onClose={() => setIsCreateMt5Open(false)}
          defaultOwnerName={selected.unassigned ? '' : selected.ownerName}
          lockOwner={!selected.unassigned}
        />
      </div>
    );
  }

  if (selectedKey && !selected) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-dark-text-muted">Không tìm thấy chủ sở hữu này.</p>
        <button type="button" onClick={backToList} className="btn-neon py-2 px-4 text-xs">
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // ——— Danh sách owners ———
  const totalPeople = summaries.filter((s) => !s.unassigned).length;
  const unassignedCount =
    summaries.find((s) => s.ownerKey === UNASSIGNED_OWNER_KEY)?.accountCount || 0;
  const totalProfitAll = summaries.reduce((s, o) => s + o.totalProfitUsd, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="icon-tile icon-tile-purple">
              <Users className="w-4 h-4 stroke-[1.75]" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-white tracking-tight">
              Chủ sở hữu <span className="neon-gradient-text">& Dashboard</span>
            </h2>
          </div>
          <p className="text-xs text-dark-text-muted mt-1.5 font-medium">
            Bước 1: tạo người · Bước 2: mở dashboard · Bước 3: thêm TK MT5
            {totalPeople > 0 && (
              <>
                {' · '}
                {totalPeople} người · PnL{' '}
                <span className={totalProfitAll >= 0 ? 'text-neon-green' : 'text-neon-pink'}>
                  {formatUsd(totalProfitAll, true)}
                </span>
              </>
            )}
            {unassignedCount > 0 && (
              <span className="text-neon-yellow"> · {unassignedCount} TK chưa phân</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p.v, label: p.l }))}
          />
          <button
            type="button"
            onClick={() => setIsCreateOwnerOpen(true)}
            className="btn-neon py-2.5 px-5 flex items-center gap-2 text-sm pressable"
          >
            <UserPlus className="w-4 h-4 stroke-[1.75]" />
            Tạo chủ sở hữu
          </button>
        </div>
      </div>

      {/* Flow steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { n: '1', t: 'Tạo chủ sở hữu', d: 'Tên người quản lý TK' },
          { n: '2', t: 'Mở dashboard', d: 'Xem KPI gộp theo người' },
          { n: '3', t: 'Thêm TK MT5', d: 'Nhập ID, server, vốn…' },
        ].map((s) => (
          <div
            key={s.n}
            className="neon-card-premium neon-card-static p-4 flex items-center gap-3"
          >
            <span className="w-8 h-8 rounded-full bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan text-sm font-semibold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <p className="text-xs font-semibold text-white">{s.t}</p>
              <p className="text-[10px] text-dark-text-muted">{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      {summaries.filter((s) => !s.unassigned || s.accountCount > 0).length === 0 ? (
        <div className="neon-card-premium neon-card-static p-12 text-center space-y-4">
          <Users className="w-12 h-12 text-white/15 mx-auto stroke-[1.25]" />
          <div>
            <p className="text-base font-semibold text-white">Chưa có chủ sở hữu</p>
            <p className="text-sm text-dark-text-muted mt-1 max-w-md mx-auto">
              Tạo người trước (Tôi, Anh A…). Mỗi người có dashboard riêng, sau đó mới gắn TK MT5.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOwnerOpen(true)}
            className="btn-neon py-2.5 px-6 text-sm inline-flex items-center gap-1.5 pressable"
          >
            <UserPlus className="w-4 h-4 stroke-[1.75]" />
            Tạo chủ sở hữu đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries
            .filter((s) => !s.unassigned || s.accountCount > 0)
            .map((s) => (
              <OwnerRow
                key={s.ownerKey}
                summary={s}
                vndRate={vndRate}
                onOpen={() => openOwner(s.ownerKey)}
              />
            ))}
        </div>
      )}

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

export default function OwnersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 rounded-full border-4 border-neon-purple border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-neon-purple uppercase tracking-widest">
            Loading…
          </p>
        </div>
      }
    >
      <OwnersContent />
    </Suspense>
  );
}
