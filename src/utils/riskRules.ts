import { TradingAccount } from '../store/useTradingStore';
import { toUsd } from './currency';

export interface RiskRuleConfig {
  enabled: boolean;
  maxDrawdownPct: number; // e.g. 5
  maxRiskScore: number; // e.g. 70
  minProfitFactor: number; // e.g. 1.0 — PF dưới mức này cảnh báo
  maxDailyLossPct: number; // e.g. 3 — ước từ trades cùng ngày gần nhất
  telegramOnBreach: boolean;
}

export const DEFAULT_RISK_RULES: RiskRuleConfig = {
  enabled: true,
  maxDrawdownPct: 8,
  maxRiskScore: 75,
  minProfitFactor: 1.0,
  maxDailyLossPct: 3,
  telegramOnBreach: true,
};

export interface RuleBreach {
  accountId: string;
  accountName: string;
  rule: string;
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  limit: number;
}

export function evaluateRiskRules(
  accounts: TradingAccount[],
  rules: RiskRuleConfig
): RuleBreach[] {
  if (!rules.enabled || !accounts.length) return [];

  const breaches: RuleBreach[] = [];

  accounts.forEach((acc) => {
    const name = acc.accountName || acc.id;
    const equity = toUsd(acc.currentEquity, acc.currency);
    const initial = toUsd(acc.initialCapital, acc.currency) || equity || 1;

    // Max DD
    if (acc.stats.maxDrawdown > rules.maxDrawdownPct) {
      breaches.push({
        accountId: acc.id,
        accountName: name,
        rule: 'MAX_DRAWDOWN',
        severity: acc.stats.maxDrawdown > rules.maxDrawdownPct * 1.5 ? 'critical' : 'warning',
        message: `Max DD ${acc.stats.maxDrawdown}% vượt ngưỡng ${rules.maxDrawdownPct}%`,
        value: acc.stats.maxDrawdown,
        limit: rules.maxDrawdownPct,
      });
    }

    // Risk score (cao = xấu)
    if (acc.riskScore > rules.maxRiskScore) {
      breaches.push({
        accountId: acc.id,
        accountName: name,
        rule: 'RISK_SCORE',
        severity: acc.riskScore >= 85 ? 'critical' : 'warning',
        message: `AI Risk Score ${acc.riskScore} > ${rules.maxRiskScore}`,
        value: acc.riskScore,
        limit: rules.maxRiskScore,
      });
    }

    // Profit factor (chỉ khi có đủ lệnh)
    if (
      acc.stats.totalTrades >= 5 &&
      acc.stats.profitFactor > 0 &&
      acc.stats.profitFactor < rules.minProfitFactor
    ) {
      breaches.push({
        accountId: acc.id,
        accountName: name,
        rule: 'PROFIT_FACTOR',
        severity: 'warning',
        message: `Profit Factor ${acc.stats.profitFactor} < ${rules.minProfitFactor}`,
        value: acc.stats.profitFactor,
        limit: rules.minProfitFactor,
      });
    }

    // Daily loss: chỉ đánh giá NGÀY HÔM NAY (local), không fire mãi vì ngày lỗ cũ
    if (acc.trades?.length && rules.maxDailyLossPct > 0) {
      const dayKeyOf = (s: string) => {
        const m = String(s || '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
        if (!m) return '';
        return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      };
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      let dayPnl = 0;
      let hasToday = false;
      acc.trades.forEach((t) => {
        if (dayKeyOf(t.closeTime || t.openTime) === todayKey) {
          hasToday = true;
          dayPnl += t.profit + t.commission + t.swap;
        }
      });
      if (hasToday) {
        const dayPnlUsd = toUsd(dayPnl, acc.currency);
        // Prop-style: % so với equity hiện tại (fallback initial)
        const base = equity > 0 ? equity : initial;
        const dayLossPct =
          dayPnlUsd < 0 ? (Math.abs(dayPnlUsd) / base) * 100 : 0;
        if (dayLossPct > rules.maxDailyLossPct) {
          breaches.push({
            accountId: acc.id,
            accountName: name,
            rule: 'DAILY_LOSS',
            severity: 'critical',
            message: `Lỗ ngày ${todayKey}: ${dayLossPct.toFixed(1)}% > ${rules.maxDailyLossPct}%`,
            value: Math.round(dayLossPct * 10) / 10,
            limit: rules.maxDailyLossPct,
          });
        }
      }
    }

    // Equity dưới 50% initial
    if (equity < initial * 0.5 && initial > 0) {
      breaches.push({
        accountId: acc.id,
        accountName: name,
        rule: 'EQUITY_HALVED',
        severity: 'critical',
        message: `Equity còn ~${((equity / initial) * 100).toFixed(0)}% vốn ban đầu`,
        value: equity,
        limit: initial * 0.5,
      });
    }
  });

  return breaches;
}

export function formatBreachesForTelegram(breaches: RuleBreach[]): string {
  if (!breaches.length) return '';
  const lines = breaches.slice(0, 8).map((b) => {
    const icon = b.severity === 'critical' ? '🚨' : '⚠️';
    return `${icon} <b>${b.accountName}</b>\n${b.message}`;
  });
  return `🛡 <b>[GoldQuant] Risk Rules Breach</b>\n${lines.join('\n\n')}`;
}

/** Fingerprint ổn định cho anti-spam Telegram (AppLayout + Tools) */
export function breachKey(b: RuleBreach): string {
  return `${b.accountId}:${b.rule}:${Math.round(b.value * 10)}`;
}
