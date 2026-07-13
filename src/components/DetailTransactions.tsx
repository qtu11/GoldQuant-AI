'use client';

import React, { useMemo, useState } from 'react';
import { Trade, parseDate } from '../utils/fileParser';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import InfoTip from './InfoTip';

interface DetailTransactionsProps {
  trades: Trade[];
  currency?: 'USD' | 'USC';
}

export default function DetailTransactions({
  trades,
  currency = 'USD',
}: DetailTransactionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter(
      (t) =>
        t.ticket.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        (t.comment || '').toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
    );
  }, [trades, searchQuery]);

  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      const tb = parseDate(b.closeTime || b.openTime).getTime();
      const ta = parseDate(a.closeTime || a.openTime).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.ticket).localeCompare(String(a.ticket));
    });
  }, [filteredTrades]);

  const totalItems = sortedTrades.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1);
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = sortedTrades.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const fmtSigned = (n: number) => {
    const abs = Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const prefix = n > 0 ? '+' : n < 0 ? '−' : '';
    if (currency === 'USC') return `${prefix}${abs}`;
    return `${prefix}$${abs}`;
  };

  return (
    <div className="neon-card-premium neon-card-static overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-[11px] font-semibold text-white uppercase tracking-wider whitespace-nowrap">
            Transactions
          </h4>
          <InfoTip title="Bảng lịch sử lệnh" align="left">
            <p>Hiển thị lệnh đã đóng từ file MT5 đã upload.</p>
            <p>
              <strong className="text-white">Profit</strong> = profit + commission + swap.
            </p>
            <p>Sắp xếp mới nhất trước · 50 lệnh / trang · tìm theo ticket / symbol / comment.</p>
          </InfoTip>
          <span className="text-[10px] font-mono text-dark-text-muted">
            {totalItems.toLocaleString('en-US')} lệnh
            {currency === 'USC' ? ' · USC' : ' · USD'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:w-64 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-dark-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ticket, symbol, comment…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-neon-cyan focus:outline-none placeholder-dark-text-muted/60"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-dark-text-muted font-mono bg-dark-card border border-dark-border px-2 py-1 rounded-md">
              {totalItems > 0
                ? `${startIndex + 1}–${endIndex} / ${totalItems}`
                : '0 / 0'}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1 || totalItems === 0}
              className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-cyan disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= totalPages || totalItems === 0}
              className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-neon-cyan disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[min(560px,60vh)] gq-scroll">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#15151f] shadow-[0_1px_0_rgba(42,51,80,1)]">
            <tr className="text-[10px] font-bold text-dark-text-muted tracking-wider uppercase">
              <th className="py-2.5 px-3 whitespace-nowrap">Ticket</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Open</th>
              <th className="py-2.5 px-3 whitespace-nowrap">Close</th>
              <th className="py-2.5 px-3">Symbol</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3 text-right">Vol</th>
              <th className="py-2.5 px-3 text-right">Open $</th>
              <th className="py-2.5 px-3 text-right">Close $</th>
              <th className="py-2.5 px-3 text-right">Profit</th>
              <th className="py-2.5 px-3 text-right">Comm</th>
              <th className="py-2.5 px-3 text-right">Swap</th>
              <th className="py-2.5 px-3">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/80 font-mono text-[11px]">
            {currentItems.length > 0 ? (
              currentItems.map((trade, idx) => {
                const totalProfit = trade.profit + trade.commission + trade.swap;
                const isBuy = trade.type === 'BUY';
                const rowKey = `${trade.ticket}-${trade.openTime}-${trade.closeTime}-${idx}`;
                return (
                  <tr
                    key={rowKey}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-2 px-3 text-dark-text-muted whitespace-nowrap">
                      {trade.ticket}
                    </td>
                    <td className="py-2 px-3 text-dark-text-muted whitespace-nowrap">
                      {trade.openTime}
                    </td>
                    <td className="py-2 px-3 text-dark-text-muted whitespace-nowrap">
                      {trade.closeTime}
                    </td>
                    <td className="py-2 px-3 text-white font-semibold whitespace-nowrap">
                      {trade.symbol}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                        }`}
                      >
                        {isBuy ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-white tabular-nums">
                      {trade.volume.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-dark-text-muted tabular-nums">
                      {trade.openPrice.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-dark-text-muted tabular-nums">
                      {trade.closePrice > 0
                        ? trade.closePrice.toFixed(2)
                        : trade.openPrice > 0
                          ? trade.openPrice.toFixed(2)
                          : '—'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                        totalProfit > 0
                          ? 'text-emerald-400'
                          : totalProfit < 0
                            ? 'text-rose-400'
                            : 'text-dark-text-muted'
                      }`}
                    >
                      {fmtSigned(totalProfit)}
                    </td>
                    <td className="py-2 px-3 text-right text-dark-text-muted/80 tabular-nums whitespace-nowrap">
                      {trade.commission !== 0
                        ? fmtSigned(trade.commission)
                        : '0'}
                    </td>
                    <td className="py-2 px-3 text-right text-dark-text-muted/80 tabular-nums whitespace-nowrap">
                      {trade.swap !== 0 ? fmtSigned(trade.swap) : '0'}
                    </td>
                    <td
                      className="py-2 px-3 text-dark-text-muted max-w-[140px] truncate"
                      title={trade.comment}
                    >
                      {trade.comment || '—'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={12}
                  className="py-14 text-center text-dark-text-muted text-xs font-sans"
                >
                  {trades.length === 0
                    ? 'Chưa có lệnh — dùng Upload History phía trên để nạp file MT5.'
                    : 'Không có lệnh khớp bộ lọc tìm kiếm.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
