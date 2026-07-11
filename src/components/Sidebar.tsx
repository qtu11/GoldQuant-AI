'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTradingStore } from '../store/useTradingStore';
import { 
  LayoutDashboard, 
  Bell, 
  Calculator, 
  Plus, 
  ShieldAlert, 
  LogOut,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  onCreateAccountClick: () => void;
}

export default function Sidebar({ onCreateAccountClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accounts, activeAccountId, setActiveAccount, notifications } = useTradingStore();
  
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const mainNav = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined
    },
    {
      name: 'Rebate Calculator',
      href: '/rebate',
      icon: Calculator
    }
  ];

  const handleAccountSelect = (id: string) => {
    setActiveAccount(id);
    if (pathname !== '/' && !pathname.startsWith('/account/')) {
      router.push('/');
    }
  };

  return (
    <aside className="w-64 glass-effect !border-y-0 !border-l-0 !rounded-none flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Brand Logo */}
      <div className="p-6 border-b border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center font-bold text-dark-bg text-lg pulse-glow-gold relative group-hover:scale-105 transition-transform">
          <svg className="w-5 h-5 fill-current text-dark-bg" viewBox="0 0 24 24">
            <path d="M13.5 2c-5.246 0-9.5 4.254-9.5 9.5s4.254 9.5 9.5 9.5 9.5-4.254 9.5-9.5-4.254-9.5-9.5-9.5zm.5 14.5c0 .276-.224.5-.5.5s-.5-.224-.5-.5v-1h1v1zm0-2h-1v-4.5c0-.276.224-.5.5-.5h1c.276 0 .5.224.5.5v4c0 .276-.224.5-.5.5zm1.5-7.5c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5.672-1.5 1.5-1.5 1.5.672 1.5 1.5z" />
          </svg>
        </div>
        <div>
          <h1 className="font-black text-base tracking-wider leading-none">
            <span className="gold-gradient-text">GoldQuant AI</span>
          </h1>
          <span className="text-[9px] text-gold font-bold tracking-widest uppercase mt-1 block">Risk Manager Pro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href && (item.href !== '/' || activeAccountId === null);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (item.name === 'Dashboard') {
                    setActiveAccount(null);
                  }
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 border-l-2 active:scale-98 ${
                  isActive 
                    ? 'bg-gradient-to-r from-gold/15 to-gold/2 text-gold border-l-gold shadow-[0_4px_12px_rgba(245,182,27,0.05)] border-y border-r border-gold/10' 
                    : 'text-dark-text-muted hover:text-white hover:bg-white/5 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`w-4.5 h-4.5 transition-colors ${isActive ? 'text-gold' : 'text-dark-text-muted'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full pulse-glow-red animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* TRADING ACCOUNTS */}
        <div className="pt-6 mt-6 border-t border-white/5">
          <div className="flex items-center justify-between px-3 mb-3">
            <span className="text-[10px] font-bold tracking-wider text-dark-text-muted uppercase">
              Trading Accounts
            </span>
            <span className="text-[9px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded border border-gold/10 font-mono">
              {accounts.length.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="space-y-1">
            {accounts.map((acc) => {
              const isActive = activeAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => handleAccountSelect(acc.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-300 text-left border-l-2 active:scale-98 ${
                    isActive 
                      ? 'bg-white/5 border-l-gold border-y border-r border-white/5 text-white font-bold shadow-[0_4px_12px_rgba(0,0,0,0.15)]' 
                      : 'text-dark-text-muted hover:text-white hover:bg-white/3 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      acc.status === 'Healthy' 
                        ? 'bg-emerald-500 pulse-glow-green' 
                        : acc.status === 'Moderate' 
                          ? 'bg-amber-500' 
                          : 'bg-red-500'
                    }`} />
                    <span className="font-mono text-xs truncate">{acc.id}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded font-mono ${
                      acc.riskScore >= 90 
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/10' 
                        : acc.riskScore >= 75 
                          ? 'text-emerald-400 bg-emerald-400/10' 
                          : 'text-amber-500 bg-amber-500/10 border border-amber-500/10'
                    }`}>
                      {acc.riskScore}
                    </span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-gold" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <button
          onClick={onCreateAccountClick}
          className="w-full bg-gold hover:bg-gold-hover text-dark-bg font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm transition-all cursor-pointer gold-glow-hover active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Create Account</span>
        </button>

        <Link
          href="/admin"
          className="w-full border border-gold/20 hover:border-gold hover:bg-gold/5 text-gold font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-xs transition-all active:scale-98"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Switch to Admin Portal</span>
        </Link>

        <div className="flex items-center justify-between pt-2 px-1 text-[10px] text-dark-text-muted font-mono">
          <span>v1.1.0</span>
          <button 
            onClick={() => alert('Đang đăng xuất...')}
            className="flex items-center gap-1 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
