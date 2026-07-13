'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTradingStore } from '../store/useTradingStore';
import { listKnownOwners } from '../utils/ownerStats';
import {
  convertAmountBetweenCurrencies,
  defaultSymbolForCurrency,
  isCentAccountType,
  type AccountCurrency,
} from '../utils/currency';
import {
  X,
  Zap,
  User,
  AlertCircle,
  Hash,
  Building2,
  Server,
  LineChart,
  Wallet,
  Link2,
} from 'lucide-react';
import Link from 'next/link';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prefill + khóa chủ sở hữu (khi tạo từ dashboard 1 người) */
  defaultOwnerName?: string;
  lockOwner?: boolean;
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

export default function CreateAccountModal({
  isOpen,
  onClose,
  defaultOwnerName = '',
  lockOwner = false,
}: CreateAccountModalProps) {
  const { createAccount, accounts, owners } = useTradingStore();
  const knownOwners = useMemo(
    () => listKnownOwners(accounts, owners),
    [accounts, owners]
  );
  const [formData, setFormData] = useState({
    id: '',
    accountName: '',
    ownerName: defaultOwnerName || '',
    broker: 'Exness',
    platform: 'MT5',
    server: 'Exness-MT5Real36',
    symbol: 'XAUUSDc',
    accountType: 'StandardCent',
    currency: 'USC' as 'USD' | 'USC',
    initialCapital: 2000,
    leverage: 500,
    notes: '',
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      ownerName: defaultOwnerName || prev.ownerName || knownOwners[0] || '',
    }));
  }, [isOpen, defaultOwnerName, knownOwners]);

  // Khóa scroll body khi mở modal
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const noOwners = knownOwners.length === 0;

  const applyCurrencyChange = (
    prev: typeof formData,
    nextCurrency: AccountCurrency,
    patch: Partial<typeof formData>
  ) => {
    const prevCur = prev.currency as AccountCurrency;
    const capital =
      prevCur !== nextCurrency
        ? convertAmountBetweenCurrencies(
            Number(prev.initialCapital) || 0,
            prevCur,
            nextCurrency
          )
        : prev.initialCapital;
    return {
      ...prev,
      ...patch,
      currency: nextCurrency,
      initialCapital: capital,
      symbol:
        patch.symbol ??
        (prevCur !== nextCurrency
          ? defaultSymbolForCurrency(nextCurrency)
          : prev.symbol),
    };
  };

  const handleBrokerChange = (broker: string) => {
    const servers = BROKER_SERVERS[broker] || [];
    const types = BROKER_ACCOUNT_TYPES[broker] || ['Standard'];
    const accountType = types[0] || 'Standard';
    const isCent = isCentAccountType(accountType);
    const currency: AccountCurrency = isCent ? 'USC' : 'USD';
    setFormData((prev) =>
      applyCurrencyChange(prev, currency, {
        broker,
        server: servers[0] || '',
        accountType,
        symbol: defaultSymbolForCurrency(currency),
      })
    );
  };

  const handleAccountTypeChange = (accountType: string) => {
    // Chỉ "Cent" → USC; Micro (XM/FBS) không tự đổi currency
    const isCent = isCentAccountType(accountType);
    const currency: AccountCurrency = isCent ? 'USC' : 'USD';
    setFormData((prev) =>
      applyCurrencyChange(prev, currency, {
        accountType,
        symbol: defaultSymbolForCurrency(currency),
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noOwners) {
      alert('Hãy tạo Chủ sở hữu trước (Owners → Tạo chủ sở hữu).');
      return;
    }
    if (!formData.ownerName.trim()) {
      alert('Phải chọn Chủ sở hữu cho TK MT5!');
      return;
    }
    if (!formData.id.trim()) {
      alert('Vui lòng nhập mã tài khoản MT5!');
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

    createAccount({
      id: formData.id.trim(),
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
    })
      .then(() => {
        onClose();
        setFormData({
          id: '',
          accountName: '',
          ownerName: defaultOwnerName || knownOwners[0] || '',
          broker: 'Exness',
          platform: 'MT5',
          server: 'Exness-MT5Real36',
          symbol: 'XAUUSDc',
          accountType: 'StandardCent',
          currency: 'USC' as 'USD' | 'USC',
          initialCapital: 2000,
          leverage: 500,
          notes: '',
        });
      })
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : 'Không thể tạo tài khoản.');
      });
  };

  const availableServers = BROKER_SERVERS[formData.broker] || [];
  const availableTypes = BROKER_ACCOUNT_TYPES[formData.broker] || ['Standard'];

  const labelClass =
    'block text-[11px] font-medium text-[#A1A1A6] mb-1.5 tracking-tight';

  // Portal lên body — tránh TopBar sticky / Framer Motion che modal
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-2xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
    >
      <div className="liquid-modal-panel relative animate-in fade-in zoom-in-95 duration-300 w-full">
        {/* Soft top highlight */}
        <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-10 pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-neon-cyan/30 to-neon-purple/30 border border-white/15 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-neon-cyan stroke-[1.75]" />
              </div>
              <h3
                id="create-account-title"
                className="font-display text-lg font-semibold text-white tracking-tight"
              >
                Liên kết TK MT5
              </h3>
            </div>
            <p className="text-[12px] text-[#8E8E93] pl-[2.85rem] leading-relaxed">
              Nhập thông tin từ MetaTrader để theo dõi rủi ro &amp; PnL.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 border border-white/10 text-[#A1A1A6] hover:text-white hover:bg-white/12 flex items-center justify-center pressable flex-shrink-0 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="liquid-modal-body px-6 pb-2 space-y-4">
            {noOwners && (
              <div className="rounded-2xl border border-neon-yellow/25 bg-neon-yellow/10 px-4 py-3.5 flex gap-3 text-[13px] text-neon-yellow">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 stroke-[1.75]" />
                <div>
                  <p className="font-semibold">Chưa có chủ sở hữu</p>
                  <p className="mt-1 text-neon-yellow/75 text-[12px] leading-relaxed">
                    Tạo người trước, rồi mới gắn TK MT5.
                  </p>
                  <Link
                    href="/owners"
                    onClick={onClose}
                    className="inline-flex mt-2 text-white font-semibold text-[12px] underline underline-offset-2"
                  >
                    Mở Owners →
                  </Link>
                </div>
              </div>
            )}

            {/* Owner */}
            <div className="liquid-section">
              <div className="liquid-section-title">
                <User className="w-3.5 h-3.5 stroke-[1.75]" />
                Chủ sở hữu
              </div>
              {lockOwner || defaultOwnerName ? (
                <div className="owner-lock-pill">
                  <div className="w-8 h-8 rounded-full bg-neon-purple/25 border border-neon-purple/35 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-neon-purple stroke-[1.75]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#8E8E93] font-medium">Gắn vào dashboard</p>
                    <p className="text-[15px] font-semibold text-white truncate">
                      {formData.ownerName}
                    </p>
                  </div>
                </div>
              ) : (
                <select
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="liquid-field"
                  disabled={noOwners}
                >
                  <option value="">Chọn chủ sở hữu…</option>
                  {knownOwners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Identity */}
            <div className="liquid-section">
              <div className="liquid-section-title">
                <Hash className="w-3.5 h-3.5 stroke-[1.75]" />
                Định danh
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>Tên tài khoản</label>
                  <input
                    type="text"
                    required
                    placeholder="Gold Scalper Pro"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="liquid-field"
                    disabled={noOwners}
                  />
                </div>
                <div>
                  <label className={labelClass}>MT5 Login ID</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="160087297"
                    value={formData.id}
                    onChange={(e) =>
                      setFormData({ ...formData, id: e.target.value.replace(/\D/g, '') })
                    }
                    className="liquid-field font-mono tracking-wide"
                    disabled={noOwners}
                  />
                </div>
              </div>
            </div>

            {/* Broker connection */}
            <div className="liquid-section">
              <div className="liquid-section-title">
                <Building2 className="w-3.5 h-3.5 stroke-[1.75]" />
                Kết nối broker
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className={labelClass}>Broker</label>
                  <select
                    value={formData.broker}
                    onChange={(e) => handleBrokerChange(e.target.value)}
                    className="liquid-field"
                  >
                    <option value="Exness">Exness</option>
                    <option value="IC Markets">IC Markets</option>
                    <option value="XM">XM</option>
                    <option value="FBS">FBS</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Loại tài khoản</label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => handleAccountTypeChange(e.target.value)}
                    className="liquid-field"
                  >
                    {availableTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Server</label>
                  <div className="relative">
                    <Server className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={formData.server}
                      onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                      className="liquid-field font-mono text-[12px] !pl-9"
                    >
                      {availableServers.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="liquid-field"
                  >
                    <option value="MT5">MetaTrader 5</option>
                    <option value="MT4" disabled>
                      MetaTrader 4
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Trading params */}
            <div className="liquid-section">
              <div className="liquid-section-title">
                <LineChart className="w-3.5 h-3.5 stroke-[1.75]" />
                Giao dịch &amp; vốn
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className={labelClass}>Cặp</label>
                  <select
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="liquid-field"
                  >
                    {AVAILABLE_SYMBOLS.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tiền tệ</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => {
                      const currency = e.target.value as AccountCurrency;
                      setFormData((prev) =>
                        applyCurrencyChange(prev, currency, {
                          symbol: defaultSymbolForCurrency(currency),
                        })
                      );
                    }}
                    className="liquid-field"
                  >
                    <option value="USD">USD</option>
                    <option value="USC">USC</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Vốn ban đầu</label>
                  <div className="relative">
                    <Wallet className="w-3.5 h-3.5 text-gold absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      required
                      min="10"
                      value={formData.initialCapital}
                      onChange={(e) =>
                        setFormData({ ...formData, initialCapital: Number(e.target.value) })
                      }
                      className="liquid-field font-mono font-semibold text-gold !pl-9"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Đòn bẩy</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.leverage}
                    onChange={(e) =>
                      setFormData({ ...formData, leverage: Number(e.target.value) })
                    }
                    className="liquid-field font-mono"
                  />
                </div>
              </div>
              {formData.currency === 'USC' && (
                <p className="text-[11px] text-[#8E8E93] mt-2.5 leading-relaxed">
                  Cent account · 100 USC = 1 USD · vốn 2000 USC ≈ $20
                </p>
              )}
            </div>
          </div>

          <div className="liquid-modal-footer flex items-center justify-between gap-3 px-6 py-4">
            <p className="text-[11px] text-[#636366] hidden sm:block max-w-[200px] leading-snug">
              Có thể upload history sau khi tạo.
            </p>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-5 rounded-full text-[13px] font-semibold text-[#E5E5EA] bg-white/8 border border-white/12 hover:bg-white/12 pressable transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={noOwners}
                className="h-11 px-6 rounded-full text-[13px] font-semibold text-[#050507] bg-gradient-to-r from-[#4CC9FF] to-[#8A7DFF] hover:brightness-110 pressable disabled:opacity-40 shadow-[0_8px_28px_rgba(76,201,255,0.28)] flex items-center gap-1.5 transition-[filter]"
              >
                <Zap className="w-4 h-4 fill-current" />
                Tạo TK MT5
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
