'use client';

import React, { useState } from 'react';
import { Calculator, DollarSign, RefreshCw, Award, Info } from 'lucide-react';

export default function RebateCalculatorPage() {
  const [broker, setBroker] = useState('Exness');
  const [accountType, setAccountType] = useState('Standard');
  const [lots, setLots] = useState<number>(10);
  const [rebateRate, setRebateRate] = useState<number>(3.5); // USD per Lot

  // Các cấu hình broker mẫu
  const brokerPresets: Record<string, Record<string, number>> = {
    'Exness': {
      'Standard (XAUUSD)': 3.5,
      'Pro (XAUUSD)': 1.8,
      'Raw Spread (XAUUSD)': 2.5,
    },
    'IC Markets': {
      'Standard (No commission)': 4.0,
      'Raw Spread (Commission)': 1.5,
    },
    'XM': {
      'Standard': 5.0,
      'Ultra Low': 2.0,
    }
  };

  const handleBrokerChange = (e: string) => {
    setBroker(e);
    const firstKey = Object.keys(brokerPresets[e])[0];
    setAccountType(firstKey);
    setRebateRate(brokerPresets[e][firstKey]);
  };

  const handleAccountTypeChange = (e: string) => {
    setAccountType(e);
    setRebateRate(brokerPresets[broker][e]);
  };

  // Tính toán rebate
  const dailyRebate = lots * rebateRate;
  const weeklyRebate = dailyRebate * 5; // 5 ngày giao dịch/tuần
  const monthlyRebate = dailyRebate * 22; // 22 ngày giao dịch/tháng
  const yearlyRebate = dailyRebate * 252; // 252 ngày giao dịch/năm

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Rebate Calculator</h2>
        <p className="text-xs text-dark-text-muted mt-1">
          Tính toán số tiền hoàn phí (Rebate) tự động dựa trên khối lượng giao dịch lot vàng XAUUSD
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calculator Form */}
        <div className="lg:col-span-1 bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2 pb-3 border-b border-dark-border/40">
            <Calculator className="w-5 h-5 text-gold" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Thông Số Tính Phí</h4>
          </div>

          {/* Broker */}
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Broker</label>
            <select
              value={broker}
              onChange={e => handleBrokerChange(e.target.value)}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            >
              <option value="Exness">Exness</option>
              <option value="IC Markets">IC Markets</option>
              <option value="XM">XM</option>
            </select>
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Loại Tài Khoản</label>
            <select
              value={accountType}
              onChange={e => handleAccountTypeChange(e.target.value)}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            >
              {Object.keys(brokerPresets[broker]).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Volume lots */}
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Khối lượng giao dịch (Lots)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={lots}
              onChange={e => setLots(Number(e.target.value))}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            />
          </div>

          {/* Rebate rate per lot */}
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Tỷ lệ hoàn trả ($/Lot)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                value={rebateRate}
                onChange={e => setRebateRate(Number(e.target.value))}
                className="w-full bg-dark-input border border-dark-border rounded-lg pl-8 pr-3 py-2.5 text-sm text-white focus:border-gold focus:outline-none transition-colors font-mono"
              />
              <DollarSign className="w-4 h-4 text-dark-text-muted absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* Results display */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main big display */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 flex items-center justify-between gold-glow">
            <div className="space-y-1">
              <span className="text-xs font-bold text-dark-text-muted uppercase tracking-wider block">Ước tính Rebate hàng tháng</span>
              <span className="text-4xl font-black text-gold font-mono leading-none block">
                ${monthlyRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-dark-text-muted block mt-1">
                Dựa trên {lots} lots giao dịch hàng ngày với tỷ lệ hoàn trả ${rebateRate}/lot.
              </span>
            </div>
            <div className="p-4 bg-gold/10 rounded-2xl text-gold hidden sm:block">
              <Award className="w-10 h-10" />
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Daily */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider block">Hàng Ngày (1 ngày)</span>
              <div className="mt-4">
                <span className="text-2xl font-black text-white font-mono leading-none block">
                  ${dailyRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-dark-text-muted mt-1 block">Tương đương {lots} lots</span>
              </div>
            </div>

            {/* Weekly */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider block">Hàng Tuần (5 ngày)</span>
              <div className="mt-4">
                <span className="text-2xl font-black text-white font-mono leading-none block">
                  ${weeklyRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-dark-text-muted mt-1 block">Tương đương {lots * 5} lots</span>
              </div>
            </div>

            {/* Yearly */}
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider block">Hàng Năm (252 ngày)</span>
              <div className="mt-4">
                <span className="text-2xl font-black text-white font-mono leading-none block">
                  ${yearlyRebate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-dark-text-muted mt-1 block">Tương đương {lots * 252} lots</span>
              </div>
            </div>
          </div>

          {/* Info block */}
          <div className="bg-dark-card/50 border border-dark-border/40 rounded-xl p-4 flex gap-3 text-xs text-dark-text-muted">
            <Info className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Lưu ý:</strong> Mức tính toán trên chỉ mang tính chất ước tính dựa trên điều kiện thị trường mở cửa liên tục và khối lượng giao dịch ổn định. Phí rebate thực tế có thể thay đổi tùy thuộc vào chênh lệch (spread) thực tế, thời điểm đóng mở lệnh của Broker và các loại tài sản không đồng nhất.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
