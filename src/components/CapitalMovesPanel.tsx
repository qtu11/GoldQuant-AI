'use client';

import React, { useState } from 'react';
import { useTradingStore } from '../store/useTradingStore';
import { ArrowDownLeft, ArrowUpRight, Trash2, Wallet } from 'lucide-react';
import InfoTip from './InfoTip';

interface Props {
  accountId: string;
}

export default function CapitalMovesPanel({ accountId }: Props) {
  const { accounts, addCapitalMove, removeCapitalMove } = useTradingStore();
  const acc = accounts.find((a) => a.id === accountId);
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!acc) return null;

  const moves = [...(acc.capitalMoves || [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Số tiền phải > 0');
      return;
    }
    try {
      await addCapitalMove(accountId, {
        type,
        amount: Number(amount),
        note: note.trim(),
        date,
      });
      setNote('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể ghi nạp/rút.');
    }
  };

  return (
    <div className="neon-card-premium p-5 kpi-green space-y-4">
      <div className="flex items-center gap-2">
        <div className="icon-tile icon-tile-green">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Nạp / Rút vốn
            </h4>
            <InfoTip title="Nạp / Rút">
              <p>Ghi nhận deposit / withdrawal ngoài lệnh trade.</p>
              <p>
                Equity = Initial + PnL lệnh + net nạp/rút. Không nhầm nạp tiền với profit.
              </p>
            </InfoTip>
          </div>
          <p className="text-[10px] text-dark-text-muted">
            Điều chỉnh equity ngoài PnL giao dịch · {acc.currency}
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2">
        <div className="col-span-2 flex gap-1 bg-dark-card border border-dark-border p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setType('deposit')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 ${
              type === 'deposit' ? 'bg-neon-green/20 text-neon-green' : 'text-dark-text-muted'
            }`}
          >
            <ArrowDownLeft className="w-3 h-3" /> Deposit
          </button>
          <button
            type="button"
            onClick={() => setType('withdrawal')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 ${
              type === 'withdrawal' ? 'bg-rose-500/20 text-rose-400' : 'text-dark-text-muted'
            }`}
          >
            <ArrowUpRight className="w-3 h-3" /> Withdraw
          </button>
        </div>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white font-mono"
          placeholder="Amount"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú (optional)"
          className="col-span-2 bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-sm text-white"
        />
        <button type="submit" className="col-span-2 btn-neon rounded-xl py-2 text-xs font-bold">
          Ghi nhận {type === 'deposit' ? 'nạp' : 'rút'}
        </button>
      </form>

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {moves.length === 0 && (
          <p className="text-[11px] text-dark-text-muted text-center py-4">Chưa có nạp/rút.</p>
        )}
        {moves.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg bg-dark-card border border-dark-border text-xs"
          >
            <div className="min-w-0">
              <span
                className={`font-bold font-mono ${
                  m.type === 'deposit' ? 'text-neon-green' : 'text-rose-400'
                }`}
              >
                {m.type === 'deposit' ? '+' : '-'}
                {m.amount.toLocaleString()} {acc.currency}
              </span>
              <span className="text-dark-text-muted block text-[10px] truncate">
                {m.date} {m.note ? `· ${m.note}` : ''}
              </span>
            </div>
            <button
              onClick={() => removeCapitalMove(accountId, m.id)}
              className="text-dark-text-muted hover:text-rose-400 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
