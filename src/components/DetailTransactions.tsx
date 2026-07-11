'use client';

import React, { useState } from 'react';
import { Trade } from '../utils/fileParser';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DetailTransactionsProps {
  trades: Trade[];
}

export default function DetailTransactions({ trades }: DetailTransactionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Lọc theo tìm kiếm
  const filteredTrades = trades.filter(t => 
    t.ticket.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sắp xếp ngược lại (mới nhất lên đầu để dễ xem)
  const sortedTrades = [...filteredTrades].sort((a, b) => 
    new Date(b.openTime.replace(/\./g, '/')).getTime() - new Date(a.openTime.replace(/\./g, '/')).getTime()
  );

  // Tính phân trang
  const totalItems = sortedTrades.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = sortedTrades.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="glass-effect-premium rounded-xl overflow-hidden flex flex-col border border-white/5 shadow-2xl">
      {/* Search & Pagination Header */}
      <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/1">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-dark-text-muted absolute left-3.5 top-3" />
          <input 
            type="text"
            placeholder="Search ticket, symbol, comment..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white/3 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-gold focus:outline-none transition-all placeholder-dark-text-muted/60"
          />
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-3.5">
          <span className="text-xs text-dark-text-muted font-mono bg-white/2 border border-white/5 px-2.5 py-1 rounded-md">
            {totalItems > 0 ? `${startIndex + 1}–${endIndex} of ${totalItems}` : '0–0 of 0'}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || totalItems === 0}
              className="p-1.5 rounded-lg border border-white/5 bg-white/3 text-dark-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalItems === 0}
              className="p-1.5 rounded-lg border border-white/5 bg-white/3 text-dark-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1 max-h-[500px]">
        <table className="w-full border-collapse text-left glass-table">
          <thead>
            <tr className="bg-white/1 border-b border-white/5 text-[10px] font-bold text-dark-text-muted tracking-wider uppercase">
              <th className="py-3 px-4">Ticket</th>
              <th className="py-3 px-4">Open Time</th>
              <th className="py-3 px-4">Close Time</th>
              <th className="py-3 px-4">Symbol</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">Volume</th>
              <th className="py-3 px-4 text-right">Open</th>
              <th className="py-3 px-4 text-right">Close</th>
              <th className="py-3 px-4 text-right">Profit</th>
              <th className="py-3 px-4 text-right">Comm.</th>
              <th className="py-3 px-4 text-right">Swap</th>
              <th className="py-3 px-4">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-xs text-dark-text-light">
            {currentItems.length > 0 ? (
              currentItems.map((trade) => {
                const totalProfit = trade.profit + trade.commission + trade.swap;
                const isBuy = trade.type === 'BUY';
                return (
                  <tr key={trade.ticket} className="hover:bg-white/3 transition-colors duration-150 group">
                    <td className="py-3 px-4 text-dark-text-muted group-hover:text-white transition-colors">{trade.ticket}</td>
                    <td className="py-3 px-4 text-dark-text-muted whitespace-nowrap">{trade.openTime}</td>
                    <td className="py-3 px-4 text-dark-text-muted whitespace-nowrap">{trade.closeTime}</td>
                    <td className="py-3 px-4 text-white font-semibold">{trade.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider flex items-center gap-1 w-max border ${
                        isBuy 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-semibold font-numeric">{trade.volume.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-dark-text-muted font-numeric">{trade.openPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-dark-text-muted font-numeric">{trade.closePrice.toFixed(2)}</td>
                    <td className={`py-3 px-4 text-right font-bold font-numeric ${
                      totalProfit > 0 
                        ? 'text-emerald-400' 
                        : totalProfit < 0 
                          ? 'text-red-400' 
                          : 'text-dark-text-light'
                    }`}>
                      {totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-dark-text-muted/70 font-numeric">
                      {trade.commission !== 0 ? `-$${Math.abs(trade.commission).toFixed(2)}` : '0'}
                    </td>
                    <td className="py-3 px-4 text-right text-dark-text-muted/70 font-numeric">
                      {trade.swap !== 0 ? (trade.swap > 0 ? `+$${trade.swap.toFixed(2)}` : `-$${Math.abs(trade.swap).toFixed(2)}`) : '0'}
                    </td>
                    <td className="py-3 px-4 text-dark-text-muted max-w-[120px] truncate" title={trade.comment}>{trade.comment}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="py-12 text-center text-dark-text-muted">
                  Không tìm thấy lịch sử giao dịch nào khớp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
