'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTradingStore } from '../store/useTradingStore';
import { useAuthStore } from '../store/useAuthStore';
import { groupAccountsByOwner } from '../utils/ownerStats';
import {
  LayoutDashboard,
  Bell,
  Calculator,
  Plus,
  ShieldAlert,
  LogOut,
  Wrench,
  CalendarDays,
  Users,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

interface SidebarProps {
  onCreateAccountClick: () => void;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

export default function Sidebar({
  onCreateAccountClick,
  expanded: expandedProp,
  onExpandedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accounts, owners, activeAccountId, setActiveAccount, notifications } =
    useTradingStore();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (v: boolean) => {
    onExpandedChange?.(v);
    setInternalExpanded(v);
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const ownerGroups = useMemo(
    () =>
      groupAccountsByOwner(accounts, {
        registeredOwners: owners,
        hideUnassigned: false,
      }).filter((g) => !g.unassigned || g.accountCount > 0),
    [accounts, owners]
  );

  const mainNav = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, short: 'Home' },
    { name: 'Owners / PnL', href: '/owners', icon: Users, short: 'Owners' },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      short: 'Alerts',
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { name: 'Trading Tools', href: '/tools', icon: Wrench, short: 'Tools' },
    { name: 'News Calendar', href: '/news', icon: CalendarDays, short: 'News' },
    { name: 'Rebate Calculator', href: '/rebate', icon: Calculator, short: 'Rebate' },
  ];

  const handleAccountSelect = (id: string) => {
    setActiveAccount(id);
    if (pathname !== '/' && !pathname.startsWith('/account/')) {
      router.push('/');
    }
  };

  return (
    <>
      {/* Mobile bottom glass dock */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 sidebar-neon px-2 py-2 flex items-center justify-around gap-1">
        {mainNav.slice(0, 5).map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/' && activeAccountId === null
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                if (item.name === 'Dashboard') setActiveAccount(null);
              }}
              className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
                isActive ? 'nav-liquid-active' : 'nav-liquid-idle'
              }`}
              title={item.name}
            >
              <item.icon className="w-[18px] h-[18px] stroke-[1.75]" />
              {item.badge ? (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-neon-pink text-[8px] font-bold text-dark-bg flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onCreateAccountClick}
          className="w-12 h-12 rounded-full btn-neon flex items-center justify-center pressable"
          title="Create Account"
        >
          <Plus className="w-[18px] h-[18px] stroke-[2]" />
        </button>
      </nav>

      {/* Desktop floating glass rail */}
      <aside
        className={`hidden lg:flex flex-col fixed z-40 transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
          expanded ? 'w-[248px]' : 'w-[72px]'
        } left-4 top-4 bottom-4 sidebar-neon`}
      >
        {/* Brand */}
        <div
          className={`p-3 flex items-center border-b border-white/5 ${
            expanded ? 'gap-3' : 'flex-col gap-2'
          }`}
        >
          <Link
            href="/"
            onClick={() => setActiveAccount(null)}
            className="relative w-11 h-11 rounded-[16px] overflow-hidden border border-white/10 flex-shrink-0 bg-white/5 shadow-[0_0_24px_rgba(76,201,255,0.15)] pressable"
            title="GoldQuant AI"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-neon.jpg"
              alt="GoldQuant AI"
              width={44}
              height={44}
              className="object-cover w-full h-full"
            />
          </Link>
          {expanded && (
            <div className="min-w-0 flex-1 animate-in">
              <h1 className="font-display text-sm font-semibold tracking-tight leading-none">
                <span className="neon-gradient-text">GoldQuant</span>
              </h1>
              <span className="text-[10px] text-dark-text-muted font-medium tracking-wide mt-1 block">
                Risk Manager
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="btn-glass p-2 rounded-full text-dark-text-muted hover:text-white flex-shrink-0"
            title={expanded ? 'Thu gọn sidebar' : 'Mở rộng sidebar'}
            aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {expanded ? (
              <PanelLeftClose className="w-4 h-4 stroke-[1.75]" />
            ) : (
              <PanelLeft className="w-4 h-4 stroke-[1.75]" />
            )}
          </button>
        </div>

        <nav className="p-2.5 space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {mainNav.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/' && activeAccountId === null
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => {
                    if (item.name === 'Dashboard') setActiveAccount(null);
                  }}
                  title={item.name}
                  className={`group relative flex items-center gap-3 px-2.5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 pressable ${
                    isActive ? 'nav-liquid-active' : 'nav-liquid-idle'
                  } ${expanded ? '' : 'justify-center w-full'}`}
                >
                  <item.icon
                    className={`w-[18px] h-[18px] stroke-[1.75] flex-shrink-0 transition-colors ${
                      isActive ? 'text-neon-cyan' : 'text-dark-text-muted group-hover:text-white'
                    }`}
                  />
                  {expanded && (
                    <>
                      <span className="truncate flex-1">{item.short}</span>
                      {item.badge ? (
                        <span className="bg-neon-pink/90 text-dark-bg text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                  {!expanded && item.badge ? (
                    <span className="absolute ml-6 -mt-6 min-w-[14px] h-3.5 px-1 rounded-full bg-neon-pink text-[8px] font-bold text-dark-bg flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {expanded && (
            <div className="pt-5 mt-4 border-t border-white/5 animate-in">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-dark-text-muted uppercase">
                  Chủ sở hữu
                </span>
                <span className="text-[10px] font-mono text-neon-cyan/80 bg-neon-cyan/10 px-1.5 py-0.5 rounded-full border border-neon-cyan/15">
                  {owners.length.toString().padStart(2, '0')}
                </span>
              </div>

              <div className="space-y-3">
                {ownerGroups.map((group) => (
                  <div key={group.ownerKey}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAccount(null);
                        router.push(`/owners?owner=${encodeURIComponent(group.ownerKey)}`);
                      }}
                      className="w-full flex items-center justify-between px-3 mb-1 group/owner"
                      title={`Xem thống kê ${group.ownerName}`}
                    >
                      <span
                        className={`text-[10px] font-semibold tracking-wide truncate ${
                          group.unassigned
                            ? 'text-neon-yellow'
                            : 'text-neon-purple/80 group-hover/owner:text-neon-purple'
                        }`}
                      >
                        {group.ownerName}
                      </span>
                      <span className="text-[10px] font-mono text-dark-text-muted flex-shrink-0 ml-1">
                        {group.accountCount}
                      </span>
                    </button>
                    <div className="space-y-0.5">
                      {group.accounts.map((acc) => {
                        const isActive = activeAccountId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleAccountSelect(acc.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-[12px] transition-all duration-300 text-left pressable ${
                              isActive
                                ? 'nav-liquid-active font-semibold'
                                : 'nav-liquid-idle'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  acc.status === 'Healthy'
                                    ? 'bg-neon-green pulse-glow-green'
                                    : acc.status === 'Moderate'
                                      ? 'bg-neon-yellow'
                                      : 'bg-neon-pink'
                                }`}
                              />
                              <span className="font-mono text-[11px] truncate">{acc.id}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full font-mono ${
                                  acc.riskScore < 30
                                    ? 'badge-neon-green'
                                    : acc.riskScore < 60
                                      ? 'badge-neon-amber'
                                      : 'badge-neon-red'
                                }`}
                              >
                                {acc.riskScore}
                              </span>
                              {isActive && (
                                <ChevronRight className="w-3.5 h-3.5 text-neon-cyan stroke-[1.75]" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className={`p-2.5 border-t border-white/5 space-y-2 ${expanded ? '' : 'flex flex-col items-center'}`}>
          <button
            onClick={onCreateAccountClick}
            className={`btn-neon py-2.5 flex items-center justify-center gap-2 text-[13px] pressable ${
              expanded ? 'w-full px-4' : 'w-11 h-11'
            }`}
            title="Create Account"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            {expanded && <span>Create</span>}
          </button>

          <Link
            href="/admin"
            className={`btn-glass py-2 flex items-center justify-center gap-2 text-[11px] font-medium text-neon-purple hover:text-white pressable ${
              expanded ? 'w-full px-3' : 'w-11 h-11'
            }`}
            title="Admin Portal"
          >
            <ShieldAlert className="w-3.5 h-3.5 stroke-[1.75]" />
            {expanded && <span>Admin</span>}
          </Link>

          {expanded && (
            <div className="flex items-center justify-between pt-1 px-1 text-[10px] text-dark-text-muted">
              <span className="text-neon-cyan/50 font-medium tracking-wide">Liquid Glass</span>
              <button
                onClick={() => useAuthStore.getState().logout()}
                className="flex items-center gap-1 hover:text-neon-pink transition-colors pressable"
              >
                <LogOut className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
