'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '../../store/useTradingStore';
import { useToolsStore, PropChallenge } from '../../store/useToolsStore';
import { calculatePositionSize } from '../../utils/positionSize';
import { breachKey, evaluateRiskRules, RuleBreach } from '../../utils/riskRules';
import { toUsd } from '../../utils/currency';
import { sendTelegramAlert } from '../../utils/telegram';
import {
  Calculator,
  Target,
  ShieldAlert,
  Trash2,
  Plus,
  Save,
  Zap,
} from 'lucide-react';

type Tab = 'size' | 'prop' | 'rules';

export default function ToolsPage() {
  const { accounts } = useTradingStore();
  const {
    riskRules,
    setRiskRules,
    challenges,
    addChallenge,
    updateChallenge,
    deleteChallenge,
    hydrate,
    lastBreachKeys,
    setLastBreachKeys,
  } = useToolsStore();

  const [tab, setTab] = useState<Tab>('size');

  // Position size form
  const [psAccountId, setPsAccountId] = useState('');
  const [riskPct, setRiskPct] = useState(1);
  const [slPips, setSlPips] = useState(50);
  // XAUUSD: ~$1 / pip(0.01) / 0.01 lot → $100 per 1.0 lot per $1 move; pip 0.1 ≈ $10/lot
  const [pipValue, setPipValue] = useState(10);

  // Prop form
  const [propName, setPropName] = useState('FTMO Challenge');
  const [propAccountId, setPropAccountId] = useState('');
  const [startBal, setStartBal] = useState(10000);
  const [targetPct, setTargetPct] = useState(10);
  const [maxDd, setMaxDd] = useState(10);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Không setState trong effect — derive default id từ accounts
  const effectivePsId = psAccountId || accounts[0]?.id || '';
  const effectivePropId = propAccountId || accounts[0]?.id || '';

  const psAcc = accounts.find((a) => a.id === effectivePsId);
  const equityUsd = psAcc ? toUsd(psAcc.currentEquity, psAcc.currency) : 0;
  const hasPsEquity = equityUsd > 0;
  const sizeResult = calculatePositionSize({
    equity: hasPsEquity ? equityUsd : 0,
    riskPercent: riskPct,
    stopLossPips: slPips,
    pipValuePerLot: pipValue,
    isCentAccount: psAcc?.currency === 'USC',
  });

  const breaches: RuleBreach[] = useMemo(
    () => evaluateRiskRules(accounts, riskRules),
    [accounts, riskRules]
  );

  const runRuleCheck = async () => {
    const keys = breaches.map(breachKey);
    const newOnes = breaches.filter((b) => !lastBreachKeys.includes(breachKey(b)));
    if (riskRules.telegramOnBreach && newOnes.length > 0) {
      const { formatBreachesForTelegram } = await import('../../utils/riskRules');
      await sendTelegramAlert(formatBreachesForTelegram(newOnes));
    }
    setLastBreachKeys(keys);
    alert(
      breaches.length
        ? `Phát hiện ${breaches.length} breach (${newOnes.length} mới).${
            riskRules.telegramOnBreach ? ' Đã thử gửi Telegram.' : ''
          }`
        : 'Không có breach — portfolio trong ngưỡng rule.'
    );
  };

  const handleAddChallenge = () => {
    if (!effectivePropId) {
      alert('Chọn tài khoản');
      return;
    }
    addChallenge({
      name: propName,
      accountId: effectivePropId,
      phase: 'Phase 1',
      startBalance: startBal,
      profitTargetPct: targetPct,
      maxDrawdownPct: maxDd,
      dailyDrawdownPct: 5,
      minTradingDays: 4,
      tradingDaysDone: 0,
    });
  };

  const challengeProgress = (c: PropChallenge) => {
    const acc = accounts.find((a) => a.id === c.accountId);
    if (!acc) {
      return { profitPct: 0, ddPct: 0, roomToTarget: c.profitTargetPct, roomToDd: c.maxDrawdownPct, status: 'NO_ACC' as const };
    }
    const eq = toUsd(acc.currentEquity, acc.currency);
    // startBalance luôn hiểu là USD (form nhập $); fallback initial → USD
    const startRaw = c.startBalance || toUsd(acc.initialCapital, acc.currency) || 1;
    // Nếu user lỡ nhập startBalance theo USC (~100x) khi TK cent: heuristic
    let start = startRaw;
    if (
      acc.currency === 'USC' &&
      startRaw > eq * 5 &&
      toUsd(acc.initialCapital, acc.currency) > 0 &&
      Math.abs(startRaw - acc.initialCapital) < 1
    ) {
      start = toUsd(startRaw, 'USC');
    }
    const profitPct = ((eq - start) / Math.max(start, 1)) * 100;
    const ddPct = acc.stats.maxDrawdown;
    const roomToTarget = c.profitTargetPct - profitPct;
    const roomToDd = c.maxDrawdownPct - ddPct;
    let status: 'ON_TRACK' | 'AT_RISK' | 'TARGET' | 'BREACH' = 'ON_TRACK';
    if (ddPct >= c.maxDrawdownPct) status = 'BREACH';
    else if (profitPct >= c.profitTargetPct) status = 'TARGET';
    else if (roomToDd < 2 || profitPct < 0) status = 'AT_RISK';
    return { profitPct, ddPct, roomToTarget, roomToDd, status, acc };
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'size', label: 'Position Size', icon: Calculator },
    { id: 'prop', label: 'Prop Challenge', icon: Target },
    { id: 'rules', label: 'Risk Rules', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
          Trading <span className="neon-gradient-text">Tools</span>
        </h2>
        <p className="text-xs text-dark-text-muted mt-1 font-medium">
          Solo toolkit — position size, prop tracker, risk rules (không cần đăng nhập)
        </p>
      </div>

      <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 pressable ${
              tab === t.id
                ? 'bg-gradient-to-r from-neon-cyan/90 to-neon-purple/85 text-dark-bg shadow-[0_0_20px_rgba(76,201,255,0.2)]'
                : 'text-dark-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <t.icon className="w-3.5 h-3.5 stroke-[1.75]" />
            {t.label}
          </button>
        ))}
      </div>

      {/* POSITION SIZE */}
      {tab === 'size' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="neon-card-premium p-5 space-y-4 kpi-cyan">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-neon-cyan" /> Lot Calculator XAU
            </h3>

            <div>
              <label className="text-[10px] font-bold text-dark-text-muted uppercase">Tài khoản</label>
              <select
                value={effectivePsId}
                onChange={(e) => setPsAccountId(e.target.value)}
                className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName || a.id} · ${toUsd(a.currentEquity, a.currency).toFixed(0)}
                  </option>
                ))}
                {!accounts.length && <option value="">Chưa có TK</option>}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-dark-text-muted uppercase">Risk %</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={riskPct}
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                  className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-dark-text-muted uppercase">SL (pips)</label>
                <input
                  type="number"
                  min={1}
                  value={slPips}
                  onChange={(e) => setSlPips(Number(e.target.value))}
                  className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-dark-text-muted uppercase">
                $/pip / 1.0 lot
              </label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={pipValue}
                onChange={(e) => setPipValue(Number(e.target.value))}
                className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2.5 text-sm text-white font-mono"
              />
              <p className="text-[10px] text-dark-text-muted mt-1">
                XAU thường ~$1 / pip / lot (0.01$ move). Điều chỉnh theo broker.
              </p>
            </div>
          </div>

          <div className="neon-card-premium p-6 flex flex-col justify-center kpi-yellow">
            <span className="text-[10px] font-bold text-dark-text-muted uppercase">Gợi ý lot</span>
            <span className="text-5xl font-black neon-gradient-text font-mono mt-2">
              {hasPsEquity ? sizeResult.lotsRounded.toFixed(2) : '—'}
            </span>
            <span className="text-sm text-neon-cyan font-mono mt-2">
              {hasPsEquity
                ? `Risk ≈ $${sizeResult.riskAmount.toLocaleString()} (${riskPct}% of $${equityUsd.toFixed(0)})`
                : 'Chọn tài khoản có equity > 0'}
            </span>
            <p className="text-xs text-dark-text-muted mt-4 leading-relaxed">
              {hasPsEquity ? sizeResult.note : 'Không dùng equity ảo $1000 — tránh gợi ý lot sai.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-dark-card border border-dark-border rounded-xl p-3">
                <span className="text-dark-text-muted block text-[10px]">Raw lots</span>
                <span className="font-mono text-white font-bold">{sizeResult.lots}</span>
              </div>
              <div className="bg-dark-card border border-dark-border rounded-xl p-3">
                <span className="text-dark-text-muted block text-[10px]">Equity USD</span>
                <span className="font-mono text-neon-yellow font-bold">
                  ${equityUsd.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROP CHALLENGE */}
      {tab === 'prop' && (
        <div className="space-y-6">
          <div className="neon-card-premium p-5 kpi-pink grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={propName}
              onChange={(e) => setPropName(e.target.value)}
              placeholder="Tên challenge"
              className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white"
            />
            <select
              value={effectivePropId}
              onChange={(e) => setPropAccountId(e.target.value)}
              className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName || a.id}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={startBal}
              onChange={(e) => setStartBal(Number(e.target.value))}
              placeholder="Start balance $"
              className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white font-mono"
            />
            <input
              type="number"
              value={targetPct}
              onChange={(e) => setTargetPct(Number(e.target.value))}
              placeholder="Target %"
              className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white font-mono"
            />
            <input
              type="number"
              value={maxDd}
              onChange={(e) => setMaxDd(Number(e.target.value))}
              placeholder="Max DD %"
              className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white font-mono"
            />
            <button
              onClick={handleAddChallenge}
              className="btn-neon rounded-xl py-2 text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm challenge
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.length === 0 && (
              <p className="text-xs text-dark-text-muted col-span-2">
                Chưa có challenge. Thêm FTMO / FundedNext / tự đặt rule.
              </p>
            )}
            {challenges.map((c) => {
              const p = challengeProgress(c);
              const targetFill = Math.min(100, Math.max(0, (p.profitPct / c.profitTargetPct) * 100));
              const statusColor =
                p.status === 'BREACH'
                  ? 'badge-neon-red'
                  : p.status === 'TARGET'
                    ? 'badge-neon-green'
                    : p.status === 'AT_RISK'
                      ? 'badge-neon-amber'
                      : 'badge-neon-cyan';

              return (
                <div key={c.id} className="neon-card-premium p-5 kpi-purple space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-white">{c.name}</h4>
                      <p className="text-[10px] text-dark-text-muted font-mono">
                        {c.accountId} · {c.phase}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                        {p.status}
                      </span>
                      <button
                        onClick={() => deleteChallenge(c.id)}
                        className="text-dark-text-muted hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-dark-text-muted">Profit → target {c.profitTargetPct}%</span>
                      <span className="font-mono text-neon-cyan">{p.profitPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-dark-input overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
                        style={{ width: `${targetFill}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-dark-card rounded-lg p-2 border border-dark-border">
                      <span className="text-[9px] text-dark-text-muted block">Max DD</span>
                      <span className="font-mono text-neon-pink font-bold">
                        {p.ddPct}% / {c.maxDrawdownPct}%
                      </span>
                    </div>
                    <div className="bg-dark-card rounded-lg p-2 border border-dark-border">
                      <span className="text-[9px] text-dark-text-muted block">Room DD</span>
                      <span className="font-mono text-white font-bold">
                        {p.roomToDd.toFixed(1)}%
                      </span>
                    </div>
                    <div className="bg-dark-card rounded-lg p-2 border border-dark-border">
                      <span className="text-[9px] text-dark-text-muted block">Còn target</span>
                      <span className="font-mono text-neon-yellow font-bold">
                        {Math.max(0, p.roomToTarget).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(['Phase 1', 'Phase 2', 'Funded', 'Failed'] as const).map((ph) => (
                      <button
                        key={ph}
                        onClick={() => updateChallenge(c.id, { phase: ph })}
                        className={`text-[9px] px-2 py-1 rounded-md border font-bold ${
                          c.phase === ph
                            ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                            : 'border-dark-border text-dark-text-muted'
                        }`}
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RISK RULES */}
      {tab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="neon-card-premium p-5 space-y-4 kpi-orange">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-neon-orange" /> Cấu hình rule
            </h3>

            <label className="flex items-center gap-2 text-xs text-white">
              <input
                type="checkbox"
                checked={riskRules.enabled}
                onChange={(e) => setRiskRules({ enabled: e.target.checked })}
                className="accent-cyan-400"
              />
              Bật Risk Rules Engine
            </label>

            <label className="flex items-center gap-2 text-xs text-white">
              <input
                type="checkbox"
                checked={riskRules.telegramOnBreach}
                onChange={(e) => setRiskRules({ telegramOnBreach: e.target.checked })}
                className="accent-cyan-400"
              />
              Gửi Telegram khi breach mới
            </label>

            {(
              [
                ['maxDrawdownPct', 'Max Drawdown %', riskRules.maxDrawdownPct],
                ['maxRiskScore', 'Max Risk Score', riskRules.maxRiskScore],
                ['minProfitFactor', 'Min Profit Factor', riskRules.minProfitFactor],
                ['maxDailyLossPct', 'Max Daily Loss %', riskRules.maxDailyLossPct],
              ] as const
            ).map(([key, label, val]) => (
              <div key={key}>
                <label className="text-[10px] font-bold text-dark-text-muted uppercase">
                  {label}
                </label>
                <input
                  type="number"
                  step={key === 'minProfitFactor' ? 0.1 : 1}
                  value={val}
                  onChange={(e) =>
                    setRiskRules({ [key]: Number(e.target.value) } as Partial<typeof riskRules>)
                  }
                  className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            ))}

            <button
              onClick={runRuleCheck}
              className="w-full btn-neon rounded-xl py-2.5 text-xs flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Chạy kiểm tra ngay
            </button>
            <p className="text-[10px] text-dark-text-muted flex items-center gap-1">
              <Save className="w-3 h-3" /> Lưu localStorage (máy bạn) — solo mode
            </p>
          </div>

          <div className="neon-card-premium p-5 kpi-pink space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Breaches hiện tại ({breaches.length})
            </h3>
            {breaches.length === 0 ? (
              <p className="text-xs text-neon-green">✓ Không có breach — an toàn trong rule.</p>
            ) : (
              breaches.map((b, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs ${
                    b.severity === 'critical'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                  }`}
                >
                  <span className="font-bold block">{b.accountName}</span>
                  <span className="opacity-90">{b.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
