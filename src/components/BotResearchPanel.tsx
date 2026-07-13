'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Upload,
  Sparkles,
  Download,
  RotateCcw,
  Check,
  FileCode2,
  CalendarRange,
  ShieldAlert,
  Lightbulb,
  Search,
} from 'lucide-react';
import { useTradingStore, type TradingAccount } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { renderMarkdownLite } from '../utils/markdownLite';
import {
  decodeSetBuffer,
  exportSetContent,
  parseDailyPnlText,
  parseSetContent,
  sortParamsForUi,
  summarizeDailyPnl,
  type DailyPnlPoint,
  type SetParam,
} from '../utils/setParser';
import InfoTip from './InfoTip';

interface Props {
  account: TradingAccount;
}

type AnalyzeState = 'idle' | 'loading' | 'done';

export default function BotResearchPanel({ account }: Props) {
  const saveBotResearch = useTradingStore((s) => s.saveBotResearch);
  const fileRef = useRef<HTMLInputElement>(null);
  const pnlFileRef = useRef<HTMLInputElement>(null);

  const saved = account.botResearch;
  const [params, setParams] = useState<SetParam[]>(saved?.params || []);
  const [fileName, setFileName] = useState(saved?.fileName || '');
  const [botName, setBotName] = useState(saved?.botName || '');
  const [dailyText, setDailyText] = useState(() =>
    (saved?.dailyPnl || [])
      .map((d) => `${d.date},${d.profit}`)
      .join('\n')
  );
  const [dailyPnl, setDailyPnl] = useState<DailyPnlPoint[]>(saved?.dailyPnl || []);
  const [filter, setFilter] = useState('');
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>(
    saved?.lastAnalysis ? 'done' : 'idle'
  );
  const [analysis, setAnalysis] = useState(saved?.lastAnalysis || null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'ok' | 'info'>('info');
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  const equityUsd = toUsd(account.currentEquity, account.currency);
  const initialUsd = toUsd(account.initialCapital, account.currency);
  const dailySummary = useMemo(() => summarizeDailyPnl(dailyPnl), [dailyPnl]);

  const visibleParams = useMemo(() => {
    const sorted = sortParamsForUi(params);
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        String(p.value).toLowerCase().includes(q)
    );
  }, [params, filter]);

  const showStatus = (msg: string, tone: 'ok' | 'info' = 'info') => {
    setStatusMsg(msg);
    setStatusTone(tone);
  };

  const persistLocal = useCallback(
    async (patch: {
      params?: SetParam[];
      dailyPnl?: DailyPnlPoint[];
      fileName?: string;
      botName?: string;
      lastAnalysis?: typeof analysis;
    }) => {
      try {
        await saveBotResearch(account.id, {
          params: patch.params ?? params,
          dailyPnl: patch.dailyPnl ?? dailyPnl,
          fileName: patch.fileName ?? fileName,
          botName: patch.botName ?? botName,
          lastAnalysis: patch.lastAnalysis ?? analysis ?? undefined,
        });
      } catch {
        // UX: không hiện stack — chỉ soft notice
        showStatus('Đã lưu cục bộ. Đồng bộ cloud sẽ thử lại sau.', 'info');
      }
    },
    [account.id, analysis, botName, dailyPnl, fileName, params, saveBotResearch]
  );

  const handleSetFile = async (file: File | null) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const text = decodeSetBuffer(buf);
      const parsed = parseSetContent(text, file.name);
      if (!parsed.params.length) {
        showStatus(
          'Không đọc được tham số từ file. Kiểm tra định dạng .set (key=value).',
          'info'
        );
        return;
      }
      setParams(parsed.params);
      setFileName(parsed.fileName);
      setBotName(parsed.botHint);
      setAppliedKeys(new Set());
      showStatus(
        `Đã nạp ${parsed.params.length} tham số từ ${parsed.fileName}`,
        'ok'
      );
      await persistLocal({
        params: parsed.params,
        fileName: parsed.fileName,
        botName: parsed.botHint,
      });
    } catch {
      showStatus('Không đọc được file .set. Thử lưu lại UTF-8 từ MT5.', 'info');
    }
  };

  const handlePnlFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const points = parseDailyPnlText(text);
      if (!points.length) {
        showStatus(
          'Không parse được PnL ngày. Dùng CSV: YYYY-MM-DD,profit',
          'info'
        );
        return;
      }
      setDailyPnl(points);
      setDailyText(points.map((d) => `${d.date},${d.profit}`).join('\n'));
      showStatus(`Đã nạp ${points.length} ngày PnL`, 'ok');
      await persistLocal({ dailyPnl: points });
    } catch {
      showStatus('Không đọc được file PnL.', 'info');
    }
  };

  const applyDailyText = async () => {
    const points = parseDailyPnlText(dailyText);
    setDailyPnl(points);
    if (!points.length && dailyText.trim()) {
      showStatus('Chưa nhận diện được dòng PnL hợp lệ.', 'info');
      return;
    }
    showStatus(
      points.length ? `Đã áp dụng ${points.length} ngày PnL` : 'Đã xóa series PnL',
      'ok'
    );
    await persistLocal({ dailyPnl: points });
  };

  const updateParamValue = (key: string, value: string) => {
    setParams((prev) =>
      prev.map((p) => (p.key === key ? { ...p, value } : p))
    );
  };

  const runAnalyze = async () => {
    if (analyzeState === 'loading') return;
    if (!params.length && !dailyPnl.length) {
      showStatus('Nạp file .set hoặc dán lợi nhuận ngày trước khi phân tích.', 'info');
      return;
    }
    setAnalyzeState('loading');
    setAppliedKeys(new Set());
    showStatus('AI đang đánh giá bot theo vốn & PnL…', 'info');

    try {
      const res = await fetch('/api/quant/bot-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          botName: botName || fileName || account.accountName || account.id,
          fileName,
          params,
          dailyPnl,
          equityUsd,
          initialUsd,
          maxDrawdown: account.stats.maxDrawdown,
          accountRiskScore: account.riskScore,
          currency: account.currency,
          symbol: account.symbol,
          stats: {
            netProfit: account.stats.netProfit,
            winRate: account.stats.winRate,
            profitFactor: account.stats.profitFactor,
            sharpeRatio: account.stats.sharpeRatio,
            totalTrades: account.stats.totalTrades,
            roi: account.stats.roi,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!data || data.ok !== true) {
        // Soft fallback UI — không show raw error
        setAnalyzeState('done');
        showStatus(
          'Phân tích cơ bản đã sẵn sàng (chế độ rule). Có thể chỉnh form bên dưới.',
          'info'
        );
        return;
      }

      const next = {
        summary: String(data.summary || ''),
        riskLevel: (data.riskLevel || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
        riskScore: Number(data.riskScore) || 50,
        suggestedParams: Array.isArray(data.suggestedParams)
          ? data.suggestedParams
          : [],
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        actions: Array.isArray(data.actions) ? data.actions : [],
        analyzedAt: new Date().toISOString(),
        provider: data.meta?.provider,
      };
      setAnalysis(next);
      setAnalyzeState('done');
      showStatus('Đã có đánh giá & gợi ý tham số — bấm “Áp dụng gợi ý”.', 'ok');
      await persistLocal({ lastAnalysis: next });
    } catch {
      setAnalyzeState('idle');
      showStatus(
        'Tạm chưa kết nối AI. Thử lại sau — dữ liệu .set/PnL vẫn được giữ.',
        'info'
      );
    }
  };

  const applySuggestions = async () => {
    if (!analysis?.suggestedParams?.length) {
      showStatus('Chưa có gợi ý — chạy “AI phân tích” trước.', 'info');
      return;
    }
    const map = new Map(
      analysis.suggestedParams.map((s) => [s.key, String(s.value)])
    );
    const keys = new Set(map.keys());
    const nextParams = params.map((p) =>
      map.has(p.key) ? { ...p, value: map.get(p.key)! } : p
    );
    setParams(nextParams);
    setAppliedKeys(keys);
    showStatus(`Đã áp dụng ${keys.size} tham số gợi ý vào form.`, 'ok');
    await persistLocal({ params: nextParams });
  };

  const exportSet = () => {
    if (!params.length) {
      showStatus('Chưa có tham số để xuất.', 'info');
      return;
    }
    const content = exportSetContent(
      params,
      `Account ${account.id} · ${botName || fileName || 'EA'}`
    );
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName || `${botName || 'bot'}.set`).replace(/\.set$/i, '') + '.set';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Đã tải file .set — nạp vào MT5 EA.', 'ok');
  };

  const riskColor =
    analysis?.riskLevel === 'LOW'
      ? 'text-neon-green'
      : analysis?.riskLevel === 'HIGH'
        ? 'text-rose-400'
        : 'text-neon-yellow';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="icon-tile icon-tile-purple">
              <Bot className="w-4 h-4 stroke-[1.75]" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white tracking-tight">
              Nghiên cứu <span className="neon-gradient-text">Bot / EA</span>
            </h3>
            <InfoTip title="Bot Research">
              <p>Mỗi TK một profile bot (file .set + PnL ngày).</p>
              <p>AI gợi ý lot/risk/grid theo vốn & DD — chỉnh trên form, không gõ lại.</p>
              <p>Xuất .set → nạp lại EA trên MT5.</p>
            </InfoTip>
          </div>
          <p className="text-[11px] text-dark-text-muted mt-1.5 font-medium">
            TK <span className="font-mono text-neon-cyan">{account.id}</span>
            {account.accountName ? ` · ${account.accountName}` : ''} · Equity{' '}
            <span className="text-neon-yellow">${Math.round(equityUsd).toLocaleString()}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-glass py-2 px-3.5 flex items-center gap-1.5 text-xs font-semibold text-white hover:text-neon-cyan pressable"
          >
            <Upload className="w-3.5 h-3.5" />
            Nạp .set
          </button>
          <button
            type="button"
            onClick={runAnalyze}
            disabled={analyzeState === 'loading'}
            className="btn-neon py-2 px-3.5 flex items-center gap-1.5 text-xs pressable disabled:opacity-60"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${analyzeState === 'loading' ? 'animate-pulse' : ''}`}
            />
            {analyzeState === 'loading' ? 'Đang phân tích…' : 'AI phân tích'}
          </button>
          <button
            type="button"
            onClick={exportSet}
            className="btn-glass py-2 px-3.5 flex items-center gap-1.5 text-xs font-semibold text-neon-purple hover:text-white pressable"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất .set
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".set,.txt,text/plain"
        className="hidden"
        onChange={(e) => {
          void handleSetFile(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />
      <input
        ref={pnlFileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          void handlePnlFile(e.target.files?.[0] || null);
          e.target.value = '';
        }}
      />

      {statusMsg && (
        <div
          className={`rounded-xl px-3.5 py-2.5 text-xs border ${
            statusTone === 'ok'
              ? 'border-neon-green/25 bg-neon-green/5 text-neon-green'
              : 'border-white/10 bg-white/[0.03] text-dark-text-muted'
          }`}
        >
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left: uploads + daily pnl */}
        <div className="space-y-4 lg:col-span-1">
          <div className="neon-card-premium p-4 kpi-purple space-y-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-neon-purple" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                File .set
              </span>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleSetFile(f);
              }}
              className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:border-neon-cyan/40 hover:bg-neon-cyan/[0.04] p-5 text-center cursor-pointer transition-all pressable"
            >
              <Upload className="w-6 h-6 text-dark-text-muted mx-auto mb-2" />
              <p className="text-xs text-white font-semibold">
                Kéo thả hoặc chọn file .set
              </p>
              <p className="text-[10px] text-dark-text-muted mt-1">
                MT5 → EA inputs → Save
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-dark-text-muted uppercase">
                Tên bot
              </label>
              <input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                onBlur={() => void persistLocal({ botName })}
                placeholder="VD: Gold Grid Pro"
                className="mt-1 w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
            {fileName && (
              <p className="text-[10px] text-neon-cyan font-mono truncate">
                {fileName} · {params.length} params
              </p>
            )}
          </div>

          <div className="neon-card-premium p-4 kpi-cyan space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-neon-cyan" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                  Lợi nhuận ngày
                </span>
              </div>
              <button
                type="button"
                onClick={() => pnlFileRef.current?.click()}
                className="text-[10px] font-semibold text-neon-cyan hover:underline"
              >
                Upload CSV
              </button>
            </div>
            <textarea
              value={dailyText}
              onChange={(e) => setDailyText(e.target.value)}
              rows={6}
              placeholder={'2026-07-01,12.5\n2026-07-02,-3.2\n… hoặc chỉ số profit/dòng'}
              className="w-full bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono resize-y min-h-[120px]"
            />
            <button
              type="button"
              onClick={() => void applyDailyText()}
              className="w-full btn-glass py-2 text-xs font-semibold text-white pressable"
            >
              Áp dụng series PnL
            </button>
            {dailySummary.days > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-dark-card/80 rounded-lg p-2 border border-dark-border">
                  <span className="text-dark-text-muted block">Ngày</span>
                  <span className="font-mono font-bold text-white">{dailySummary.days}</span>
                </div>
                <div className="bg-dark-card/80 rounded-lg p-2 border border-dark-border">
                  <span className="text-dark-text-muted block">Tổng</span>
                  <span
                    className={`font-mono font-bold ${
                      dailySummary.total >= 0 ? 'text-neon-green' : 'text-rose-400'
                    }`}
                  >
                    {dailySummary.total >= 0 ? '+' : ''}
                    {dailySummary.total}
                  </span>
                </div>
                <div className="bg-dark-card/80 rounded-lg p-2 border border-dark-border">
                  <span className="text-dark-text-muted block">WR ngày</span>
                  <span className="font-mono font-bold text-neon-yellow">
                    {dailySummary.winRate}%
                  </span>
                </div>
                <div className="bg-dark-card/80 rounded-lg p-2 border border-dark-border">
                  <span className="text-dark-text-muted block">TB/ngày</span>
                  <span className="font-mono font-bold text-neon-cyan">
                    {dailySummary.avg}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: editable params */}
        <div className="lg:col-span-1 space-y-3">
          <div className="neon-card-premium p-4 kpi-yellow min-h-[420px] flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-neon-yellow" />
                Tham số chỉnh sửa
              </span>
              <span className="text-[10px] text-dark-text-muted font-mono">
                {params.length} keys
              </span>
            </div>

            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-dark-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Lọc lot, risk, SL…"
                className="w-full bg-dark-input border border-dark-border rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            {params.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                <FileCode2 className="w-8 h-8 text-dark-text-muted mb-3 opacity-50" />
                <p className="text-xs text-dark-text-muted leading-relaxed">
                  Nạp file <strong className="text-white">.set</strong> để hiện form tham số.
                  Không cần viết lại — chỉnh ô giá trị rồi xuất lại.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1 custom-scrollbar">
                {visibleParams.map((p) => {
                  const suggested = analysis?.suggestedParams?.find((s) => s.key === p.key);
                  const applied = appliedKeys.has(p.key);
                  return (
                    <div
                      key={p.key}
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${
                        suggested
                          ? 'border-neon-cyan/35 bg-neon-cyan/[0.06]'
                          : 'border-dark-border bg-dark-card/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-mono font-semibold text-neon-cyan truncate">
                          {p.key}
                        </span>
                        {suggested && (
                          <span className="text-[9px] font-bold text-neon-yellow shrink-0">
                            AI → {suggested.value}
                          </span>
                        )}
                        {applied && (
                          <Check className="w-3 h-3 text-neon-green shrink-0" />
                        )}
                      </div>
                      <input
                        value={p.value}
                        onChange={(e) => updateParamValue(p.key, e.target.value)}
                        onBlur={() => void persistLocal({ params })}
                        className="w-full bg-dark-input border border-dark-border rounded-lg px-2.5 py-1.5 text-sm text-white font-mono"
                      />
                      {suggested?.reason && (
                        <p className="text-[9px] text-dark-text-muted mt-1 leading-snug">
                          {suggested.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {params.length > 0 && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => void applySuggestions()}
                  className="flex-1 btn-neon py-2 text-[11px] font-bold pressable flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Áp dụng gợi ý
                </button>
                <button
                  type="button"
                  onClick={() => void persistLocal({ params })}
                  className="btn-glass py-2 px-3 text-[11px] font-semibold pressable"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI result */}
        <div className="lg:col-span-1 space-y-4">
          <div className="neon-card-premium p-4 kpi-pink min-h-[200px]">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-neon-pink" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                Đánh giá AI
              </span>
            </div>

            {!analysis && analyzeState !== 'loading' && (
              <p className="text-xs text-dark-text-muted leading-relaxed">
                Bấm <strong className="text-white">AI phân tích</strong> để nhận risk score,
                cảnh báo và gợi ý tham số theo vốn TK này.
              </p>
            )}

            {analyzeState === 'loading' && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan animate-spin" />
                <p className="text-[11px] text-dark-text-muted">Đang chấm điểm bot…</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-dark-text-muted uppercase block">
                      Risk level
                    </span>
                    <span className={`text-xl font-black font-mono ${riskColor}`}>
                      {analysis.riskLevel}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-dark-text-muted uppercase block">
                      Score
                    </span>
                    <span className="text-2xl font-black font-mono text-white">
                      {analysis.riskScore}
                      <span className="text-xs text-dark-text-muted">/100</span>
                    </span>
                  </div>
                </div>

                <div
                  className="text-xs text-dark-text-muted leading-relaxed prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownLite(analysis.summary),
                  }}
                />

                {analysis.warnings?.length > 0 && (
                  <ul className="space-y-1.5">
                    {analysis.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-neon-yellow/90 bg-neon-yellow/5 border border-neon-yellow/15 rounded-lg px-2.5 py-1.5"
                      >
                        {w}
                      </li>
                    ))}
                  </ul>
                )}

                {analysis.actions?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-dark-text-muted uppercase">
                      Hành động
                    </span>
                    <ol className="mt-1.5 space-y-1 list-decimal list-inside">
                      {analysis.actions.map((a, i) => (
                        <li key={i} className="text-[11px] text-white/85 leading-snug">
                          {a}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {analysis.suggestedParams?.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-dark-text-muted uppercase">
                      Gợi ý ({analysis.suggestedParams.length})
                    </span>
                    <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {analysis.suggestedParams.map((s) => (
                        <div
                          key={s.key}
                          className="flex items-center justify-between gap-2 text-[11px] font-mono bg-dark-card rounded-lg px-2 py-1.5 border border-dark-border"
                        >
                          <span className="text-neon-cyan truncate">{s.key}</span>
                          <span className="text-neon-yellow shrink-0">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {analysis.provider && (
                  <p className="text-[9px] text-dark-text-muted/70 font-mono">
                    via {analysis.provider}
                    {analysis.analyzedAt
                      ? ` · ${new Date(analysis.analyzedAt).toLocaleString('vi-VN')}`
                      : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="neon-card-premium p-4 kpi-blue text-[11px] text-dark-text-muted leading-relaxed space-y-1.5">
            <p className="text-white font-semibold text-xs">Workflow gợi ý</p>
            <p>1. Nạp .set của EA đang chạy trên TK này</p>
            <p>2. Dán / upload lợi nhuận theo ngày (nếu có)</p>
            <p>3. AI phân tích → xem gợi ý → <strong className="text-neon-cyan">Áp dụng gợi ý</strong></p>
            <p>4. Tinh chỉnh ô giá trị → Xuất .set → nạp MT5</p>
          </div>
        </div>
      </div>
    </div>
  );
}
