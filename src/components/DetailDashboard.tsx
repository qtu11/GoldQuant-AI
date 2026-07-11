'use client';

import React from 'react';
import { TradingAccount } from '../store/useTradingStore';
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
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface DetailDashboardProps {
  account: TradingAccount;
  period: string;
  setPeriod: (p: string) => void;
  currencyMode: 'USD' | 'USC';
}

export default function DetailDashboard({ account, period, setPeriod, currencyMode }: DetailDashboardProps) {
  const { stats, riskScore, riskLabel, riskColor, subMetrics } = account;

  const isUscAccount = account.currency === 'USC';
  const shouldDivide100 = isUscAccount && currencyMode === 'USD';

  // Quy đổi Net Profit hiển thị
  const displayNetProfit = shouldDivide100 ? stats.netProfit / 100 : stats.netProfit;
  const displayProfitFormatted = currencyMode === 'USD'
    ? `$${displayNetProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : `${displayNetProfit.toLocaleString()} USC`;

  // Chuẩn bị dữ liệu cho biểu đồ Recharts
  const sessionData = [
    {
      name: 'Asia',
      Trades: stats.sessionStats.Asia.trades,
      Profit: shouldDivide100 ? Math.round((stats.sessionStats.Asia.profit / 100) * 100) / 100 : stats.sessionStats.Asia.profit,
      Volume: stats.sessionStats.Asia.volume,
      fillTrades: '#3b82f6',
      fillProfit: '#f5b61b'
    },
    {
      name: 'Europe',
      Trades: stats.sessionStats.Europe.trades,
      Profit: shouldDivide100 ? Math.round((stats.sessionStats.Europe.profit / 100) * 100) / 100 : stats.sessionStats.Europe.profit,
      Volume: stats.sessionStats.Europe.volume,
      fillTrades: '#8b5cf6',
      fillProfit: '#a855f7'
    },
    {
      name: 'US',
      Trades: stats.sessionStats.US.trades,
      Profit: shouldDivide100 ? Math.round((stats.sessionStats.US.profit / 100) * 100) / 100 : stats.sessionStats.US.profit,
      Volume: stats.sessionStats.US.volume,
      fillTrades: '#10b981',
      fillProfit: '#14b8a6'
    }
  ];

  // Grid 8 thẻ thông số
  const metricCards = [
    {
      title: 'Net Profit',
      value: displayProfitFormatted,
      icon: DollarSign,
      color: stats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: 'bg-emerald-500/10',
      desc: shouldDivide100 ? 'Lợi nhuận ròng quy đổi USD' : 'Lợi nhuận ròng sau phí & swap'
    },
    {
      title: 'ROI',
      value: `${stats.roi}%`,
      icon: Percent,
      color: stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: 'bg-emerald-500/10',
      desc: 'Tỷ suất lợi nhuận trên vốn'
    },
    {
      title: 'Monthly ROI',
      value: `${stats.monthlyRoi}%`,
      icon: TrendingUp,
      color: stats.monthlyRoi >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: 'bg-emerald-500/10',
      desc: 'ROI trung bình theo tháng'
    },
    {
      title: 'Win Rate',
      value: `${stats.winRate}%`,
      icon: Target,
      color: 'text-gold',
      bgColor: 'bg-gold/10',
      desc: 'Tỷ lệ lệnh thắng / tổng lệnh'
    },
    {
      title: 'Profit Factor',
      value: stats.profitFactor.toString(),
      icon: BarChart3,
      color: stats.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400',
      bgColor: stats.profitFactor >= 1.5 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      desc: 'Tổng lợi nhuận / tổng lỗ'
    },
    {
      title: 'Recovery Factor',
      value: stats.recoveryFactor.toString(),
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      desc: 'Khả năng phục hồi tài khoản'
    },
    {
      title: 'Max Drawdown',
      value: `${stats.maxDrawdown}%`,
      icon: ArrowDownRight,
      color: stats.maxDrawdown <= 5 ? 'text-emerald-400' : 'text-red-400',
      bgColor: stats.maxDrawdown <= 5 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      desc: 'Sụt giảm vốn lớn nhất từ đỉnh'
    },
    {
      title: 'Sharpe Ratio',
      value: stats.sharpeRatio.toString(),
      icon: ShieldAlert,
      color: stats.sharpeRatio >= 1.5 ? 'text-emerald-400' : 'text-amber-400',
      bgColor: stats.sharpeRatio >= 1.5 ? 'bg-purple-500/10' : 'bg-amber-500/10',
      desc: 'Hiệu suất điều chỉnh rủi ro'
    }
  ];

  // Tính góc xoay cho kim chỉ của gauge (0 - 100 điểm rủi ro tương ứng 0 - 180 độ)
  const gaugeRotation = (riskScore / 100) * 180 - 90;

  const periods = [
    { label: 'All Time', value: 'all' },
    { label: '1W (5 days)', value: '1w' },
    { label: '1M (22 days)', value: '1m' },
    { label: '1Q (66 days)', value: '1q' },
    { label: '1Y (260 days)', value: '1y' }
  ];

  return (
    <div className="space-y-6">
      {/* Period Filter Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-white/3 border border-white/5 p-1 rounded-lg">
          <span className="text-[10px] font-bold text-dark-text-muted uppercase px-2">Period</span>
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded-md font-bold transition-all cursor-pointer ${
                period === p.value 
                  ? 'bg-gold text-dark-bg' 
                  : 'text-dark-text-muted hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI RISK SCORE GAUGE */}
        <div className="glass-effect-premium rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h4 className="text-xs font-bold text-dark-text-light tracking-wider uppercase flex items-center gap-1.5">
              AI Risk Assessment
              <span title="Điểm số đánh giá rủi ro dựa trên AI">
                <HelpCircle className="w-3.5 h-3.5 text-dark-text-muted cursor-help" />
              </span>
            </h4>
          </div>

          {/* Decorative light blob inside gauge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-gold/5 blur-[24px] pointer-events-none" />

          {/* Gauge Visualization */}
          <div className="relative flex flex-col items-center justify-center my-4 relative z-10">
            <svg className="w-48 h-26 overflow-visible" viewBox="0 0 100 50">
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="rgba(255,255,255,0.04)" 
                strokeWidth="7" 
                strokeLinecap="round" 
              />
              <path 
                d="M 10 50 A 40 40 0 0 1 90 50" 
                fill="none" 
                stroke="url(#gauge-gradient)" 
                strokeWidth="7.5" 
                strokeLinecap="round" 
                strokeDasharray={`${(riskScore / 100) * 125.6} 125.6`} 
              />
              {/* Needle */}
              <g transform={`rotate(${gaugeRotation}, 50, 50)`} className="transition-transform duration-1000 ease-out origin-[50px_50px]">
                <line x1="50" y1="50" x2="50" y2="16" stroke="#f5b61b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4.5" fill="#f5b61b" className="pulse-glow-gold" />
                <circle cx="50" cy="50" r="2" fill="#030306" />
              </g>
              <defs>
                <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f5b61b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Value Center */}
            <div className="absolute bottom-[-10px] text-center">
              <span className="text-4xl font-black text-white leading-none font-mono block">
                {riskScore}
              </span>
              <span 
                className="text-[9px] font-black tracking-widest uppercase mt-2 px-3 py-0.5 rounded-full inline-block border"
                style={{ backgroundColor: `${riskColor}15`, color: riskColor, borderColor: `${riskColor}25` }}
              >
                {riskLabel}
              </span>
            </div>
          </div>

          {/* Sub metrics list */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-6 pt-4 border-t border-white/5 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Profitability</span>
              <span className="font-mono text-white font-bold">{subMetrics.profitability}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Stability</span>
              <span className="font-mono text-white font-bold">{subMetrics.stability}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Risk Control</span>
              <span className="font-mono text-white font-bold">{subMetrics.riskControl}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Capital Eff.</span>
              <span className="font-mono text-white font-bold">{subMetrics.capitalEff}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Consistency</span>
              <span className="font-mono text-white font-bold">{subMetrics.consistency}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-text-muted">Recovery</span>
              <span className="font-mono text-white font-bold">{subMetrics.recovery}</span>
            </div>
          </div>
        </div>

        {/* 8 INDICATORS GRID */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metricCards.map((card, idx) => (
            <div 
              key={idx} 
              className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg ${card.bgColor} border border-white/5`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xl font-bold text-white font-mono leading-none block">
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

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trades & Profit by Session */}
        <div className="glass-effect-premium rounded-xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4.5 h-4.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f5b61b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f5b61b" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="#848da0" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" fontSize={11} tickLine={false} label={{ value: 'Trades', angle: -90, position: 'insideLeft', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#f5b61b" fontSize={11} tickLine={false} label={{ value: currencyMode === 'USD' ? 'Profit ($)' : 'Profit (USC)', angle: 90, position: 'insideRight', fill: '#f5b61b', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 11, 16, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }} 
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar yAxisId="left" dataKey="Trades" name="Trades" fill="url(#tradesGrad)" radius={[5, 5, 0, 0]} />
                <Bar yAxisId="right" dataKey="Profit" name={currencyMode === 'USD' ? 'Profit ($)' : 'Profit (USC)'} fill="url(#profitGrad)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5 text-center">
            {sessionData.map((d, i) => (
              <div key={i} className="bg-white/2 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-dark-text-muted block font-semibold">{d.name} Session</span>
                <span className="text-sm font-black text-white font-mono block mt-1">{d.Trades} trades</span>
                <span className={`text-xs font-mono font-bold block mt-0.5 ${d.Profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.Profit >= 0 ? '+' : ''}
                  {currencyMode === 'USD' ? `$${d.Profit.toLocaleString()}` : `${d.Profit.toLocaleString()} USC`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lot Volume by Session */}
        <div className="glass-effect-premium rounded-xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4.5 h-4.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="volEuropeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                  </linearGradient>
                  <linearGradient id="volUSGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.15}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="#848da0" fontSize={11} tickLine={false} />
                <YAxis stroke="#848da0" fontSize={11} tickLine={false} label={{ value: 'Lots', angle: -90, position: 'insideLeft', fill: '#848da0', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 11, 16, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="Volume" name="Lot Volume" radius={[5, 5, 0, 0]}>
                  {sessionData.map((entry, index) => (
                    <Bar 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Asia' ? 'url(#volAsiaGrad)' : entry.name === 'Europe' ? 'url(#volEuropeGrad)' : 'url(#volUSGrad)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5 text-center">
            {sessionData.map((d, i) => (
              <div key={i} className="bg-white/2 p-2.5 rounded-lg border border-white/5">
                <span className="text-[10px] text-dark-text-muted block font-semibold">{d.name} Session</span>
                <span className="text-sm font-black text-white font-mono block mt-1">{d.Volume} lots</span>
                <span className="text-[9px] text-dark-text-muted block truncate mt-0.5">Khối lượng lot tích lũy</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
