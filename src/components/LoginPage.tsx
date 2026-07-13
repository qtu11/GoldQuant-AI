'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Lock, User, Eye, EyeOff, ShieldAlert, Sparkles, Coins } from 'lucide-react';

export default function LoginPage() {
  const { login, error, isLoading } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [animatedBg, setAnimatedBg] = useState(false);

  useEffect(() => {
    setAnimatedBg(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await login(username, password);
  };

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text-light relative flex items-center justify-center p-4 overflow-hidden">
      {/* Ambient glass background layers */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        <div 
          className={`absolute w-[450px] h-[450px] rounded-full bg-neon-purple/15 blur-[120px] transition-all duration-[3000ms] ${
            animatedBg ? 'top-[-50px] left-[-50px] scale-110' : 'top-[-100px] left-[-100px] scale-90'
          }`} 
        />
        <div 
          className={`absolute w-[500px] h-[500px] rounded-full bg-neon-cyan/10 blur-[130px] transition-all duration-[4000ms] ${
            animatedBg ? 'bottom-[-50px] right-[-50px] scale-110' : 'bottom-[-100px] right-[-100px] scale-90'
          }`} 
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-gold/5 blur-[100px]" />
      </div>

      <div className="hud-grid absolute inset-0 pointer-events-none" aria-hidden />
      <div className="hud-vignette absolute inset-0 pointer-events-none" aria-hidden />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="neon-card-premium p-8 md:p-10 kpi-purple border-t-2 border-t-neon-purple/60 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          
          {/* Brand header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative w-16 h-16 mb-4 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center bg-white/5 shadow-[0_0_32px_rgba(138,125,255,0.25)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-neon.jpg"
                alt="GoldQuant AI"
                className="object-cover w-full h-full"
              />
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight">
              GOLDQUANT <span className="neon-gradient-text">AI</span>
            </h1>
            <p className="text-xs text-dark-text-muted mt-1.5 font-medium tracking-wide uppercase">
              Hệ thống Quản trị Rủi ro XAUUSD
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-neon-pink/20 bg-neon-pink/10 text-xs text-neon-pink animate-in fade-in duration-300">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Input Login */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider block">
                Tài khoản
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text-muted group-focus-within:text-neon-cyan transition-colors">
                  <User className="w-4 h-4 stroke-[1.75]" />
                </div>
                <input
                  type="text"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập admin"
                  className="w-full bg-dark-input hover:bg-white/[0.08] focus:bg-dark-bg text-sm px-11 py-3.5 rounded-xl border border-dark-border focus:border-neon-cyan/50 text-white placeholder-white/20 transition-all duration-300 focus:outline-none focus:shadow-[0_0_16px_rgba(76,201,255,0.06)]"
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider block">
                Mật khẩu
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-text-muted group-focus-within:text-neon-purple transition-colors">
                  <Lock className="w-4 h-4 stroke-[1.75]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu an toàn"
                  className="w-full bg-dark-input hover:bg-white/[0.08] focus:bg-dark-bg text-sm px-11 py-3.5 rounded-xl border border-dark-border focus:border-neon-purple/50 text-white placeholder-white/20 transition-all duration-300 focus:outline-none focus:shadow-[0_0_16px_rgba(138,125,255,0.06)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 stroke-[1.75]" />
                  ) : (
                    <Eye className="w-4 h-4 stroke-[1.75]" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-dark-text-muted pt-1">
              <span className="flex items-center gap-1 text-neon-cyan">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Thiết bị sẽ tự động ghi nhớ</span>
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full relative mt-3 py-3.5 rounded-xl btn-neon font-semibold text-sm flex items-center justify-center gap-2 pressable transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-dark-bg border-t-transparent animate-spin" />
              ) : (
                <>
                  <Coins className="w-4 h-4 stroke-[2]" />
                  <span>Xác thực & Truy cập</span>
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="text-center mt-8 pt-6 border-t border-white/5">
            <span className="text-[10px] font-mono text-dark-text-muted tracking-widest uppercase">
              GOLDQUANT SECURE SHELL v2.6.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
