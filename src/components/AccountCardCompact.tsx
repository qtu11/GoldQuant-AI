'use client';

import React from 'react';
import { TradingAccount } from '../store/useTradingStore';
import { formatMoneyDual, toUsd } from '../utils/currency';
import { calculateRiskScore } from '../utils/analytics';
import { displayOwnerName, isUnassignedOwner } from '../utils/ownerStats';
import {
  Settings,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  ChevronRight,
} from 'lucide-react';
import styles from './AccountCardCompact.module.css';

interface AccountCardCompactProps {
  account: TradingAccount;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  accentIndex?: number;
}

const ACCENT = [
  styles.accent0,
  styles.accent1,
  styles.accent2,
  styles.accent3,
  styles.accent4,
  styles.accent5,
] as const;

function statusChipClass(status: string) {
  if (status === 'Healthy') return styles.chipGreen;
  if (status === 'Moderate') return styles.chipYellow;
  return styles.chipPink;
}

function riskChipClass(score: number) {
  if (score < 30) return styles.chipGreen;
  if (score < 60) return styles.chipYellow;
  return styles.chipPink;
}

export default function AccountCardCompact({
  account,
  onSelect,
  onEdit,
  accentIndex = 0,
}: AccountCardCompactProps) {
  const {
    stats,
    id,
    currentEquity,
    currency,
    accountName,
    ownerName,
  } = account;

  const risk = calculateRiskScore(stats);
  const riskScore = risk.score;
  const status =
    risk.label === 'HEALTHY' ? 'Healthy' : risk.label === 'MODERATE' ? 'Moderate' : 'High Risk';

  const profitUsd = toUsd(stats.netProfit, currency);
  const isProfitPositive = profitUsd >= 0;
  const isCent = currency === 'USC';
  const ownerLabel = displayOwnerName(ownerName);
  const unassigned = isUnassignedOwner(ownerName);

  const StatusIcon =
    status === 'Healthy' ? CheckCircle2 : status === 'Moderate' ? AlertTriangle : XOctagon;

  const equityDual = formatMoneyDual(currentEquity, currency);
  const profitDual = formatMoneyDual(stats.netProfit, currency, { signed: true });
  const equityDisplay = isCent
    ? `${equityDual.primary} ${equityDual.secondary}`
    : equityDual.primary;
  const profitDisplay = isCent
    ? `${profitDual.primary} ${profitDual.secondary}`
    : profitDual.primary;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`neon-card-premium ${styles.root} ${ACCENT[accentIndex % ACCENT.length]}`}
    >
      {/* Left: Owner + Account ID */}
      <div className={styles.ownerBlock}>
        <span className={`${styles.ownerName} ${unassigned ? styles.ownerNameUnassigned : ''}`}>
          {ownerLabel}
        </span>
        <span className={styles.accountId}>{id}</span>
        {accountName ? <span className={styles.accountName}>{accountName}</span> : null}
      </div>

      {/* Center: Profit + Equity */}
      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Profit</span>
          <span
            className={`${styles.metricValue} ${isProfitPositive ? styles.profitPos : styles.profitNeg}`}
          >
            {profitDisplay}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Equity</span>
          <span className={styles.metricValue}>{equityDisplay}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Win Rate</span>
          <span className={styles.metricValue}>{stats.winRate}%</span>
        </div>
      </div>

      {/* Right: Status + Risk + Settings */}
      <div className={styles.badgesCol}>
        <div className={styles.badgeRow}>
          <span className={`${styles.chip} ${statusChipClass(status)}`}>
            <StatusIcon width={10} height={10} strokeWidth={1.75} />
            {status}
          </span>
          <span className={`${styles.chip} ${riskChipClass(riskScore)}`}>
            R{riskScore}
          </span>
        </div>
        <div className={styles.badgeRow}>
          {isCent ? (
            <span className={`${styles.chip} ${styles.chipCyan}`}>Cent</span>
          ) : null}
          <button
            type="button"
            title="Cấu hình tài khoản"
            className={styles.settingsBtn}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e);
            }}
          >
            <Settings width={13} height={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Arrow indicator */}
      <ChevronRight width={16} height={16} strokeWidth={2} className={styles.arrow} />
    </article>
  );
}
