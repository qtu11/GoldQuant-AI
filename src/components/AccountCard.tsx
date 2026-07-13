'use client';

import React from 'react';
import { TradingAccount } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { calculateRiskScore } from '../utils/analytics';
import { displayOwnerName, isUnassignedOwner } from '../utils/ownerStats';
import {
  Settings,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  User,
} from 'lucide-react';
import styles from './AccountCard.module.css';

interface AccountCardProps {
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

export default function AccountCard({
  account,
  onSelect,
  onEdit,
  accentIndex = 0,
}: AccountCardProps) {
  const {
    stats,
    id,
    broker,
    server,
    symbol,
    currentEquity,
    currency,
    accountType,
    accountName,
    leverage,
    ownerName,
  } = account;

  const risk = calculateRiskScore(stats);
  const riskScore = risk.score;
  const status =
    risk.label === 'HEALTHY' ? 'Healthy' : risk.label === 'MODERATE' ? 'Moderate' : 'High Risk';

  const equityUsd = toUsd(currentEquity, currency);
  const profitUsd = toUsd(stats.netProfit, currency);
  const isProfitPositive = profitUsd >= 0;
  const isCent = currency === 'USC';
  const ownerLabel = displayOwnerName(ownerName);
  const unassigned = isUnassignedOwner(ownerName);

  const StatusIcon =
    status === 'Healthy' ? CheckCircle2 : status === 'Moderate' ? AlertTriangle : XOctagon;

  const equityMain = isCent
    ? `${Math.round(currentEquity).toLocaleString()} USC`
    : `$${Math.round(currentEquity).toLocaleString()}`;

  const profitMain = `${isProfitPositive ? '+' : ''}${
    isCent
      ? Math.round(stats.netProfit).toLocaleString()
      : `$${Math.round(stats.netProfit).toLocaleString()}`
  }`;

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
      {/* Header: ID + name | chips + settings */}
      <div className={styles.header}>
        <div className={styles.idBlock}>
          <div className={styles.id}>{id}</div>
          {accountName ? <div className={styles.name}>{accountName}</div> : null}
        </div>

        <div className={styles.badges}>
          {leverage ? (
            <span className={`${styles.chip} ${styles.chipYellow} ${styles.chipMono}`}>
              1:{leverage}
            </span>
          ) : null}
          {isCent ? (
            <span className={`${styles.chip} ${styles.chipCyan}`}>Cent</span>
          ) : null}
          <span className={`${styles.chip} ${statusChipClass(status)}`}>
            <StatusIcon width={12} height={12} strokeWidth={1.75} />
            {status}
          </span>
          <button
            type="button"
            title="Cấu hình tài khoản"
            className={styles.settingsBtn}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e);
            }}
          >
            <Settings width={16} height={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Owner */}
      <div
        className={`${styles.owner} ${unassigned ? styles.ownerUnassigned : styles.ownerAssigned}`}
      >
        <User width={12} height={12} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        <span className={styles.ownerText}>{ownerLabel}</span>
      </div>

      {/* Broker meta */}
      <p className={styles.meta}>
        {broker} · {server} · {symbol} · {accountType}
      </p>

      {/* Metrics */}
      <div className={styles.metrics}>
        <div>
          <div className={styles.metricLabel}>Equity</div>
          <div className={styles.metricValue}>{equityMain}</div>
          {isCent ? (
            <div className={styles.metricSub}>≈ ${Math.round(equityUsd).toLocaleString()}</div>
          ) : null}
        </div>
        <div>
          <div className={styles.metricLabel}>Profit</div>
          <div
            className={`${styles.metricValue} ${isProfitPositive ? styles.profitPos : styles.profitNeg}`}
          >
            {profitMain}
          </div>
          {isCent ? (
            <div className={`${styles.metricSub} ${isProfitPositive ? styles.subPos : styles.subNeg}`}>
              ≈ ${Math.round(profitUsd).toLocaleString()}
            </div>
          ) : null}
        </div>
        <div>
          <div className={styles.metricLabel}>Max DD</div>
          <div className={`${styles.metricValue} ${styles.ddValue}`}>{stats.maxDrawdown}%</div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.stats}>
          <span className={styles.statItem}>
            <BarChart2
              width={14}
              height={14}
              strokeWidth={1.75}
              className={styles.iconPurple}
            />
            <strong className={styles.statStrong}>{stats.totalTrades}</strong>
            <span>trades</span>
          </span>
          <span>
            PF <strong className={styles.statCyan}>{stats.profitFactor}</strong>
          </span>
          <span>
            WR <strong className={styles.statYellow}>{stats.winRate}%</strong>
          </span>
        </div>
        <span className={`${styles.chip} ${riskChipClass(riskScore)}`}>RISK {riskScore}</span>
      </div>
    </article>
  );
}
