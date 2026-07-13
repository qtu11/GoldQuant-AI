'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Trade } from '../utils/fileParser';
import type { CapitalMove } from '../utils/capitalEquity';
import { buildEquityCurve, aggregateEquityByDay } from '../utils/equityCurve';
import { TrendingUp } from 'lucide-react';

interface Props {
  trades: Trade[];
  initialCapital: number;
  currencyMode: 'USD' | 'USC';
  accountCurrency: 'USD' | 'USC';
  capitalMoves?: CapitalMove[];
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(20, 20, 28, 0.88)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
};

export default function EquityCurveChart({
  trades,
  initialCapital,
  currencyMode,
  accountCurrency,
  capitalMoves = [],
}: Props) {
  const data = useMemo(() => {
    const convert = (v: number) => {
      if (accountCurrency === 'USC' && currencyMode === 'USD') return v / 100;
      if (accountCurrency === 'USD' && currencyMode === 'USC') return v * 100;
      return v;
    };
    const raw = buildEquityCurve(trades, initialCapital, capitalMoves);
    const daily = aggregateEquityByDay(raw);
    return daily.map((p) => ({
      ...p,
      equity: Math.round(convert(p.equity) * 100) / 100,
    }));
  }, [trades, initialCapital, capitalMoves, currencyMode, accountCurrency]);

  const startEq = data[0]?.equity ?? 0;
  const endEq = data[data.length - 1]?.equity ?? 0;
  const delta = endEq - startEq;

  return (
    <div className="neon-card-premium p-5 kpi-cyan">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="icon-tile icon-tile-cyan">
            <TrendingUp className="w-4 h-4 stroke-[1.75]" />
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-white uppercase tracking-wider">
              Equity Curve
            </h4>
            <p className="text-[10px] text-dark-text-muted">
              {trades.length} lệnh · soft liquid gradient
            </p>
          </div>
        </div>
        <span
          className={`text-sm font-semibold font-mono ${
            delta >= 0 ? 'text-neon-green' : 'text-neon-pink'
          }`}
        >
          {delta >= 0 ? '+' : ''}
          {currencyMode === 'USD' ? '$' : ''}
          {delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          {currencyMode === 'USC' ? ' USC' : ''}
        </span>
      </div>

      <div className="h-56 w-full">
        {data.length < 2 ? (
          <div className="h-full flex items-center justify-center text-xs text-dark-text-muted">
            Chưa đủ lệnh để vẽ equity curve — Upload History.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8A7DFF" />
                  <stop offset="55%" stopColor="#4CC9FF" />
                  <stop offset="100%" stopColor="#2DFFB4" />
                </linearGradient>
                <linearGradient id="equityFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4CC9FF" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#8A7DFF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" stroke="#8E8E93" fontSize={10} tickLine={false} />
              <YAxis
                stroke="#8E8E93"
                fontSize={10}
                tickLine={false}
                domain={['auto', 'auto']}
                width={56}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#F5F5F7', fontWeight: 600 }}
                formatter={(value) => {
                  const n = typeof value === 'number' ? value : Number(value);
                  const text = Number.isFinite(n)
                    ? `${currencyMode === 'USD' ? '$' : ''}${n.toLocaleString()}${
                        currencyMode === 'USC' ? ' USC' : ''
                      }`
                    : String(value ?? '');
                  return [text, 'Equity'];
                }}
              />
              <ReferenceLine
                y={startEq}
                stroke="#8A7DFF"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="url(#equityLineGrad)"
                strokeWidth={2.25}
                fill="url(#equityFillGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#4CC9FF', stroke: 'rgba(255,255,255,0.4)', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
