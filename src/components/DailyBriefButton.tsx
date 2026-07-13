'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTradingStore } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { evaluateRiskRules } from '../utils/riskRules';
import { useToolsStore } from '../store/useToolsStore';
import { renderMarkdownLite } from '../utils/markdownLite';
import { Newspaper, Loader2, X } from 'lucide-react';

export default function DailyBriefButton() {
  const { accounts } = useTradingStore();
  const { riskRules } = useToolsStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const buildContext = () => {
    const totalEq = accounts.reduce((s, a) => s + toUsd(a.currentEquity, a.currency), 0);
    const totalPnL = accounts.reduce((s, a) => s + toUsd(a.stats.netProfit, a.currency), 0);
    const avgDD =
      accounts.length > 0
        ? accounts.reduce((s, a) => s + a.stats.maxDrawdown, 0) / accounts.length
        : 0;
    const breaches = evaluateRiskRules(accounts, riskRules);

    const lines = accounts.map(
      (a) =>
        `- ${a.accountName || a.id}: equity $${toUsd(a.currentEquity, a.currency).toFixed(0)}, PnL $${toUsd(a.stats.netProfit, a.currency).toFixed(0)}, DD ${a.stats.maxDrawdown}%, PF ${a.stats.profitFactor}, Risk ${a.riskScore}, trades ${a.stats.totalTrades}`
    );

    return (
      `Viết BRIEF BUỔI SÁNG ngắn gọn cho Chủ tịch Tú (tiếng Việt).\n\n` +
      `### Dữ liệu portfolio\n` +
      `- Số TK: ${accounts.length}\n` +
      `- Equity ~$${totalEq.toFixed(0)}\n` +
      `- PnL ~$${totalPnL.toFixed(0)}\n` +
      `- Avg DD ${avgDD.toFixed(1)}%\n` +
      `- Rule breaches: ${breaches.length ? breaches.map((b) => b.message).join('; ') : 'không có'}\n` +
      `Accounts:\n${lines.join('\n') || '(trống)'}\n\n` +
      `### Cấu trúc trả lời (Markdown sạch, có heading ### và bullet - )\n` +
      `1. ### Tóm tắt rủi ro portfolio\n` +
      `2. ### Tài khoản cần chú ý\n` +
      `3. ### Gợi ý size / session XAU hôm nay\n` +
      `4. ### 1 hành động cụ thể\n` +
      `Ngắn, rõ, dùng **in đậm** cho số quan trọng. Không raw HTML.`
    );
  };

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setBrief('');
    try {
      const response = await fetch('/api/quant/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildContext(),
          history: [],
          portfolioContext: accounts
            .map(
              (a) =>
                `${a.accountName || a.id}: eq ${toUsd(a.currentEquity, a.currency).toFixed(0)} PnL ${toUsd(a.stats.netProfit, a.currency).toFixed(0)} DD ${a.stats.maxDrawdown}% Risk ${a.riskScore}`
            )
            .join('\n'),
        }),
      });
      const data = await response.json();
      setBrief(data.reply || 'Không nhận được brief.');
    } catch {
      setBrief(
        '### Không kết nối được AI\n\n' +
          'Kiểm tra `GEMINI_API_KEY` / `XAI_API_KEY` (Gemini 429 → thêm Grok).\n\n' +
          '**Fallback manual:**\n' +
          '- Rà soát Max DD từng TK\n' +
          '- Tránh oversize trước tin CPI/NFP\n' +
          '- Giữ risk ≤ **1%/lệnh**'
      );
    } finally {
      setLoading(false);
    }
  };

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="gq-modal-overlay"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-brief-title"
          >
            <div
              className="gq-modal-panel max-w-xl h-[min(80vh,640px)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
                <h3
                  id="daily-brief-title"
                  className="text-sm font-semibold text-white flex items-center gap-2 font-display"
                >
                  <Newspaper className="w-4 h-4 text-neon-cyan stroke-[1.75]" />
                  AI Daily Brief
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-glass p-2 text-dark-text-muted hover:text-white pressable"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              <div className="gq-modal-body text-sm text-dark-text-light leading-relaxed">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-neon-cyan">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-xs text-dark-text-muted">
                      Đang tổng hợp portfolio + brief…
                    </p>
                  </div>
                ) : (
                  <div
                    className="break-words"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownLite(brief),
                    }}
                  />
                )}
              </div>

              <div className="p-3 border-t border-white/5 flex justify-between items-center flex-shrink-0 text-[9px] text-dark-text-muted">
                <span>GoldQuant AI · không phải lời khuyên đầu tư</span>
                <button
                  type="button"
                  onClick={() => void run()}
                  disabled={loading}
                  className="text-[10px] font-semibold text-neon-cyan hover:underline disabled:opacity-40"
                >
                  Làm mới
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => void run()}
        className="btn-neon inline-flex items-center justify-center h-10 gap-1.5 px-3.5 rounded-full text-[12px] font-semibold leading-none pressable"
        title="AI Daily Brief"
      >
        <Newspaper className="w-3.5 h-3.5 stroke-[1.75] flex-shrink-0" />
        <span className="hidden sm:inline leading-none">Daily Brief</span>
      </button>
      {modal}
    </>
  );
}
