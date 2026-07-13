'use client';

import React, { useEffect, useState } from 'react';
import { TradingAccount } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { GitCompareArrows } from 'lucide-react';

interface Props {
  accounts: TradingAccount[];
}

export default function CompareAccounts({ accounts }: Props) {
  const [a, setA] = useState(accounts[0]?.id || '');
  const [b, setB] = useState(accounts[1]?.id || accounts[0]?.id || '');

  // Khi filter owner đổi list — clamp selection về id còn tồn tại
  useEffect(() => {
    if (!accounts.length) return;
    const ids = new Set(accounts.map((x) => x.id));
    if (!ids.has(a)) setA(accounts[0].id);
    if (!ids.has(b)) setB(accounts[1]?.id || accounts[0].id);
  }, [accounts, a, b]);

  if (accounts.length < 1) return null;

  const accA = accounts.find((x) => x.id === a);
  const accB = accounts.find((x) => x.id === b);

  const rows: { label: string; va: string; vb: string; better?: 'a' | 'b' | 'eq' }[] = [];

  if (accA && accB) {
    const metrics: {
      label: string;
      get: (x: TradingAccount) => number;
      format: (n: number, x: TradingAccount) => string;
      higherBetter: boolean;
    }[] = [
      {
        label: 'Equity (USD)',
        get: (x) => toUsd(x.currentEquity, x.currency),
        format: (n) => `$${Math.round(n).toLocaleString()}`,
        higherBetter: true,
      },
      {
        label: 'Net Profit (USD)',
        get: (x) => toUsd(x.stats.netProfit, x.currency),
        format: (n) => `${n >= 0 ? '+' : ''}$${Math.round(n).toLocaleString()}`,
        higherBetter: true,
      },
      {
        label: 'Win Rate',
        get: (x) => x.stats.winRate,
        format: (n) => `${n}%`,
        higherBetter: true,
      },
      {
        label: 'Profit Factor',
        get: (x) => x.stats.profitFactor,
        format: (n) => String(n),
        higherBetter: true,
      },
      {
        label: 'Max Drawdown',
        get: (x) => x.stats.maxDrawdown,
        format: (n) => `${n}%`,
        higherBetter: false,
      },
      {
        label: 'Sharpe',
        get: (x) => x.stats.sharpeRatio,
        format: (n) => String(n),
        higherBetter: true,
      },
      {
        label: 'Risk Score',
        get: (x) => x.riskScore,
        format: (n) => String(n),
        higherBetter: false,
      },
      {
        label: 'Total Trades',
        get: (x) => x.stats.totalTrades,
        format: (n) => String(n),
        higherBetter: true,
      },
    ];

    metrics.forEach((m) => {
      const va = m.get(accA);
      const vb = m.get(accB);
      let better: 'a' | 'b' | 'eq' = 'eq';
      if (va !== vb) {
        if (m.higherBetter) better = va > vb ? 'a' : 'b';
        else better = va < vb ? 'a' : 'b';
      }
      rows.push({
        label: m.label,
        va: m.format(va, accA),
        vb: m.format(vb, accB),
        better,
      });
    });
  }

  return (
    <div className="neon-card-premium p-4 kpi-purple h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="icon-tile icon-tile-purple">
          <GitCompareArrows className="w-4 h-4 stroke-[1.75]" />
        </div>
        <div>
          <h4 className="text-[11px] font-semibold text-white uppercase tracking-wider">
            Compare Accounts
          </h4>
          <p className="text-[10px] text-dark-text-muted">So sánh 2 tài khoản side-by-side</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <select
          value={a}
          onChange={(e) => setA(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-full px-3 py-2 text-xs text-white"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.accountName || acc.id}
            </option>
          ))}
        </select>
        <select
          value={b}
          onChange={(e) => setB(e.target.value)}
          className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.accountName || acc.id}
            </option>
          ))}
        </select>
      </div>

      {accA && accB ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-dark-text-muted uppercase px-1 mb-1">
            <span>Metric</span>
            <span className="text-neon-cyan truncate">{accA.accountName || accA.id}</span>
            <span className="text-neon-pink truncate">{accB.accountName || accB.id}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-3 gap-2 text-xs py-2 px-2 rounded-lg bg-dark-card border border-dark-border"
            >
              <span className="text-dark-text-muted font-semibold">{r.label}</span>
              <span
                className={`font-mono font-bold ${
                  r.better === 'a' ? 'text-neon-green' : 'text-white'
                }`}
              >
                {r.va}
              </span>
              <span
                className={`font-mono font-bold ${
                  r.better === 'b' ? 'text-neon-green' : 'text-white'
                }`}
              >
                {r.vb}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-dark-text-muted">Cần ít nhất 1 tài khoản.</p>
      )}
    </div>
  );
}
