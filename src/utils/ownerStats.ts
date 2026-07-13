import type { OwnerProfile, TradingAccount } from '../store/useTradingStore';
import { toUsd } from './currency';
import {
  calculateStats,
  equityAtCutoff,
  filterCapitalMovesByPeriod,
  filterTradesByPeriod,
  periodCutoffMs,
} from './analytics';
import { totalFloatingPnl } from './capitalEquity';

/** Key nội bộ cho TK chưa gán chủ */
export const UNASSIGNED_OWNER_KEY = '__unassigned__';
export const UNASSIGNED_OWNER_LABEL = 'Chưa phân';

/**
 * Chuẩn hóa tên chủ sở hữu để group (case-insensitive, trim).
 * Trả về key rỗng nếu chưa gán.
 */
export function normalizeOwnerKey(ownerName?: string | null): string {
  const t = (ownerName || '').trim();
  if (!t) return UNASSIGNED_OWNER_KEY;
  return t.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Tên hiển thị chủ sở hữu (giữ casing lần đầu gặp, hoặc label "Chưa phân").
 */
export function displayOwnerName(ownerName?: string | null): string {
  const t = (ownerName || '').trim();
  return t || UNASSIGNED_OWNER_LABEL;
}

export function isUnassignedOwner(ownerName?: string | null): boolean {
  return normalizeOwnerKey(ownerName) === UNASSIGNED_OWNER_KEY;
}

/**
 * Danh sách tên owner đã đăng ký (+ fallback từ accounts).
 * Ưu tiên registry — dùng cho dropdown tạo TK MT5.
 */
export function listKnownOwners(
  accounts: TradingAccount[],
  registeredOwners: OwnerProfile[] = []
): string[] {
  const map = new Map<string, string>();
  registeredOwners.forEach((o) => {
    const key = normalizeOwnerKey(o.name);
    if (key === UNASSIGNED_OWNER_KEY) return;
    map.set(key, o.name.trim());
  });
  accounts.forEach((a) => {
    const key = normalizeOwnerKey(a.ownerName);
    if (key === UNASSIGNED_OWNER_KEY) return;
    if (!map.has(key)) {
      map.set(key, (a.ownerName || '').trim());
    }
  });
  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, 'vi', { sensitivity: 'base' })
  );
}

export interface OwnerSummary {
  /** Key group (lowercase hoặc UNASSIGNED) */
  ownerKey: string;
  /** Tên hiển thị */
  ownerName: string;
  unassigned: boolean;
  accounts: TradingAccount[];
  accountCount: number;
  totalEquityUsd: number;
  totalInitialUsd: number;
  totalProfitUsd: number;
  totalFloatingUsd: number;
  totalTrades: number;
  avgDrawdown: number;
  avgRiskScore: number;
  avgWinRate: number;
  avgProfitFactor: number;
  healthyCount: number;
  moderateCount: number;
  highRiskCount: number;
  /** ROI gộp = profit / initial * 100 */
  portfolioRoi: number;
}

export interface OwnerPeriodOptions {
  /** 'all' | '1w' | '1m' | '1q' — filter trades khi tính profit */
  period?: string;
}

function floatingUsd(acc: TradingAccount): number {
  return toUsd(totalFloatingPnl(acc.openPositions || [], 100, acc.currency), acc.currency);
}

export interface GroupOwnersOptions extends OwnerPeriodOptions {
  /** Owner đã đăng ký — hiện cả người chưa có TK MT5 */
  registeredOwners?: OwnerProfile[];
  /** Ẩn nhóm "Chưa phân" */
  hideUnassigned?: boolean;
}

/**
 * Gộp thống kê theo chủ sở hữu (USD chuẩn).
 * Owner registry (chưa có TK) vẫn xuất hiện với accountCount = 0.
 */
export function groupAccountsByOwner(
  accounts: TradingAccount[],
  options: GroupOwnersOptions = {}
): OwnerSummary[] {
  const period = options.period || 'all';
  const groups = new Map<string, TradingAccount[]>();
  const nameByKey = new Map<string, string>();

  (options.registeredOwners || []).forEach((o) => {
    const key = normalizeOwnerKey(o.name);
    if (key === UNASSIGNED_OWNER_KEY) return;
    if (!groups.has(key)) groups.set(key, []);
    nameByKey.set(key, o.name.trim());
  });

  accounts.forEach((a) => {
    const key = normalizeOwnerKey(a.ownerName);
    const list = groups.get(key) || [];
    list.push(a);
    groups.set(key, list);
    if (key !== UNASSIGNED_OWNER_KEY && !nameByKey.has(key)) {
      nameByKey.set(key, (a.ownerName || '').trim());
    }
  });

  if (options.hideUnassigned) {
    groups.delete(UNASSIGNED_OWNER_KEY);
  }

  const summaries: OwnerSummary[] = [];

  groups.forEach((accs, ownerKey) => {
    const unassigned = ownerKey === UNASSIGNED_OWNER_KEY;
    // Prefer registry name → account name
    const ownerName = unassigned
      ? UNASSIGNED_OWNER_LABEL
      : nameByKey.get(ownerKey) ||
        (accs.find((a) => (a.ownerName || '').trim())?.ownerName || '').trim() ||
        UNASSIGNED_OWNER_LABEL;

    const periodStats = accs.map((a) => {
      const allTrades = a.trades || [];
      const allMoves = a.capitalMoves || [];
      const ft = filterTradesByPeriod(allTrades, period);
      const cutoff = periodCutoffMs(allTrades, period);
      // Period ≠ all: vốn khởi đầu = equity tại cutoff; chỉ moves trong kỳ
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

    const totalEquityUsd = accs.reduce(
      (s, a) => s + toUsd(a.currentEquity, a.currency),
      0
    );
    const totalInitialUsd = accs.reduce(
      (s, a) => s + toUsd(a.initialCapital, a.currency),
      0
    );
    const totalProfitUsd = periodStats.reduce(
      (s, { acc, stats }) => s + toUsd(stats.netProfit, acc.currency),
      0
    );
    const totalFloatingUsd = accs.reduce((s, a) => s + floatingUsd(a), 0);
    const totalTrades = periodStats.reduce((s, p) => s + p.stats.totalTrades, 0);

    const withTrades = periodStats.filter((p) => p.stats.totalTrades > 0);
    const avgDrawdown =
      withTrades.length > 0
        ? Math.round(
            (withTrades.reduce((s, p) => s + p.stats.maxDrawdown, 0) /
              withTrades.length) *
              10
          ) / 10
        : 0;
    const avgWinRate =
      withTrades.length > 0
        ? Math.round(
            (withTrades.reduce((s, p) => s + p.stats.winRate, 0) /
              withTrades.length) *
              10
          ) / 10
        : 0;
    const avgProfitFactor =
      withTrades.length > 0
        ? Math.round(
            (withTrades.reduce((s, p) => s + p.stats.profitFactor, 0) /
              withTrades.length) *
              100
          ) / 100
        : 0;
    const avgRiskScore =
      accs.length > 0
        ? Math.round(accs.reduce((s, a) => s + a.riskScore, 0) / accs.length)
        : 0;

    let healthyCount = 0;
    let moderateCount = 0;
    let highRiskCount = 0;
    accs.forEach((a) => {
      if (a.status === 'Healthy') healthyCount += 1;
      else if (a.status === 'Moderate') moderateCount += 1;
      else highRiskCount += 1;
    });

    const portfolioRoi =
      totalInitialUsd > 0
        ? Math.round((totalProfitUsd / totalInitialUsd) * 1000) / 10
        : 0;

    summaries.push({
      ownerKey,
      ownerName,
      unassigned,
      accounts: [...accs].sort((a, b) => a.id.localeCompare(b.id)),
      accountCount: accs.length,
      totalEquityUsd,
      totalInitialUsd,
      totalProfitUsd,
      totalFloatingUsd,
      totalTrades,
      avgDrawdown,
      avgRiskScore,
      avgWinRate,
      avgProfitFactor,
      healthyCount,
      moderateCount,
      highRiskCount,
      portfolioRoi,
    });
  });

  // Sort: gán trước (profit desc), "Chưa phân" cuối
  summaries.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    if (b.totalProfitUsd !== a.totalProfitUsd) {
      return b.totalProfitUsd - a.totalProfitUsd;
    }
    return a.ownerName.localeCompare(b.ownerName, 'vi', { sensitivity: 'base' });
  });

  return summaries;
}

/**
 * Lấy summary 1 owner theo key.
 */
export function getOwnerSummary(
  accounts: TradingAccount[],
  ownerKey: string,
  options?: GroupOwnersOptions
): OwnerSummary | null {
  return (
    groupAccountsByOwner(accounts, options).find((o) => o.ownerKey === ownerKey) ||
    null
  );
}
