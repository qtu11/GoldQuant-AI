'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTradingStore, TradingAccount } from '../store/useTradingStore';
import { listKnownOwners } from '../utils/ownerStats';
import {
  convertAmountBetweenCurrencies,
  defaultSymbolForCurrency,
  isCentAccountType,
  type AccountCurrency,
} from '../utils/currency';
import { X, Server, Trash2, Save, AlertTriangle, User } from 'lucide-react';

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
  const { editAccount, deleteAccount, accounts, owners } = useTradingStore();
  const knownOwners = useMemo(
    () => listKnownOwners(accounts, owners),
    [accounts, owners]
  );
  const [formData, setFormData] = useState({
    accountName: '',
    ownerName: '',
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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (account) {
      setFormData({
        accountName: account.accountName || '',
        ownerName: account.ownerName || '',
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

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !account || !mounted) return null;

  const handleBrokerChange = (broker: string) => {
    const servers = BROKER_SERVERS[broker] || [];
    const types = BROKER_ACCOUNT_TYPES[broker] || ['Standard'];
    const accountType = types[0] || 'Standard';
    const isCent = isCentAccountType(accountType);
    const currency: AccountCurrency = isCent ? 'USC' : 'USD';
    setFormData({
      ...formData,
      broker,
      server: servers[0] || '',
      accountType,
      currency,
      symbol: defaultSymbolForCurrency(currency),
      initialCapital: convertAmountBetweenCurrencies(
        formData.initialCapital,
        formData.currency,
        currency
      ),
    });
  };

  const handleAccountTypeChange = (accountType: string) => {
    const isCent = isCentAccountType(accountType);
    const currency: AccountCurrency = isCent ? 'USC' : 'USD';
    setFormData({
      ...formData,
      accountType,
      currency,
      symbol: defaultSymbolForCurrency(currency),
      initialCapital: convertAmountBetweenCurrencies(
        formData.initialCapital,
        formData.currency,
        currency
      ),
    });
  };

  const handleCurrencyChange = (currency: AccountCurrency) => {
    if (currency === formData.currency) return;
    setFormData({
      ...formData,
      currency,
      initialCapital: convertAmountBetweenCurrencies(
        formData.initialCapital,
        formData.currency,
        currency
      ),
      symbol: defaultSymbolForCurrency(currency),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountName.trim()) {
      alert('Vui lòng nhập tên tài khoản!');
      return;
    }
    if (!formData.ownerName.trim()) {
      alert('Phải chọn Chủ sở hữu!');
      return;
    }
    if (
      knownOwners.length > 0 &&
      !knownOwners.some(
        (o) => o.toLowerCase() === formData.ownerName.trim().toLowerCase()
      )
    ) {
      alert('Chủ sở hữu phải nằm trong danh sách đã đăng ký (Owners).');
      return;
    }
    const capital = Number(formData.initialCapital);
    const leverage = Number(formData.leverage);
    if (!Number.isFinite(capital) || capital < 0) {
      alert('Số vốn ban đầu không hợp lệ!');
      return;
    }
    if (!Number.isFinite(leverage) || leverage < 1) {
      alert('Đòn bẩy phải ≥ 1!');
      return;
    }

    void editAccount(account.id, {
      accountName: formData.accountName.trim(),
      ownerName: formData.ownerName.trim(),
      broker: formData.broker,
      platform: formData.platform,
      server: formData.server,
      symbol: formData.symbol,
      accountType: formData.accountType,
      currency: formData.currency,
      initialCapital: capital,
      leverage,
    }).catch((err: unknown) => {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật tài khoản.');
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

  const fieldClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-dark-text-muted/60 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors';
  const selectClass =
    'w-full bg-[#161826] border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors cursor-pointer';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-2xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-account-title"
    >
      <div className="liquid-modal-panel relative animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-80 z-10 pointer-events-none" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-5 h-5 text-gold flex-shrink-0" />
            <h3 id="edit-account-title" className="font-display font-semibold text-white text-base truncate">
              Cấu Hình Tài Khoản{' '}
              <span className="font-mono text-gold ml-1 text-sm bg-gold/10 px-2.5 py-0.5 rounded-full">
                {account.id}
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-dark-text-muted hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="liquid-modal-body p-5 space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                Tên tài khoản (Account Name) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Gold Scalper Pro"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                Chủ sở hữu *
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-dark-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className={`${selectClass} pl-9`}
                >
                  <option value="">— Chọn chủ sở hữu —</option>
                  {knownOwners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              {knownOwners.length === 0 && (
                <p className="text-[10px] text-neon-yellow mt-1.5">
                  Chưa có chủ sở hữu — vào Owners để tạo trước.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Broker
                </label>
                <select
                  value={formData.broker}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="Exness">Exness</option>
                  <option value="IC Markets">IC Markets</option>
                  <option value="XM">XM</option>
                  <option value="FBS">FBS</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Loại Tài Khoản
                </label>
                <select
                  value={formData.accountType}
                  onChange={(e) => handleAccountTypeChange(e.target.value)}
                  className={selectClass}
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Server máy chủ *
                </label>
                <select
                  value={formData.server}
                  onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                  className={`${selectClass} font-mono`}
                >
                  {availableServers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Đòn Bẩy (Leverage)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.leverage}
                  onChange={(e) => setFormData({ ...formData, leverage: Number(e.target.value) })}
                  className={`${fieldClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Cặp Giao Dịch
                </label>
                <select
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className={selectClass}
                >
                  {AVAILABLE_SYMBOLS.map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                  Đơn vị gốc
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value as AccountCurrency)}
                  className={`${selectClass} font-bold`}
                >
                  <option value="USD">USD (Dollar)</option>
                  <option value="USC">USC (Cent Mỹ)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-dark-text-muted uppercase tracking-wider mb-1.5">
                Số Vốn Ban Đầu (Initial Capital)
              </label>
              <input
                type="number"
                required
                min="10"
                value={formData.initialCapital}
                onChange={(e) => setFormData({ ...formData, initialCapital: Number(e.target.value) })}
                className={`${fieldClass} font-mono font-bold text-gold`}
              />
            </div>

            {confirmDelete && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Xác nhận xóa tài khoản?</p>
                  <p className="mt-1 opacity-80 leading-normal">
                    Mọi lịch sử giao dịch và dữ liệu phân tích sẽ bị xóa vĩnh viễn khỏi Firebase. Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="liquid-modal-footer flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
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
                className="btn-glass py-2.5 px-4 text-xs font-semibold pressable"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-neon py-2.5 px-5 text-xs font-semibold pressable flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
