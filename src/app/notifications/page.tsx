'use client';

import React, { useEffect } from 'react';
import { useTradingStore } from '../../store/useTradingStore';
import { Bell, ShieldAlert, CheckCircle, Info, ShieldCheck } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useTradingStore();

  useEffect(() => {
    // Tự động đánh dấu tất cả đã đọc sau khi mở trang này
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Risk Notifications</h2>
          <p className="text-xs text-dark-text-muted mt-1">
            Cập nhật cảnh báo rủi ro tự động từ các tài khoản trading GoldQuant AI
          </p>
        </div>
        <button
          onClick={markAllNotificationsRead}
          className="border border-dark-border hover:border-gold hover:text-gold text-white font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Mark all as read</span>
        </button>
      </div>

      {/* Notifications list */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden divide-y divide-dark-border">
        {notifications.length > 0 ? (
          notifications.map((n) => {
            return (
              <div 
                key={n.id} 
                className={`p-5 flex gap-4 transition-colors ${
                  n.read ? 'bg-dark-card/40' : 'bg-gold/5 border-l-2 border-l-gold'
                }`}
              >
                {/* Icon loại thông báo */}
                <div className="flex-shrink-0 mt-0.5">
                  {n.type === 'critical' ? (
                    <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  ) : n.type === 'warning' ? (
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                      <Info className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Nội dung */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">
                      Tài khoản: <span className="font-mono text-gold">{n.accountId}</span>
                    </span>
                    <span className="text-[10px] text-dark-text-muted font-mono">{n.time}</span>
                  </div>
                  <p className="text-sm text-dark-text-light leading-relaxed">
                    {n.message}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-dark-text-muted flex flex-col items-center justify-center">
            <Bell className="w-12 h-12 text-dark-border mb-3" />
            <span className="text-sm">Không có thông báo mới nào.</span>
          </div>
        )}
      </div>

      {/* Box cấu hình cảnh báo */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Thiết lập Ngưỡng Cảnh báo Rủi ro</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Max Drawdown Cảnh Báo (%)</label>
            <input 
              type="number" 
              defaultValue={2}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            />
            <span className="text-[10px] text-dark-text-muted mt-1 block">Gửi thông báo warning khi DD vượt ngưỡng này</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Max Drawdown Dừng Lệnh (%)</label>
            <input 
              type="number" 
              defaultValue={5}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            />
            <span className="text-[10px] text-dark-text-muted mt-1 block">Gửi cảnh báo critical và tạm dừng AI khi DD chạm ngưỡng</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-dark-text-muted uppercase mb-1.5">Kích thước Lệnh Tối Đa (Lots)</label>
            <input 
              type="number" 
              defaultValue={0.05}
              className="w-full bg-dark-input border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-gold focus:outline-none transition-colors"
            />
            <span className="text-[10px] text-dark-text-muted mt-1 block">Cảnh báo nếu AI mở lệnh lớn hơn mức quy định</span>
          </div>
        </div>
      </div>
    </div>
  );
}
