'use client';

import React, { useMemo } from 'react';
import { TradingAccount } from '../store/useTradingStore';
import {
  calculateRiskScore,
  calculateStats,
  equityAtCutoff,
  filterCapitalMovesByPeriod,
  filterTradesByPeriod,
  periodCutoffMs,
} from '../utils/analytics';
import EquityCurveChart from './EquityCurveChart';
import { 
  TrendingUp, 
  Percent, 
  BarChart3, 
  Target, 
  ShieldAlert, 
  Activity, 
  ArrowDownRight, 
  DollarSign,
  HelpCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import SegmentedControl from './ui/SegmentedControl';

interface DetailDashboardProps {
  account: TradingAccount;
  period: string;
  setPeriod: (p: string) => void;
  currencyMode: 'USD' | 'USC';
}

export default function DetailDashboard({ account, period, setPeriod, currencyMode }: DetailDashboardProps) {
  // Period filter: trades + capital moves trong kỳ; vốn khởi đầu = equity tại cutoff
  const { filteredTrades, periodMoves, periodStartCapital } = useMemo(() => {
    const allTrades = account.trades || [];
    const allMoves = account.capitalMoves || [];
    const filtered = filterTradesByPeriod(allTrades, period);
    const cutoff = periodCutoffMs(allTrades, period);
    if (cutoff == null) {
      return {
        filteredTrades: filtered,
        periodMoves: allMoves,
        periodStartCapital: account.initialCapital,
      };
    }
    return {
      filteredTrades: filtered,
      periodMoves: filterCapitalMovesByPeriod(allMoves, cutoff),
      periodStartCapital: equityAtCutoff(allTrades, account.initialCapital, allMoves, cutoff),
    };
  }, [account.trades, account.capitalMoves, account.initialCapital, period]);

  const stats = useMemo(
    () => calculateStats(filteredTrades, periodStartCapital, periodMoves),
    [filteredTrades, periodStartCapital, periodMoves]
  );
  
  // Tính toán lại risk trên client (không dùng riskScore Firestore cũ)
  const {
    score: riskScore,
    healthScore,
    hint: riskHint,
    label: riskLabel,
    color: riskColor,
    subMetrics,
  } = calculateRiskScore(stats);

  const isUscAccount = account.currency === 'USC';
  // USC account + USD mode: /100. USD account + USC mode: *100
  const convertAmount = (amount: number) => {
    if (isUscAccount && currencyMode === 'USD') return amount / 100;
    if (!isUscAccount && currencyMode === 'USC') return amount * 100;
    return amount;
  };
  // Luôn en-US — tránh "1.066" (vi) nhầm với 1.066 thập phân
  const fmtAmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const displayNetProfit = convertAmount(stats.netProfit);
  const displayProfitFormatted =
    currencyMode === 'USD' ? `$${fmtAmt(displayNetProfit)}` : `${fmtAmt(displayNetProfit)} USC`;

  // Monthly ROI: chặn số ảo (1599%) nếu short sample / bug cache
  const monthlyRoiSafe =
    Math.abs(stats.monthlyRoi) > 300 ||
    (stats.totalTrades > 0 &&
      Math.abs(stats.roi) > 0.01 &&
      Math.abs(stats.monthlyRoi) > Math.abs(stats.roi) * 5)
      ? stats.roi
      : stats.monthlyRoi;
  const monthlyIsPeriod =
    Math.abs(monthlyRoiSafe - stats.roi) < 0.15 && stats.totalTrades > 0;

  // Chuẩn bị dữ liệu cho biểu đồ Recharts — Liquid Glass palette
  const sessionData = [
    {
      name: 'Asia',
      Trades: stats.sessionStats.Asia.trades,
      Profit: Math.round(convertAmount(stats.sessionStats.Asia.profit) * 100) / 100,
      Volume: stats.sessionStats.Asia.volume,
      fillTrades: '#4CC9FF',
      fillProfit: '#FFD54F',
    },
    {
      name: 'Europe',
      Trades: stats.sessionStats.Europe.trades,
      Profit: Math.round(convertAmount(stats.sessionStats.Europe.profit) * 100) / 100,
      Volume: stats.sessionStats.Europe.volume,
      fillTrades: '#8A7DFF',
      fillProfit: '#A89BFF',
    },
    {
      name: 'US',
      Trades: stats.sessionStats.US.trades,
      Profit: Math.round(convertAmount(stats.sessionStats.US.profit) * 100) / 100,
      Volume: stats.sessionStats.US.volume,
      fillTrades: '#2DFFB4',
      fillProfit: '#5CFFC8',
    },
  ];

  // Grid 8 thẻ KPI neon
  const metricCards = [
    {
      title: 'Net Profit',
      value: displayProfitFormatted,
      icon: DollarSign,
      color: stats.netProfit >= 0 ? 'text-neon-green' : 'text-rose-400',
      tile: stats.netProfit >= 0 ? 'icon-tile-green' : 'icon-tile-red',
      kpi: 'kpi-green',
      desc: currencyMode !== account.currency
        ? `Lợi nhuận ròng quy đổi ${currencyMode}`
        : 'Lợi nhuận ròng sau phí & swap'
    },
    {
      title: 'ROI',
      value: `${stats.roi}%`,
      icon: Percent,
      color: stats.roi >= 0 ? 'text-neon-cyan' : 'text-rose-400',
      tile: 'icon-tile-cyan',
      kpi: 'kpi-cyan',
      desc: 'Tỷ suất lợi nhuận trên vốn'
    },
    {
      title: 'Monthly ROI',
      value: `${monthlyRoiSafe}%`,
      icon: TrendingUp,
      color: monthlyRoiSafe >= 0 ? 'text-neon-blue' : 'text-rose-400',
      tile: 'icon-tile-blue',
      kpi: 'kpi-blue',
      desc: monthlyIsPeriod
        ? '≈ ROI kỳ (<7 ngày — chưa annualize)'
        : 'ROI quy về ~30 ngày (cap ±300%)',
    },
    {
      title: 'Win Rate',
      value: `${stats.winRate}%`,
      icon: Target,
      color: 'text-neon-yellow',
      tile: 'icon-tile-yellow',
      kpi: 'kpi-yellow',
      desc: 'Thắng / (thắng + thua) — BE không tính',
    },
    {
      title: 'Profit Factor',
      value: stats.profitFactor.toString(),
      icon: BarChart3,
      color: stats.profitFactor >= 1.5 ? 'text-neon-purple' : 'text-neon-orange',
      tile: 'icon-tile-purple',
      kpi: 'kpi-purple',
      desc: 'Tổng lợi nhuận / tổng lỗ'
    },
    {
      title: 'Recovery Factor',
      value: stats.recoveryFactor.toString(),
      icon: Activity,
      color: 'text-neon-pink',
      tile: 'icon-tile-pink',
      kpi: 'kpi-pink',
      desc: 'Khả năng phục hồi tài khoản'
    },
    {
      title: 'Max Drawdown',
      value: `${stats.maxDrawdown}%`,
      icon: ArrowDownRight,
      color: stats.maxDrawdown <= 5 ? 'text-neon-green' : 'text-rose-400',
      tile: stats.maxDrawdown <= 5 ? 'icon-tile-green' : 'icon-tile-red',
      kpi: 'kpi-pink',
      desc: 'Sụt giảm vốn lớn nhất từ đỉnh'
    },
    {
      title: 'Sharpe Ratio',
      value: stats.sharpeRatio.toString(),
      icon: ShieldAlert,
      color: stats.sharpeRatio >= 1.5 ? 'text-neon-cyan' : 'text-neon-yellow',
      tile: 'icon-tile-cyan',
      kpi: 'kpi-cyan',
      desc: 'Hiệu suất điều chỉnh rủi ro'
    }
  ];

  const periods = [
    { label: 'All Time', value: 'all' },
    { label: '1W (7d)', value: '1w' },
    { label: '1M (30d)', value: '1m' },
    { label: '1Q (90d)', value: '1q' },
    { label: '1Y (365d)', value: '1y' },
  ];

  // Geometry: score 0 = trái (an toàn), 100 = phải (rủi ro cao)
  const gaugeCx = 100;
  const gaugeCy = 100;
  const gaugeR = 78;
  const clampedScore = Math.max(0, Math.min(100, riskScore));
  // Góc CCW từ +X: 180° (trái) → 0° (phải)
  const gaugeAngle = Math.PI * (1 - clampedScore / 100);
  const needleLen = gaugeR - 18;
  const needleX = gaugeCx + needleLen * Math.cos(gaugeAngle);
  const needleY = gaugeCy - needleLen * Math.sin(gaugeAngle);

  /** Arc path từ fraction 0..1 dọc nửa trên (trái → phải) */
  const arcPoint = (t: number) => {
    const a = Math.PI * (1 - t);
    return {
      x: gaugeCx + gaugeR * Math.cos(a),
      y: gaugeCy - gaugeR * Math.sin(a),
    };
  };
  const zonePath = (t0: number, t1: number) => {
    const p0 = arcPoint(t0);
    const p1 = arcPoint(t1);
    const large = t1 - t0 > 0.5 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${gaugeR} ${gaugeR} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SegmentedControl
          leading="Period"
          size="md"
          value={period}
          onChange={setPeriod}
          options={periods.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI RISK — zone track + needle (không fill rỗng khi healthy) */}
        <div className="neon-card-premium neon-card-static p-6 flex flex-col justify-between relative overflow-hidden kpi-purple">
          <div className="flex items-center justify-between mb-2 relative z-10">
            <h4 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              AI Risk Assessment
              <span title="0–30 HEALTHY · 30–60 MODERATE · 60+ HIGH. Thấp = an toàn.">
                <HelpCircle className="w-3.5 h-3.5 text-dark-text-muted cursor-help" />
              </span>
            </h4>
            <span className="text-[9px] font-mono text-dark-text-muted">
              Health {healthScore}
            </span>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full bg-neon-purple/10 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col items-center z-10 my-1 w-full">
            <svg viewBox="0 0 200 130" className="w-full max-w-[260px] h-auto overflow-visible">
              {/* Base track */}
              <path
                d={zonePath(0, 1)}
                fill="none"
                stroke="#2a3350"
                strokeWidth="16"
                strokeLinecap="round"
              />
              {/* Zone luôn hiện — green / amber / rose (không rỗng khi healthy) */}
              <path
                d={zonePath(0, 0.3)}
                fill="none"
                stroke="#34d399"
                strokeWidth="12"
                strokeLinecap="butt"
              />
              <path
                d={zonePath(0.3, 0.6)}
                fill="none"
                stroke="#f5b61b"
                strokeWidth="12"
                strokeLinecap="butt"
              />
              <path
                d={zonePath(0.6, 1)}
                fill="none"
                stroke="#f472b6"
                strokeWidth="12"
                strokeLinecap="butt"
              />

              {/* Kim */}
              <line
                x1={gaugeCx}
                y1={gaugeCy}
                x2={needleX}
                y2={needleY}
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={gaugeCx} cy={gaugeCy} r="8" fill="#a78bfa" />
              <circle cx={gaugeCx} cy={gaugeCy} r="4" fill="#0b0f1a" />

              {/* Score */}
              <text
                x={gaugeCx}
                y={gaugeCy - 36}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#eef2ff"
                style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'Fira Code, monospace' }}
              >
                {riskScore}
              </text>
              <text
                x={gaugeCx}
                y={gaugeCy - 16}
                textAnchor="middle"
                fill="#8b95b0"
                style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'Fira Code, monospace' }}
              >
                /100 RISK
              </text>
            </svg>

            <span
              className="text-[9px] font-black tracking-widest uppercase -mt-0.5 px-3 py-1 rounded-full inline-block border"
              style={{
                backgroundColor: `${riskColor}18`,
                color: riskColor,
                borderColor: `${riskColor}35`,
              }}
            >
              {riskLabel}
            </span>
            <p className="text-[9px] text-dark-text-muted mt-1.5 text-center leading-snug px-2">
              Thấp = an toàn · Cao = rủi ro
              {riskHint ? ` · ${riskHint}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4 pt-4 border-t border-dark-border relative z-10">
            {([
              ['Profitability', subMetrics.profitability, 'text-neon-green'],
              ['Stability', subMetrics.stability, 'text-neon-cyan'],
              ['Risk Control', subMetrics.riskControl, 'text-neon-blue'],
              ['Capital Eff.', subMetrics.capitalEff, 'text-neon-yellow'],
              ['Consistency', subMetrics.consistency, 'text-neon-purple'],
              ['Recovery', subMetrics.recovery, 'text-neon-pink'],
            ] as const).map(([label, val, cls]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-dark-text-muted">{label}</span>
                <span className={`font-mono font-bold ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 8 KPI neon grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metricCards.map((card, idx) => (
            <div 
              key={idx} 
              className={`neon-card-premium gold-glow-hover p-5 flex flex-col justify-between ${card.kpi}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`icon-tile ${card.tile}`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <span className={`text-xl font-bold font-mono leading-none block ${card.color}`}>
                  {card.value}
                </span>
                <span className="text-[9px] text-dark-text-muted mt-1.5 block truncate leading-relaxed">
                  {card.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Equity curve full width */}
      <EquityCurveChart
        trades={filteredTrades}
        initialCapital={periodStartCapital}
        currencyMode={currencyMode}
        accountCurrency={account.currency}
        capitalMoves={periodMoves}
      />

      {/* CHARTS — multi-color neon bars (pink→cyan gradients) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="neon-card-premium p-5 kpi-pink">
          <div className="flex items-center gap-2 mb-4">
            <div className="icon-tile icon-tile-pink">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Trades & Profit by Session</h4>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sessionData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="tradesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.25}/>
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,51,80,0.8)" />
                <XAxis dataKey="name" stroke="#8b95b0" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#f472b6" fontSize={11} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#22d3ee" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #2a3350', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} 
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar yAxisId="left" dataKey="Trades" name="Trades" fill="url(#tradesGrad)" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="Profit" name={currencyMode === 'USD' ? 'Profit ($)' : 'Profit (USC)'} fill="url(#profitGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-dark-border text-center">
            {sessionData.map((d, i) => (
              <div key={i} className="bg-dark-card p-2.5 rounded-xl border border-dark-border">
                <span className="text-[10px] text-dark-text-muted block font-semibold">{d.name}</span>
                <span className="text-sm font-black text-white font-mono block mt-1">{d.Trades} trades</span>
                <span className={`text-xs font-mono font-bold block mt-0.5 ${d.Profit >= 0 ? 'text-neon-cyan' : 'text-rose-400'}`}>
                  {d.Profit >= 0 ? '+' : ''}
                  {currencyMode === 'USD' ? `$${d.Profit.toLocaleString()}` : `${d.Profit.toLocaleString()} USC`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="neon-card-premium p-5 kpi-cyan">
          <div className="flex items-center gap-2 mb-4">
            <div className="icon-tile icon-tile-cyan">
              <Activity className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Lot Volume by Session</h4>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sessionData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="volAsiaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="volEuropeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="volUSGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,51,80,0.8)" />
                <XAxis dataKey="name" stroke="#8b95b0" fontSize={11} tickLine={false} />
                <YAxis stroke="#8b95b0" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151b2d', border: '1px solid #2a3350', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="Volume" name="Lot Volume" radius={[6, 6, 0, 0]}>
                  {sessionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Asia' ? 'url(#volAsiaGrad)' : entry.name === 'Europe' ? 'url(#volEuropeGrad)' : 'url(#volUSGrad)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-dark-border text-center">
            {sessionData.map((d, i) => {
              const colors = ['text-neon-blue', 'text-neon-purple', 'text-neon-cyan'];
              return (
                <div key={i} className="bg-dark-card p-2.5 rounded-xl border border-dark-border">
                  <span className="text-[10px] text-dark-text-muted block font-semibold">{d.name}</span>
                  <span className={`text-sm font-black font-mono block mt-1 ${colors[i]}`}>{d.Volume} lots</span>
                  <span className="text-[9px] text-dark-text-muted block truncate mt-0.5">Volume</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
