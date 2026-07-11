'use client';

import React, { useState, useEffect } from 'react';
import { useTradingStore, TradingAccount } from '../store/useTradingStore';
import { X, Server, Trash2, Save, AlertTriangle } from 'lucide-react';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: TradingAccount | null;
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

const BROKER_ACCOUNT_TYPES: Record<string, string[]> = {
  'Exness': ['Standard', 'StandardCent', 'Pro', 'Raw Spread', 'Zero'],
  'IC Markets': ['Standard', 'Raw Spread', 'cTrader'],
  'XM': ['Micro', 'Standard', 'Ultra Low', 'Zero'],
  'FBS': ['Cent', 'Micro', 'Standard', 'Zero Spread', 'ECN'],
};

const AVAILABLE_SYMBOLS = ['XAUUSD', 'XAUUSDc', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY'];

export default function EditAccountModal({ isOpen, onClose, account }: EditAccountModalProps) {
  const { editAccount, deleteAccount } = useTradingStore();
  const [formData, setFormData] = useState({
    accountName: '',
    broker: 'Exness',
    platform: 'MT5',
    server: 'Exness-MT5Real36',
    symbol: 'XAUUSD',
    accountType: 'Standard',
    currency: 'USD' as 'USD' | 'USC',
    initialCapital: 2000,
    leverage: 500
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (account) {
      setFormData({
        accountName: account.accountName || '',
        broker: account.broker,
        platform: account.platform,
        server: account.server,
        symbol: account.symbol,
        accountType: account.accountType,
        currency: account.currency,
        initialCapital: account.initialCapital,
        leverage: account.leverage || 500
      });
      setConfirmDelete(false);
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

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
    if (!formData.accountName.trim()) {
      alert('Vui lòng nhập tên tài khoản!');
      return;
    }
    
    editAccount(account.id, {
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
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteAccount(account.id);
    onClose();
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
            <Server className="w-5 h-5 text-gold" />
            <h3 className="font-extrabold text-white text-base">Cấu Hình Tài Khoản <span className="font-mono text-gold ml-1 text-sm bg-gold/10 px-2 py-0.5 rounded">{account.id}</span></h3>
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
          <div>
            <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Tên tài khoản (Account Name) *</label>
            <input 
              type="text"
              required
              placeholder="e.g., Gold Scalper Pro"
              value={formData.accountName}
              onChange={e => setFormData({ ...formData, accountName: e.target.value })}
              className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors"
            />
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
                  className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer font-mono"
                >
                  {availableServers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Đòn Bẩy (Leverage)</label>
              <input 
                type="number"
                required
                min="1"
                value={formData.leverage}
                onChange={e => setFormData({ ...formData, leverage: Number(e.target.value) })}
                className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono"
              />
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
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Đơn vị gốc</label>
              <select 
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value as 'USD' | 'USC' })}
                className="w-full bg-[#161826] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors cursor-pointer font-bold"
              >
                <option value="USD">USD (Dollar)</option>
                <option value="USC">USC (Cent Cent)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">Số Vốn Ban Đầu (Initial Capital)</label>
            <input 
              type="number"
              required
              min="10"
              value={formData.initialCapital}
              onChange={e => setFormData({ ...formData, initialCapital: Number(e.target.value) })}
              className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors font-mono font-bold text-gold"
            />
          </div>

          {/* Delete Warning Box */}
          {confirmDelete && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-bold">Xác nhận xóa tài khoản?</p>
                <p className="mt-1 opacity-80 leading-normal">Mọi lịch sử giao dịch và dữ liệu phân tích sẽ bị xóa vĩnh viễn khỏi Firebase. Hành động này không thể hoàn tác.</p>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleDelete}
              className={`py-2.5 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                confirmDelete 
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md' 
                  : 'bg-transparent hover:bg-red-500/10 text-red-400 border-red-500/20'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{confirmDelete ? 'Tôi muốn xóa vĩnh viễn' : 'Xóa tài khoản'}</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-transparent hover:bg-white/5 text-dark-text-muted hover:text-white border border-white/5 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="bg-gold hover:bg-gold-hover text-dark-bg py-2.5 px-5 rounded-lg text-xs font-extrabold transition-all cursor-pointer gold-glow-hover active:scale-95 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
