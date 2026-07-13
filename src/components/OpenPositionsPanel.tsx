'use client';

import React, { useState } from 'react';
import { useTradingStore } from '../store/useTradingStore';
import { floatingPnl, totalFloatingPnl, totalExposureLots } from '../utils/capitalEquity';
import { Activity, Plus, Trash2 } from 'lucide-react';
import InfoTip from './InfoTip';

interface Props {
  accountId: string;
}

export default function OpenPositionsPanel({ accountId }: Props) {
  const { accounts, addOpenPosition, removeOpenPosition, updateOpenPosition } =
    useTradingStore();
  const acc = accounts.find((a) => a.id === accountId);

  const [symbol, setSymbol] = useState('XAUUSD');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [volume, setVolume] = useState(0.01);
  const [openPrice, setOpenPrice] = useState(2300);
  const [currentPrice, setCurrentPrice] = useState(2305);
  const [sl, setSl] = useState<number | ''>('');
  const [tp, setTp] = useState<number | ''>('');

  if (!acc) return null;

  const positions = acc.openPositions || [];
  const floatTotal = totalFloatingPnl(positions, 100, acc.currency);
  const lots = totalExposureLots(positions);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (volume <= 0 || openPrice <= 0) {
      alert('Volume và giá mở phải > 0');
      return;
    }
    try {
      await addOpenPosition(accountId, {
        symbol: symbol.trim() || 'XAUUSD',
        type,
        volume: Number(volume),
        openPrice: Number(openPrice),
        currentPrice: Number(currentPrice) || Number(openPrice),
        sl: sl === '' ? undefined : Number(sl),
        tp: tp === '' ? undefined : Number(tp),
        openTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
        comment: 'manual',
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể thêm lệnh mở.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="neon-card-premium p-4 kpi-cyan">
          <span className="text-[10px] text-dark-text-muted uppercase font-bold">Open positions</span>
          <span className="text-2xl font-black text-neon-cyan font-mono block mt-1">
            {positions.length}
          </span>
        </div>
        <div className="neon-card-premium p-4 kpi-yellow">
          <span className="text-[10px] text-dark-text-muted uppercase font-bold">Exposure lots</span>
          <span className="text-2xl font-black text-neon-yellow font-mono block mt-1">{lots}</span>
        </div>
        <div className="neon-card-premium p-4 kpi-green col-span-2 sm:col-span-1">
          <span className="text-[10px] text-dark-text-muted uppercase font-bold">Floating PnL</span>
          <span
            className={`text-2xl font-black font-mono block mt-1 ${
              floatTotal >= 0 ? 'text-neon-green' : 'text-rose-400'
            }`}
          >
            {floatTotal >= 0 ? '+' : ''}
            {floatTotal.toLocaleString()} {acc.currency}
          </span>
        </div>
      </div>

      <div className="neon-card-premium p-5 kpi-pink space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-tile icon-tile-pink">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Thêm lệnh đang mở (manual)
            </h4>
            <InfoTip title="Open Positions">
              <p>Nhập tay lệnh đang mở trên MT5 (chưa có EA auto).</p>
              <p>
                Floating XAU ≈ (giá hiện tại − giá mở) × lot × 100 (BUY; SELL đảo dấu).
              </p>
              <p>Không tính vào closed equity cho đến khi đóng lệnh / upload history.</p>
            </InfoTip>
          </div>
        </div>
        <p className="text-[10px] text-dark-text-muted">
          Solo mode — nhập tay từ MT5. Floating ≈ Δprice × lot × 100 (XAU standard).
        </p>

        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
            placeholder="Symbol"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input
            type="number"
            step={0.01}
            min={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono"
            placeholder="Lots"
          />
          <input
            type="number"
            step={0.01}
            value={openPrice}
            onChange={(e) => setOpenPrice(Number(e.target.value))}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono"
            placeholder="Open"
          />
          <input
            type="number"
            step={0.01}
            value={currentPrice}
            onChange={(e) => setCurrentPrice(Number(e.target.value))}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono"
            placeholder="Current"
          />
          <input
            type="number"
            step={0.01}
            value={sl}
            onChange={(e) => setSl(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono"
            placeholder="SL"
          />
          <input
            type="number"
            step={0.01}
            value={tp}
            onChange={(e) => setTp(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-dark-input border border-dark-border rounded-xl px-3 py-2 text-xs text-white font-mono"
            placeholder="TP"
          />
          <button
            type="submit"
            className="btn-neon rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>
      </div>

      <div className="neon-card overflow-hidden !rounded-2xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-dark-sidebar text-[10px] uppercase text-dark-text-muted">
              <th className="text-left py-3 px-3">Symbol</th>
              <th className="text-left py-3 px-2">Side</th>
              <th className="text-right py-3 px-2">Lots</th>
              <th className="text-right py-3 px-2">Open</th>
              <th className="text-right py-3 px-2">Current</th>
              <th className="text-right py-3 px-2">Float</th>
              <th className="text-center py-3 px-2"> </th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-dark-text-muted">
                  Không có lệnh mở — thêm từ form trên.
                </td>
              </tr>
            )}
            {positions.map((p) => {
              const pnl = floatingPnl(p, 100, acc.currency);
              return (
                <tr key={p.id} className="border-t border-dark-border hover:bg-white/2">
                  <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                  <td
                    className={`py-2.5 px-2 font-bold ${
                      p.type === 'BUY' ? 'text-neon-green' : 'text-neon-pink'
                    }`}
                  >
                    {p.type}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">{p.volume}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-dark-text-muted">
                    {p.openPrice}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <input
                      type="number"
                      step={0.01}
                      value={p.currentPrice}
                      onChange={(e) =>
                        updateOpenPosition(accountId, p.id, {
                          currentPrice: Number(e.target.value),
                        })
                      }
                      className="w-24 bg-dark-input border border-dark-border rounded-lg px-2 py-1 text-right font-mono text-white"
                    />
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-mono font-bold ${
                      pnl >= 0 ? 'text-neon-green' : 'text-rose-400'
                    }`}
                  >
                    {pnl >= 0 ? '+' : ''}
                    {pnl.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={() => removeOpenPosition(accountId, p.id)}
                      className="text-dark-text-muted hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
