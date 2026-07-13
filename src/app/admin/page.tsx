'use client';

import React, { useState } from 'react';
import { useTradingStore } from '../../store/useTradingStore';
import { Shield, Users, Settings, Plus, Edit, Trash2 } from 'lucide-react';
import CreateAccountModal from '../../components/CreateAccountModal';

export default function AdminPortalPage() {
  const { accounts, setActiveAccount } = useTradingStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'settings'>('accounts');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-gold" />
            <span>Admin Portal</span>
          </h2>
          <p className="text-xs text-dark-text-muted mt-1">
            Quản trị hệ thống, cấu hình tham số AI Risk Engine và giám sát tài khoản.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn-neon py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Create Account</span>
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-4 border-b border-dark-border/40 pb-0.5">
        <button
          onClick={() => setActiveSubTab('accounts')}
          className={`pb-3 text-xs font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeSubTab === 'accounts'
              ? 'border-gold text-gold'
              : 'border-transparent text-dark-text-muted hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Quản lý Tài Khoản ({accounts.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-3 text-xs font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeSubTab === 'settings'
              ? 'border-gold text-gold'
              : 'border-transparent text-dark-text-muted hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Cấu hình Tham số AI</span>
        </button>
      </div>

      {activeSubTab === 'accounts' ? (
        <div className="neon-card !rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="bg-dark-bg/40 border-b border-dark-border text-[10px] font-bold text-dark-text-muted tracking-wider uppercase">
                  <th className="py-3.5 px-4">Account ID</th>
                  <th className="py-3.5 px-4">Broker</th>
                  <th className="py-3.5 px-4">Platform</th>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-right">Initial Capital</th>
                  <th className="py-3.5 px-4 text-right">Current Equity</th>
                  <th className="py-3.5 px-4 text-center">Risk Score</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-dark-bg/20 transition-all">
                    <td className="py-3.5 px-4 text-white font-bold">{acc.id}</td>
                    <td className="py-3.5 px-4 text-dark-text-muted">{acc.broker}</td>
                    <td className="py-3.5 px-4 text-dark-text-muted">{acc.platform}</td>
                    <td className="py-3.5 px-4 text-white">{acc.symbol}</td>
                    <td className="py-3.5 px-4 text-right text-dark-text-light">
                      {acc.currency === 'USC'
                        ? `${acc.initialCapital.toLocaleString()} USC`
                        : `$${acc.initialCapital.toLocaleString()}`}
                    </td>
                    <td className="py-3.5 px-4 text-right text-gold font-bold">
                      {acc.currency === 'USC'
                        ? `${acc.currentEquity.toLocaleString()} USC`
                        : `$${acc.currentEquity.toLocaleString()}`}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded font-black ${
                        acc.riskScore < 30
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : acc.riskScore < 60
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                      }`}>
                        {acc.riskScore}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        acc.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {acc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => {
                            setActiveAccount(acc.id);
                            window.location.href = '/';
                          }}
                          className="px-2 py-1 bg-gold/10 hover:bg-gold/20 text-gold rounded font-bold text-[10px] transition-all"
                        >
                          Chi tiết
                        </button>
                        <button className="p-1 hover:text-white text-dark-text-muted transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 hover:text-red-400 text-dark-text-muted transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cấu hình chung */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Cấu Hình Rủi Ro Mặc Định</h4>
            
            <div>
              <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Trọng số Max Drawdown (AI Engine)</label>
              <input type="range" min="1" max="100" defaultValue="40" className="w-full accent-gold" />
              <div className="flex justify-between text-[10px] text-dark-text-muted mt-1">
                <span>Ưu tiên Lợi nhuận</span>
                <span>Ưu tiên Bảo toàn vốn</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Tần suất Cập nhật Dữ liệu</label>
              <select className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none transition-colors">
                <option>Realtime (Mỗi 5 giây)</option>
                <option>Mỗi 1 phút</option>
                <option>Mỗi 5 phút</option>
                <option>Chỉ cập nhật thủ công (Manual)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Khóa tài khoản khi chạm Drawdown</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="lock-account" defaultChecked className="w-4 h-4 accent-gold" />
                <label htmlFor="lock-account" className="text-xs text-dark-text-light">Tự động tạm ngưng giao dịch nếu tài khoản vượt quá 5% DD</label>
              </div>
            </div>

            <button className="w-full bg-gold hover:bg-gold-hover text-dark-bg font-bold py-2 rounded-lg text-xs transition-all gold-glow">
              Lưu thay đổi cấu hình
            </button>
          </div>

          {/* Lịch sử nhật ký hệ thống */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Nhật Ký Hệ Thống (System Logs)</h4>
            <div className="space-y-2.5 font-mono text-[11px] text-dark-text-muted max-h-60 overflow-y-auto pr-1">
              <div className="flex gap-2">
                <span className="text-gold flex-shrink-0">[2026-07-11 18:45:01]</span>
                <span className="text-white">Admin portal accessed by user</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold flex-shrink-0">[2026-07-11 18:41:20]</span>
                <span>Zustand state initialized with 3 default trading accounts</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold flex-shrink-0">[2026-07-11 18:32:15]</span>
                <span>Connected to Exness MT5 server bridge successfully</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gold flex-shrink-0">[2026-07-11 18:30:00]</span>
                <span>Risk core module compiled in 142ms</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <CreateAccountModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
