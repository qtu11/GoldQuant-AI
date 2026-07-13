'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, ShieldAlert, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore';
import { toUsd } from '../utils/currency';
import { renderMarkdownLite } from '../utils/markdownLite';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface GoldTicker {
  priceUsd: number;
  source: string;
  updatedAtReadable: string;
  updatedAt: string;
  stale?: boolean;
}

export default function AiAdvisorChat() {
  const accounts = useTradingStore((s) => s.accounts);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text:
        'Xin chào Chủ tịch Tú. Tôi là **GoldQuant AI Advisor** — đã nối feed giá vàng realtime.\n\nHỏi **"giá vàng hiện tại?"** hoặc risk / lot / session XAUUSD.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gold, setGold] = useState<GoldTicker | null>(null);
  const [goldLoading, setGoldLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchGold = useCallback(async (force = false) => {
    setGoldLoading(true);
    try {
      const res = await fetch(`/api/quant/gold-price${force ? '?force=1' : ''}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.ok && data.quote?.priceUsd > 0) {
        setGold({
          priceUsd: data.quote.priceUsd,
          source: data.quote.source,
          updatedAtReadable: data.quote.updatedAtReadable,
          updatedAt: data.quote.updatedAt,
          stale: data.quote.stale,
        });
      }
    } catch (e) {
      console.warn('Gold ticker failed', e);
    } finally {
      setGoldLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Defer setState ra khỏi body sync của effect (React 19 lint)
    const boot = window.setTimeout(() => {
      if (!cancelled) void fetchGold(false);
    }, 0);
    const t = window.setInterval(() => {
      if (!cancelled) void fetchGold(false);
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      window.clearInterval(t);
    };
  }, [fetchGold]);

  useEffect(() => {
    // scroll DOM external — OK
    const el = messagesEndRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages]);

  const buildPortfolioContext = () => {
    if (!accounts.length) return '';
    const totalEq = accounts.reduce((s, a) => s + toUsd(a.currentEquity, a.currency), 0);
    const lines = accounts.map(
      (a) =>
        `- ${a.accountName || a.id}: equity $${toUsd(a.currentEquity, a.currency).toFixed(0)}, PnL $${toUsd(a.stats.netProfit, a.currency).toFixed(0)}, DD ${a.stats.maxDrawdown}%, Risk ${a.riskScore}, trades ${a.stats.totalTrades}`
    );
    return `Tổng equity ~$${totalEq.toFixed(0)}\n${lines.join('\n')}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsgId = Date.now().toString();
    const userText = input;
    const chatHistory = [...messages];

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: userText, timestamp: new Date() },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/quant/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: chatHistory,
          portfolioContext: buildPortfolioContext(),
        }),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();

      if (data.market?.priceUsd > 0) {
        setGold({
          priceUsd: data.market.priceUsd,
          source: data.market.source,
          updatedAtReadable: data.market.updatedAtReadable,
          updatedAt: data.market.updatedAt,
          stale: data.market.stale,
        });
      }

      let reply = String(data.reply || '').trim();
      if (!reply) {
        reply =
          'Dạ thưa Chủ tịch Tú, AI không trả nội dung. Xin thử lại sau vài giây.';
      }
      // Tag nhẹ khi fallback deterministic / degraded
      if (data.meta?.degraded && data.meta?.provider === 'deterministic') {
        // reply đã có note degraded trong body
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('AI API Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text:
            'Dạ thưa Chủ tịch Tú, không kết nối được `/api/quant/ai-advisor`.\n\n' +
            '- Thử lại sau 30–60s (Gemini 429/503)\n' +
            '- Kiểm tra `.env`: `GEMINI_API_KEY` và/hoặc `XAI_API_KEY`\n' +
            '- Bấm refresh giá vàng trên header để lấy feed market',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] neon-card-premium overflow-hidden kpi-cyan neon-card-static">
      <div className="px-4 py-3 border-b border-white/5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="icon-tile icon-tile-cyan pulse-glow-cyan">
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate font-display">
                GoldQuant AI Advisor
              </h3>
              <p className="text-[10px] text-neon-cyan font-medium tracking-wide">
                Multi-LLM · Gemini + Grok fallback
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 badge-neon-pink px-2.5 py-1 text-[10px] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 stroke-[1.75]" />
            MONITOR
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.04] border border-neon-yellow/20 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-3.5 h-3.5 text-neon-yellow flex-shrink-0 stroke-[1.75]" />
            <div className="min-w-0">
              <span className="text-[9px] text-dark-text-muted uppercase font-semibold tracking-wider block">
                XAUUSD live
              </span>
              {gold ? (
                <span className="text-sm font-semibold font-mono text-neon-yellow">
                  $
                  {gold.priceUsd.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              ) : (
                <span className="text-xs text-dark-text-muted shimmer rounded-full px-6 py-1 inline-block">
                  loading…
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex items-center gap-2 flex-shrink-0">
            {gold && (
              <div className="hidden sm:block">
                <span className="text-[9px] text-dark-text-muted block font-mono">{gold.source}</span>
                <span className="text-[9px] text-neon-cyan/70 block">
                  {gold.updatedAtReadable}
                  {gold.stale ? ' · cache' : ''}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fetchGold(true)}
              disabled={goldLoading}
              className="btn-glass p-1.5 text-neon-cyan disabled:opacity-40 pressable"
              title="Làm mới giá vàng"
            >
              <RefreshCw className={`w-3.5 h-3.5 stroke-[1.75] ${goldLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[90%] animate-in ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                msg.sender === 'user'
                  ? 'bg-neon-pink/15 border-neon-pink/30 text-neon-pink'
                  : 'bg-neon-cyan/15 border-neon-cyan/30 text-neon-cyan'
              }`}
            >
              {msg.sender === 'user' ? (
                <User className="w-4 h-4 stroke-[1.75]" />
              ) : (
                <Bot className="w-4 h-4 stroke-[1.75]" />
              )}
            </div>

            <div
              className={`p-3.5 leading-relaxed ${
                msg.sender === 'user' ? 'ai-bubble-user text-white' : 'ai-bubble-assistant text-dark-text-light'
              }`}
            >
              <div
                className="text-sm leading-relaxed break-words gq-chat-md"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdownLite(msg.text),
                }}
              />
              <span className="block mt-2 text-[9px] text-dark-text-muted text-right font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] animate-in">
            <div className="w-8 h-8 rounded-full bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan flex items-center justify-center">
              <Bot className="w-4 h-4 stroke-[1.75]" />
            </div>
            <div className="ai-bubble-assistant px-4 py-3 flex items-center gap-2 text-[10px] text-dark-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-pink animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-bounce [animation-delay:0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:0.3s]" />
              <span className="ml-1">Đang lấy giá live + phân tích…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 pb-1 flex flex-wrap gap-1.5">
        {['Giá vàng hiện tại?', 'Tin gì hôm nay?', 'Nên lot bao nhiêu?'].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setInput(q)}
            className="text-[10px] px-3 py-1 rounded-full btn-glass text-dark-text-muted hover:text-neon-cyan pressable"
          >
            {q}
          </button>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-white/5">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi giá vàng live, risk, lot, session..."
            className="flex-1 px-4 py-2.5 rounded-full border border-white/10 bg-white/5 text-white placeholder-dark-text-muted focus:outline-none text-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-full btn-neon flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed pressable"
            title="Gửi"
          >
            <Send className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>
      </form>
    </div>
  );
}
