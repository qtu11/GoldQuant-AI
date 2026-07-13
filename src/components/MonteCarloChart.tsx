'use client';

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Sparkles } from 'lucide-react';

interface McMeta {
  mode: 'empirical' | 'bootstrap' | 'default';
  sampleSize: number;
  sampleDays: number;
  sampleTrades: number;
  driftDaily: number;
  volDaily: number;
  startEquity: number;
}

interface Props {
  /** monteCarloPaths: [day][path] */
  paths: number[][];
  startEquity?: number;
  meta?: McMeta;
}

const PATH_COLORS = [
  '#4CC9FF', '#8A7DFF', '#2DFFB4', '#FFD54F', '#FF7B92',
  '#6DD5FF', '#A89BFF', '#5CFFC8', '#FFE082', '#FF9AAB',
  '#3BB8EE', '#7A6DF0',
];

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10000) return `$${(n / 1000).toFixed(1)}k`;
  if (Math.abs(n) >= 1000) return `$${n.toFixed(0)}`;
  if (Math.abs(n) >= 100) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function modeLabel(mode?: string) {
  if (mode === 'empirical') return 'Từ daily returns thật';
  if (mode === 'bootstrap') return 'Bootstrap từ lệnh thật';
  if (mode === 'default') return 'Chưa đủ data — mô phỏng mặc định';
  return '—';
}

export default function MonteCarloChart({ paths, startEquity, meta }: Props) {
  const { chartData, pathCount, yDomain, start, endMedian } = useMemo(() => {
    if (!paths?.length || !paths[0]?.length) {
      return {
        chartData: [] as Record<string, number>[],
        pathCount: 0,
        yDomain: [0, 100] as [number, number],
        start: startEquity || 0,
        endMedian: 0,
      };
    }

    const nPaths = paths[0].length;
    let minV = Infinity;
    let maxV = -Infinity;

    const data = paths.map((dayPaths, dayIdx) => {
      const row: Record<string, number> = { day: dayIdx };
      const vals: number[] = [];
      dayPaths.forEach((v, p) => {
        const num = Number(v);
        row[`p${p}`] = num;
        vals.push(num);
        if (num < minV) minV = num;
        if (num > maxV) maxV = num;
      });
      const sorted = [...vals].sort((a, b) => a - b);
      const p5 = percentile(sorted, 0.05);
      const p50 = percentile(sorted, 0.5);
      const p95 = percentile(sorted, 0.95);
      row.p5 = p5;
      row.p50 = p50;
      row.p95 = p95;
      row.band = p95 - p5;
      return row;
    });

    const range = Math.max(maxV - minV, 1);
    const pad = Math.max(range * 0.06, 1);
    const domain: [number, number] = [Math.max(0, minV - pad), maxV + pad];

    const s = paths[0][0] ?? startEquity ?? meta?.startEquity ?? 0;
    const last = data[data.length - 1];
    return {
      chartData: data,
      pathCount: nPaths,
      yDomain: domain,
      start: s,
      endMedian: last?.p50 ?? s,
    };
  }, [paths, startEquity, meta?.startEquity]);

  const deltaPct = start > 0 ? ((endMedian - start) / start) * 100 : 0;
  const hasReal =
    meta && (meta.mode === 'empirical' || meta.mode === 'bootstrap') && meta.sampleSize > 0;

  return (
    <div className="neon-card-premium kpi-pink h-full min-h-[360px] flex flex-col p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="icon-tile icon-tile-pink !w-8 !h-8">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[11px] font-semibold text-white uppercase tracking-wider leading-none">
              Monte Carlo Paths (30d)
            </h4>
            <p className="text-[9px] text-dark-text-muted truncate mt-0.5">
              {pathCount} paths · P5–P95 · median
              {meta
                ? ` · ${meta.sampleDays}d / ${meta.sampleTrades} lệnh`
                : ''}
            </p>
          </div>
        </div>
        {start > 0 && (
          <div className="text-right flex-shrink-0 leading-tight">
            <span className="text-[9px] text-dark-text-muted block">Start → Med</span>
            <span className="text-[11px] font-mono font-bold text-white">
              {fmtUsd(start)}
              <span className="text-dark-text-muted mx-0.5">→</span>
              {fmtUsd(endMedian)}
            </span>
            <span
              className={`text-[9px] font-mono font-bold block ${
                deltaPct >= 0 ? 'text-neon-green' : 'text-neon-pink'
              }`}
            >
              {deltaPct >= 0 ? '+' : ''}
              {deltaPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Badge nguồn dữ liệu thật */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 flex-shrink-0">
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            hasReal
              ? 'border-neon-green/40 text-neon-green bg-neon-green/10'
              : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
          }`}
        >
          {hasReal ? '● Data thật' : '○ Default'}
        </span>
        <span className="text-[9px] text-dark-text-muted truncate">
          {modeLabel(meta?.mode)}
          {meta
            ? ` · μ ${(meta.driftDaily * 100).toFixed(2)}%/d · σ ${(meta.volDaily * 100).toFixed(2)}%`
            : ''}
        </span>
      </div>

      <div className="flex-1 min-h-[240px] w-full relative">
        {chartData.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-dark-text-muted text-center px-4">
            Chưa có path — Upload History (dù chỉ 1 ngày) để chạy MC từ PnL thật.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 4, right: 6, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id="mcBandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(42,51,80,0.65)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#8b95b0"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#8b95b0"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={yDomain}
                tickFormatter={(v) => fmtUsd(Number(v))}
                allowDataOverflow
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#12121a',
                  border: '1px solid #2a2a3a',
                  borderRadius: 10,
                  fontSize: 11,
                }}
                labelFormatter={(d) => `Day ${d}`}
                formatter={(value, name) => {
                  const n = typeof value === 'number' ? value : Number(value);
                  const label =
                    name === 'p50'
                      ? 'Median'
                      : name === 'p5'
                        ? 'P5'
                        : name === 'p95'
                          ? 'P95'
                          : name === 'band'
                            ? 'P5–P95 width'
                            : String(name);
                  return [fmtUsd(n), label];
                }}
              />
              <ReferenceLine
                y={start}
                stroke="#f472b6"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />

              <Area
                type="monotone"
                dataKey="p5"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              />
              <Area
                type="monotone"
                dataKey="band"
                stackId="band"
                stroke="none"
                fill="url(#mcBandFill)"
                isAnimationActive={false}
                name="band"
              />

              {Array.from({ length: pathCount }).map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`p${i}`}
                  stroke={PATH_COLORS[i % PATH_COLORS.length]}
                  strokeWidth={1}
                  strokeOpacity={0.22}
                  dot={false}
                  isAnimationActive={false}
                  legendType="none"
                  tooltipType="none"
                />
              ))}

              <Line
                type="monotone"
                dataKey="p50"
                stroke="#00d4ff"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
                name="p50"
              />
              <Line
                type="monotone"
                dataKey="p5"
                stroke="#ff00aa"
                strokeWidth={1.4}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                name="p5"
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke="#a78bfa"
                strokeWidth={1.4}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                name="p95"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-dark-border/60 text-[9px] text-dark-text-muted flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-neon-cyan inline-block rounded" /> Median
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-neon-pink inline-block rounded opacity-80" /> P5
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-neon-purple inline-block rounded opacity-80" /> P95
        </span>
        <span className="text-[8px] opacity-80">
          Start = equity thật (USD) · path = mô phỏng 30d từ phân phối PnL của bạn
        </span>
      </div>
    </div>
  );
}
