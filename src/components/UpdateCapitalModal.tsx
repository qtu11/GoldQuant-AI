'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTradingStore } from '../store/useTradingStore';
import { X, Coins, Check } from 'lucide-react';

interface UpdateCapitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

export default function UpdateCapitalModal({ isOpen, onClose, accountId }: UpdateCapitalModalProps) {
  const { accounts, updateCapital } = useTradingStore();
  const [initialCapital, setInitialCapital] = useState(2000);
  const [currentEquity, setCurrentEquity] = useState(3149);
  const [mounted, setMounted] = useState(false);

  const targetAcc = accounts.find(a => a.id === accountId);
  const isCent = targetAcc?.currency === 'USC';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (targetAcc) {
      setInitialCapital(targetAcc.initialCapital);
      setCurrentEquity(targetAcc.currentEquity);
    }
  }, [accountId, accounts, isOpen, targetAcc]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const init = Number(initialCapital);
    const eq = Number(currentEquity);
    if (!Number.isFinite(init) || init < 0) {
      alert('Vốn ban đầu không hợp lệ');
      return;
    }
    if (!Number.isFinite(eq)) {
      alert('Equity không hợp lệ');
      return;
    }
    try {
      await updateCapital(accountId, init, eq);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cập nhật vốn thất bại');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/65 flex items-center justify-center p-4 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="liquid-modal-panel max-w-md w-full relative animate-in fade-in zoom-in-95 duration-300">
        
        {/* Top glowing bar */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/1">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold animate-pulse" />
            <h3 className="font-extrabold text-white text-base">Cập Nhật Vốn Tài Khoản</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-dark-text-muted hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-white/3 p-3.5 rounded-lg border border-white/5">
            <span className="text-[10px] font-bold text-dark-text-muted uppercase block tracking-wider">Đang cấu hình tài khoản</span>
            <span className="text-sm font-mono text-gold font-bold block mt-1">{accountId} {targetAcc?.accountName ? `(${targetAcc.accountName})` : ''}</span>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
              Vốn Ban Đầu ({isCent ? 'Initial Capital - Cent' : 'Initial Capital - USD'})
            </label>
            <input 
              type="number"
              required
              min="0"
              step="0.01"
              value={initialCapital}
              onChange={e => setInitialCapital(Number(e.target.value))}
              className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono font-bold text-gold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
              Vốn Hiện Tại ({isCent ? 'Current Equity - Cent' : 'Current Equity - USD'})
            </label>
            <input 
              type="number"
              required
              min="0"
              step="0.01"
              value={currentEquity}
              onChange={e => setCurrentEquity(Number(e.target.value))}
              className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono font-bold text-gold"
            />
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-transparent hover:bg-white/5 text-dark-text-muted hover:text-white border border-white/5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 bg-gold hover:bg-gold-hover text-dark-bg font-extrabold py-2.5 rounded-lg text-xs transition-all cursor-pointer gold-glow-hover active:scale-95 flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              <span>Cập nhật</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
