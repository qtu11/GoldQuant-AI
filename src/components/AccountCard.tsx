'use client';

import React from 'react';
import { TradingAccount } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { Settings, BarChart2, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';

interface AccountCardProps {
  account: TradingAccount;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
}

export default function AccountCard({ account, onSelect, onEdit }: AccountCardProps) {
  const { stats, id, broker, platform, server, symbol, currentEquity, status, riskScore, currency, accountType, accountName, leverage } = account;

  const equityUsd = toUsd(currentEquity, currency);
  const profitUsd = toUsd(stats.netProfit, currency);
  const isProfitPositive = profitUsd >= 0;
  const isCent = currency === 'USC';

  const StatusIcon = status === 'Healthy' ? CheckCircle2 : status === 'Moderate' ? AlertTriangle : XOctagon;

  return (
    <div 
      onClick={onSelect}
      className="glass-effect-premium gold-glow-hover rounded-xl p-6 cursor-pointer flex flex-col justify-between h-full relative group active:scale-98 overflow-hidden"
    >
      {/* Background overlay gradient card */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/1 to-transparent opacity-30 pointer-events-none" />

      {/* Decorative corner light */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-[30px] opacity-10 pointer-events-none ${
        status === 'Healthy' 
          ? 'bg-emerald-500' 
          : status === 'Moderate'
            ? 'bg-amber-500'
            : 'bg-red-500'
      }`} />

      {/* Settings Button (Top Right) */}
      <button 
        onClick={onEdit}
        className="absolute top-5 right-5 p-1.5 rounded-lg bg-white/3 border border-white/5 text-dark-text-muted hover:text-gold hover:border-gold/30 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer z-10"
        title="Cấu hình tài khoản"
      >
        <Settings className="w-4 h-4" />
      </button>

      <div>
        {/* Header */}
        <div className="flex items-start justify-between pr-6">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white font-mono tracking-tight group-hover:text-gold transition-colors">{id}</span>
            {accountName && (
              <span className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5">{accountName}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {leverage && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-amber-400 text-[9px] font-bold font-mono">
                1:{leverage}
              </span>
            )}
            {isCent && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider">
                Cent
              </span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase flex items-center gap-1 border ${
              status === 'Healthy' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : status === 'Moderate'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              <StatusIcon className={`w-3.5 h-3.5 ${
                status === 'Healthy' ? 'text-emerald-400' : status === 'Moderate' ? 'text-amber-400' : 'text-red-400'
              }`} />
              <span>{status}</span>
            </span>
          </div>
        </div>

        {/* Info string */}
        <span className="text-[10px] text-dark-text-muted font-semibold tracking-wide mt-2 block">
          {broker} · {server} · {symbol} · {accountType}
        </span>

        {/* Indicators Rows */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/5">
          <div>
            <span className="text-[9px] font-bold text-dark-text-muted uppercase tracking-wider block">Equity</span>
            <span className="text-base font-black text-white font-mono mt-1 block tracking-tight">
              {isCent 
                ? `${Math.round(currentEquity).toLocaleString()} USC` 
                : `$${Math.round(currentEquity).toLocaleString()}`
              }
            </span>
            {isCent && (
              <span className="text-[9px] text-dark-text-muted font-mono block mt-0.5">
                ≈ ${Math.round(equityUsd).toLocaleString()}
              </span>
            )}
          </div>
          <div>
            <span className="text-[9px] font-bold text-dark-text-muted uppercase tracking-wider block">Profit</span>
            <span className={`text-base font-black font-mono mt-1 block tracking-tight ${isProfitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isProfitPositive ? '+' : ''}
              {isCent 
                ? `${Math.round(stats.netProfit).toLocaleString()}` 
                : `$${Math.round(stats.netProfit).toLocaleString()}`
              }
            </span>
            {isCent && (
              <span className={`text-[9px] font-mono block mt-0.5 ${isProfitPositive ? 'text-emerald-400/50' : 'text-red-400/50'}`}>
                ≈ ${Math.round(profitUsd).toLocaleString()}
              </span>
            )}
          </div>
          <div>
            <span className="text-[9px] font-bold text-dark-text-muted uppercase tracking-wider block">Max DD</span>
            <span className="text-base font-black text-white font-mono mt-1 block tracking-tight">
              {stats.maxDrawdown}%
            </span>
          </div>
        </div>
      </div>

      {/* Footer statistics bar */}
      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] text-dark-text-muted">
        <div className="flex items-center gap-3 font-mono">
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-dark-text-muted" />
            <strong className="text-white font-bold">{stats.totalTrades}</strong> trades
          </span>
          <span>PF <strong className="text-white font-bold">{stats.profitFactor}</strong></span>
          <span>WR <strong className="text-white font-bold">{stats.winRate}%</strong></span>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
          riskScore >= 90 
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
            : riskScore >= 75 
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/10' 
              : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        }`}>
          RISK {riskScore}
        </span>
      </div>
    </div>
  );
}
