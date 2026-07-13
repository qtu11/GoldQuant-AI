'use client';

import React from 'react';

interface RiskGaugeProps {
  /** 0–100 (cao = rủi ro cao). null = chưa có dữ liệu */
  score: number | null;
}

export default function RiskGauge({ score }: RiskGaugeProps) {
  const empty = score === null || score === undefined || !Number.isFinite(score);
  const safeScore = empty ? 0 : Math.max(0, Math.min(100, Math.round(score)));

  const getRiskLevel = (val: number) => {
    if (val < 30) {
      return {
        label: 'LOW RISK',
        color: 'text-neon-green',
        border: 'border-neon-green/25',
        bg: 'bg-neon-green/10',
      };
    }
    if (val < 60) {
      return {
        label: 'MODERATE',
        color: 'text-neon-yellow',
        border: 'border-neon-yellow/25',
        bg: 'bg-neon-yellow/10',
      };
    }
    if (val < 85) {
      return {
        label: 'ELEVATED',
        color: 'text-neon-orange',
        border: 'border-neon-orange/25',
        bg: 'bg-neon-orange/10',
      };
    }
    return {
      label: 'CRITICAL',
      color: 'text-neon-pink',
      border: 'border-neon-pink/25',
      bg: 'bg-neon-pink/10',
    };
  };

  const risk = getRiskLevel(safeScore);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = empty
    ? circumference
    : circumference - (safeScore / 100) * circumference;

  return (
    <div className="neon-card-premium p-6 flex flex-col items-center justify-center text-center kpi-purple">
      <h3 className="text-[11px] font-semibold text-dark-text-muted tracking-wider uppercase mb-4">
        Portfolio Risk Score
      </h3>

      <div className="relative w-40 h-40 flex items-center justify-center">
        <div className="absolute inset-4 rounded-full bg-neon-purple/10 blur-2xl pointer-events-none" />
        <svg className="w-full h-full transform -rotate-90 relative z-[1]" viewBox="0 0 144 144">
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
            fill="transparent"
          />
          {!empty && (
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="url(#liquidRiskGradient)"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(.22,.61,.36,1)]"
            />
          )}
          <defs>
            <linearGradient id="liquidRiskGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2DFFB4" />
              <stop offset="40%" stopColor="#4CC9FF" />
              <stop offset="75%" stopColor="#8A7DFF" />
              <stop offset="100%" stopColor="#FF7B92" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute flex flex-col items-center justify-center z-[2]">
          {empty ? (
            <>
              <span className="text-3xl font-mono font-semibold text-dark-text-muted tracking-tight">
                —
              </span>
              <span className="text-[10px] text-dark-text-muted font-medium tracking-wide mt-0.5">
                no data
              </span>
            </>
          ) : (
            <>
              <span className="text-4xl font-mono font-semibold text-white tracking-tight">
                {safeScore}
              </span>
              <span className="text-[10px] text-dark-text-muted font-medium tracking-wide">
                /100
              </span>
            </>
          )}
        </div>
      </div>

      {empty ? (
        <div className="mt-4 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-dark-text-muted text-[11px] font-semibold tracking-wide">
          CHƯA CÓ TK
        </div>
      ) : (
        <div
          className={`mt-4 px-4 py-1.5 rounded-full border ${risk.border} ${risk.bg} ${risk.color} text-[11px] font-semibold tracking-widest`}
        >
          {risk.label}
        </div>
      )}

      <p className="mt-3 text-[11px] text-dark-text-muted max-w-[220px] leading-relaxed">
        {empty
          ? 'Tạo tài khoản và upload history để tính risk score.'
          : 'Drawdown · Margin · Concentration · Portfolio health'}
      </p>
    </div>
  );
}
