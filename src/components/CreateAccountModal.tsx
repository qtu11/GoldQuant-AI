'use client';

import React, { useState } from 'react';
import { useTradingStore } from '../store/useTradingStore';
import { X, Server, Coins, Landmark, Zap } from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Hàm sinh tự động danh sách máy chủ Exness
const generateExnessServers = (): string[] => {
  const servers: string[] = ['Exness-MT5Real'];
  for (let i = 2; i <= 45; i++) {
    servers.push(`Exness-MT5Real${i}`);
  }
  servers.push('Exness-MT5Trial');
  for (let i = 2; i <= 40; i++) {
    servers.push(`Exness-MT5Trial${i}`);
  }
  return servers;
};

// Danh sách server phổ biến theo broker
const BROKER_SERVERS: Record<string, string[]> = {
  'Exness': generateExnessServers(),
  'IC Markets': [
    'ICMarketsSC-MT5',
    'ICMarketsSC-MT5-2',
    'ICMarketsSC-MT5-3',
  ],
  'XM': [
    'XMGlobal-MT5',
    'XMGlobal-MT5-2',
    'XMGlobal-MT5-3',
  ],
  'FBS': [
    'FBS-MT5',
    'FBS-MT5-Real',
    'FBS-MT5-Real-2',
  ]
};

// Loại tài khoản theo broker
const BROKER_ACCOUNT_TYPES: Record<string, string[]> = {
  'Exness': ['Standard', 'StandardCent', 'Pro', 'Raw Spread', 'Zero'],
  'IC Markets': ['Standard', 'Raw Spread', 'cTrader'],
  'XM': ['Micro', 'Standard', 'Ultra Low', 'Zero'],
  'FBS': ['Cent', 'Micro', 'Standard', 'Zero Spread', 'ECN'],
};

// Danh sách các cặp giao dịch (Symbols)
const AVAILABLE_SYMBOLS = ['XAUUSD', 'XAUUSDc', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];

export default function CreateAccountModal({ isOpen, onClose }: CreateAccountModalProps) {
  const { createAccount } = useTradingStore();
  const [formData, setFormData] = useState({
    id: '',
    accountName: '',
    broker: 'Exness',
    platform: 'MT5',
    server: 'Exness-MT5Real36',
    symbol: 'XAUUSDc',
    accountType: 'StandardCent',
    currency: 'USC' as 'USD' | 'USC',
    initialCapital: 2000,
    leverage: 500,
    notes: ''
  });

  if (!isOpen) return null;

  const handleBrokerChange = (broker: string) => {
    const servers = BROKER_SERVERS[broker] || [];
    const types = BROKER_ACCOUNT_TYPES[broker] || ['Standard'];
    setFormData({ 
      ...formData, 
      broker, 
      server: servers[0] || '',
      accountType: types[0] || 'Standard'
    });
  };

  const handleAccountTypeChange = (accountType: string) => {
    const isCent = accountType.toLowerCase().includes('cent') || accountType.toLowerCase().includes('micro');
    setFormData({
      ...formData,
      accountType,
      currency: isCent ? 'USC' : 'USD',
      symbol: isCent ? 'XAUUSDc' : 'XAUUSD'
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id.trim()) {
      alert('Vui lòng nhập mã tài khoản!');
      return;
    }
    if (!formData.accountName.trim()) {
      alert('Vui lòng nhập tên tài khoản!');
      return;
    }
    if (!formData.server.trim()) {
      alert('Vui lòng chọn server!');
      return;
    }
    
    createAccount({
      id: formData.id,
      accountName: formData.accountName,
      broker: formData.broker,
      platform: formData.platform,
      server: formData.server,
      symbol: formData.symbol,
      accountType: formData.accountType,
      currency: formData.currency,
      initialCapital: Number(formData.initialCapital),
      leverage: Number(formData.leverage)
    });

    onClose();
    // Reset form
    setFormData({
      id: '',
      accountName: '',
      broker: 'Exness',
      platform: 'MT5',
      server: 'Exness-MT5Real36',
      symbol: 'XAUUSDc',
      accountType: 'StandardCent',
      currency: 'USC',
      initialCapital: 2000,
      leverage: 500,
      notes: ''
    });
  };

  const availableServers = BROKER_SERVERS[formData.broker] || [];
  const availableTypes = BROKER_ACCOUNT_TYPES[formData.broker] || ['Standard'];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-effect-premium rounded-2xl w-full max-w-lg overflow-hidden border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative">
        
        {/* Top glowing bar */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/1">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-gold" />
            <h3 className="font-extrabold text-white text-base">Tạo Tài Khoản Giao Dịch Mới</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-dark-text-muted hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Tên tài khoản (Name) *</label>
              <input 
                type="text"
                required
                placeholder="e.g., Gold Scalper Pro"
                value={formData.accountName}
                onChange={e => setFormData({ ...formData, accountName: e.target.value })}
                className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">ID Tài Khoản (MT5 ID) *</label>
              <input 
                type="text"
                required
                placeholder="Ví dụ: 160087297"
                value={formData.id}
                onChange={e => setFormData({ ...formData, id: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Broker</label>
              <select 
                value={formData.broker}
                onChange={e => handleBrokerChange(e.target.value)}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer"
              >
                <option value="Exness">Exness</option>
                <option value="IC Markets">IC Markets</option>
                <option value="XM">XM</option>
                <option value="FBS">FBS</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Loại Tài Khoản</label>
              <select 
                value={formData.accountType}
                onChange={e => handleAccountTypeChange(e.target.value)}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer"
              >
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Server máy chủ *</label>
              <div className="relative">
                <select 
                  value={formData.server}
                  onChange={e => setFormData({ ...formData, server: e.target.value })}
                  className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer max-h-36 font-mono"
                >
                  {availableServers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Server className="w-3.5 h-3.5 text-dark-text-muted absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Platform</label>
              <select 
                value={formData.platform}
                onChange={e => setFormData({ ...formData, platform: e.target.value })}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer"
              >
                <option value="MT5">MetaTrader 5</option>
                <option value="MT4" disabled>MetaTrader 4 (Coming)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Cặp Giao Dịch</label>
              <select 
                value={formData.symbol}
                onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer"
              >
                {AVAILABLE_SYMBOLS.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Đơn vị tiền tệ gốc</label>
              <select 
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value as 'USD' | 'USC' })}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer font-bold"
              >
                <option value="USD">USD (Dollar Mỹ)</option>
                <option value="USC">USC (Cent Mỹ - Đổi 1:100)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Số Vốn Ban Đầu (Capital)</label>
              <input 
                type="number"
                required
                min="10"
                value={formData.initialCapital}
                onChange={e => setFormData({ ...formData, initialCapital: Number(e.target.value) })}
                className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono font-bold text-gold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Đòn Bẩy (Leverage)</label>
              <input 
                type="number"
                required
                min="1"
                placeholder="Ví dụ: 500"
                value={formData.leverage}
                onChange={e => setFormData({ ...formData, leverage: Number(e.target.value) })}
                className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent hover:bg-white/5 text-dark-text-muted hover:text-white border border-white/5 py-2.5 px-5 rounded-lg text-sm font-semibold transition-all cursor-pointer active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="bg-gold hover:bg-gold-hover text-dark-bg py-2.5 px-6 rounded-lg text-sm font-extrabold transition-all cursor-pointer gold-glow-hover active:scale-95 flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Tạo tài khoản</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
