'use client';

import React, { useState } from 'react';
import { TradingAccount } from '../store/useTradingStore';
import { toUsd, formatUsd } from '../utils/currency';
import { calculateRiskScore, filterTradesByPeriod, calculateStats } from '../utils/analytics';
import { displayOwnerName, isUnassignedOwner } from '../utils/ownerStats';
import {
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Settings,
} from 'lucide-react';
import styles from './OwnerRow.module.css';

interface OwnerRowProps {
  ownerName: string;
  accounts: TradingAccount[];
  accentIndex?: number;
  /** Period filter overview — profit theo kỳ (default all) */
  period?: string;
  onSelectAccount: (id: string) => void;
  onEditAccount: (acc: TradingAccount, e: React.MouseEvent) => void;
}

const ACCENT = [
  styles.accent0,
  styles.accent1,
  styles.accent2,
  styles.accent3,
  styles.accent4,
  styles.accent5,
] as const;

function statusIcon(status: string) {
  if (status === 'Healthy') return CheckCircle2;
  if (status === 'Moderate') return AlertTriangle;
  return XOctagon;
}

function statusChip(status: string) {
  if (status === 'Healthy') return styles.chipGreen;
  if (status === 'Moderate') return styles.chipYellow;
  return styles.chipPink;
}

export default function OwnerRow({
  ownerName,
  accounts,
  accentIndex = 0,
  period = 'all',
  onSelectAccount,
  onEditAccount,
}: OwnerRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const label = displayOwnerName(ownerName);
  const unassigned = isUnassignedOwner(ownerName);

  // Aggregate stats — profit theo period (khớp KPI overview)
  const totalEquityUsd = accounts.reduce(
    (sum, a) => sum + toUsd(a.currentEquity, a.currency),
    0
  );
  const totalProfitUsd = accounts.reduce((sum, a) => {
    if (period === 'all') {
      return sum + toUsd(a.stats.netProfit, a.currency);
    }
    // Period: chỉ PnL lệnh trong kỳ (không trộn capital moves full life)
    const ft = filterTradesByPeriod(a.trades || [], period);
    const st = calculateStats(ft, a.initialCapital, []);
    return sum + toUsd(st.netProfit, a.currency);
  }, 0);
  const isProfitPositive = totalProfitUsd >= 0;

  // Overall status summary
  let healthyCount = 0;
  let moderateCount = 0;
  let highRiskCount = 0;
  accounts.forEach((a) => {
    const risk = calculateRiskScore(a.stats);
    const s = risk.label === 'HEALTHY' ? 'Healthy' : risk.label === 'MODERATE' ? 'Moderate' : 'High Risk';
    if (s === 'Healthy') healthyCount++;
    else if (s === 'Moderate') moderateCount++;
    else highRiskCount++;
  });

  // Avatar initial
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className={`neon-card-premium ${styles.root}`}>
      {/* Header — always visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`${styles.header} ${isOpen ? styles.headerOpen : ''} ${ACCENT[accentIndex % ACCENT.length]}`}
      >
        {/* Avatar */}
        <div className={`${styles.avatar} ${unassigned ? styles.avatarUnassigned : ''}`}>
          {initial}
        </div>

        {/* Owner info */}
        <div className={styles.info}>
          <span className={`${styles.ownerName} ${unassigned ? styles.ownerNameUnassigned : ''}`}>
            {label}
          </span>
          <span className={styles.accountCount}>
            {accounts.length} tài khoản
          </span>
        </div>

        {/* Metrics */}
        <div className={styles.metricsRow}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Lợi nhuận</span>
            <span
              className={`${styles.metricValue} ${isProfitPositive ? styles.profitPos : styles.profitNeg}`}
            >
              {isProfitPositive ? '+' : ''}{formatUsd(totalProfitUsd)}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Equity</span>
            <span className={styles.metricValue}>{formatUsd(totalEquityUsd)}</span>
          </div>
        </div>

        {/* Status summary */}
        <div className={styles.statusSummary}>
          {healthyCount > 0 && (
            <span className={`${styles.chip} ${styles.chipGreen}`}>
              {healthyCount} ✓
            </span>
          )}
          {moderateCount > 0 && (
            <span className={`${styles.chip} ${styles.chipYellow}`}>
              {moderateCount} ⚠
            </span>
          )}
          {highRiskCount > 0 && (
            <span className={`${styles.chip} ${styles.chipPink}`}>
              {highRiskCount} ✕
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight
          width={16}
          height={16}
          strokeWidth={2}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </div>

      {/* Expanded: individual accounts */}
      <div className={`${styles.content} ${isOpen ? styles.contentOpen : ''}`}>
        {accounts.map((acc) => {
          const risk = calculateRiskScore(acc.stats);
          const riskScore = risk.score;
          const status =
            risk.label === 'HEALTHY'
              ? 'Healthy'
              : risk.label === 'MODERATE'
                ? 'Moderate'
                : 'High Risk';
          const StatusIcon = statusIcon(status);
          const isCent = acc.currency === 'USC';
          const profitVal = acc.stats.netProfit;
          const isPos = profitVal >= 0;

          const profitStr = isCent
            ? `${isPos ? '+' : ''}${Math.round(profitVal).toLocaleString()} USC`
            : `${isPos ? '+' : ''}$${Math.round(profitVal).toLocaleString()}`;

          const equityStr = isCent
            ? `${Math.round(acc.currentEquity).toLocaleString()} USC`
            : `$${Math.round(acc.currentEquity).toLocaleString()}`;

          return (
            <div
              key={acc.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectAccount(acc.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAccount(acc.id);
                }
              }}
              className={styles.accountItem}
            >
              <span className={styles.accId}>{acc.id}</span>
              {acc.accountName && (
                <span className={styles.accName}>{acc.accountName}</span>
              )}

              <div className={styles.accMetrics}>
                <div className={styles.accMetric}>
                  <span className={styles.accMetricLabel}>Profit</span>
                  <span
                    className={`${styles.accMetricValue} ${isPos ? styles.profitPos : styles.profitNeg}`}
                  >
                    {profitStr}
                  </span>
                </div>
                <div className={styles.accMetric}>
                  <span className={styles.accMetricLabel}>Equity</span>
                  <span className={styles.accMetricValue}>{equityStr}</span>
                </div>
                <div className={styles.accMetric}>
                  <span className={styles.accMetricLabel}>WR</span>
                  <span className={styles.accMetricValue}>{acc.stats.winRate}%</span>
                </div>

                <span className={`${styles.accChip} ${statusChip(status)}`}>
                  <StatusIcon width={9} height={9} strokeWidth={1.75} />
                  {status}
                </span>
                <span className={`${styles.accChip} ${riskScore < 30 ? styles.chipGreen : riskScore < 60 ? styles.chipYellow : styles.chipPink}`}>
                  R{riskScore}
                </span>

                <button
                  type="button"
                  title="Cấu hình tài khoản"
                  className={styles.settingsBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAccount(acc, e);
                  }}
                >
                  <Settings width={12} height={12} strokeWidth={1.75} />
                </button>

                <ChevronRight
                  width={14}
                  height={14}
                  strokeWidth={2}
                  className={styles.accArrow}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
