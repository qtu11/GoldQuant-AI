'use client';

import React, { useState, useEffect } from 'react';
import { useTradingStore, TradingAccount } from '../store/useTradingStore';
import AccountCard from '../components/AccountCard';
import DetailDashboard from '../components/DetailDashboard';
import DetailTransactions from '../components/DetailTransactions';
import FileUpload from '../components/FileUpload';
import UpdateCapitalModal from '../components/UpdateCapitalModal';
import CreateAccountModal from '../components/CreateAccountModal';
import EditAccountModal from '../components/EditAccountModal';
import { toUsd, formatVnd, getUsdVndRate, usdToVnd, formatRateSource } from '../utils/currency';
import { 
  ArrowLeft, 
  Plus, 
  Upload, 
  LineChart, 
  Layers, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  ArrowDownRight, 
  Target, 
  ShieldAlert, 
  Sparkles,
  Database,
  RefreshCw,
  Settings,
  Coins,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export default function Home() {
  const { accounts, activeAccountId, setActiveAccount, loadAccounts, isLoading } = useTradingStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions'>('dashboard');
  const [period, setPeriod] = useState<string>('all');
  const [isUpdateCapitalOpen, setIsUpdateCapitalOpen] = useState(false);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'USC'>('USD');
  const [vndRate, setVndRate] = useState<number>(25850);
  const [vndSource, setVndSource] = useState<string>('');
  const [loadingRate, setLoadingRate] = useState(false);

  // Khởi tạo kéo dữ liệu từ Firebase và lấy tỷ giá USD/VND khi mount
  useEffect(() => {
    loadAccounts();
    
    const fetchRate = async () => {
      setLoadingRate(true);
      try {
        const result = await getUsdVndRate();
        setVndRate(result.rate);
        setVndSource(formatRateSource(result));
      } catch {
        setVndSource('Fallback (offline)');
      }
      setLoadingRate(false);
    };
    fetchRate();
  }, [loadAccounts]);

  // Lấy tài khoản đang được chọn
  const activeAccount = accounts.find(acc => acc.id === activeAccountId);

  // Hiển thị màn hình loading chuyên nghiệp
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
          <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin pulse-glow-gold"></div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-extrabold text-gold animate-pulse uppercase tracking-widest font-mono">
            Connecting GoldQuant Firestore...
          </p>
          <p className="text-[10px] text-dark-text-muted">Loading secure financial modules</p>
        </div>
      </div>
    );
  }

  // --- TRANG TỔNG QUAN (RISK DASHBOARD) ---
  if (!activeAccountId || !activeAccount) {
    const totalAccounts = accounts.length;
    const totalEquityUsd = accounts.reduce((sum, a) => sum + toUsd(a.currentEquity, a.currency), 0);
    const totalProfitUsd = accounts.reduce((sum, a) => sum + toUsd(a.stats.netProfit, a.currency), 0);
    const avgProfitFactor = totalAccounts > 0 
      ? Math.round((accounts.reduce((sum, a) => sum + a.stats.profitFactor, 0) / totalAccounts) * 100) / 100 
      : 0;
    const avgDrawdown = totalAccounts > 0 
      ? Math.round((accounts.reduce((sum, a) => sum + a.stats.maxDrawdown, 0) / totalAccounts) * 10) / 10 
      : 0;
    const totalTrades = accounts.reduce((sum, a) => sum + a.stats.totalTrades, 0);
    const avgRiskScore = totalAccounts > 0 
      ? Math.round(accounts.reduce((sum, a) => sum + a.riskScore, 0) / totalAccounts) 
      : 0;

    let riskLabel = 'HIGH RISK';
    let riskColor = 'text-red-500 bg-red-500/10 border-red-500/20';
    if (avgRiskScore >= 90) {
      riskLabel = 'EXCELLENT';
      riskColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    } else if (avgRiskScore >= 75) {
      riskLabel = 'HEALTHY';
      riskColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    } else if (avgRiskScore >= 50) {
      riskLabel = 'MODERATE';
      riskColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    }

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header trang tổng quan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-gold" />
              <h2 className="text-3xl font-black text-white tracking-tight">Risk Dashboard</h2>
            </div>
            <p className="text-xs text-dark-text-muted mt-1.5">
              Tổng quan rủi ro gộp hệ thống · {totalAccounts} tài khoản kết nối · {accounts.filter(a => a.stats.totalTrades > 0).length} có lịch sử giao dịch
            </p>
          </div>
          <button
            onClick={() => setIsCreateAccountOpen(true)}
            className="bg-gold hover:bg-gold-hover text-dark-bg font-bold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 text-sm transition-all cursor-pointer gold-glow-hover active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Thống kê gộp (Overview Stats Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Total Equity */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Total Equity</span>
              <div className="p-1.5 rounded-lg bg-gold/10"><DollarSign className="w-4 h-4 text-gold" /></div>
            </div>
            <div className="mt-4">
              <span className="text-lg font-black text-white font-mono leading-tight block">
                {formatVnd(usdToVnd(totalEquityUsd, vndRate))}
              </span>
              <span className="text-[10px] text-dark-text-muted font-mono mt-1 block">
                ≈ ${Math.round(totalEquityUsd).toLocaleString()} USD
              </span>
            </div>
          </div>

          {/* Total Profit */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Total Profit</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10"><TrendingUp className="w-4 h-4 text-emerald-400" /></div>
            </div>
            <div className="mt-4">
              <span className={`text-lg font-black font-mono leading-tight block ${totalProfitUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalProfitUsd >= 0 ? '+' : ''}{formatVnd(usdToVnd(totalProfitUsd, vndRate))}
              </span>
              <span className={`text-[10px] font-mono mt-1 block ${totalProfitUsd >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                ≈ {totalProfitUsd >= 0 ? '+' : ''}${Math.round(totalProfitUsd).toLocaleString()} USD
              </span>
            </div>
          </div>

          {/* Avg PF */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Avg Profit Factor</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10"><LineChart className="w-4 h-4 text-amber-500" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-white font-mono leading-tight block">
                {avgProfitFactor}
              </span>
              <span className="text-[9px] text-dark-text-muted block mt-1">Độ an toàn hệ thống</span>
            </div>
          </div>

          {/* Avg Drawdown */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Avg Drawdown</span>
              <div className="p-1.5 rounded-lg bg-red-500/10"><TrendingDown className="w-4 h-4 text-red-500" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-white font-mono leading-tight block">
                {avgDrawdown}%
              </span>
              <span className="text-[9px] text-dark-text-muted block mt-1">Sụt giảm tài sản gộp</span>
            </div>
          </div>

          {/* Total Trades */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Total Trades</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10"><Target className="w-4 h-4 text-blue-400" /></div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-white font-mono leading-tight block">
                {totalTrades}
              </span>
              <span className="text-[9px] text-dark-text-muted block mt-1">Lệnh đã hoàn thành</span>
            </div>
          </div>

          {/* Avg Risk Score */}
          <div className="glass-effect-premium gold-glow-hover rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-dark-text-muted uppercase tracking-wider">Risk Score</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10"><ShieldAlert className="w-4 h-4 text-purple-400" /></div>
            </div>
            <div className="mt-4 flex flex-col justify-end">
              <span className="text-2xl font-black text-white font-mono leading-tight block">
                {avgRiskScore}
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded border inline-block text-center w-max ${riskColor}`}>
                {riskLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Trading Accounts List Grid */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-dark-text-light uppercase tracking-wider">Trading Accounts</h3>
            <button 
              onClick={() => { 
                if (accounts.length > 0) {
                  setEditingAccount(accounts[0]);
                  setIsEditAccountOpen(true);
                } else {
                  alert('Vui lòng tạo tài khoản trước!');
                }
              }}
              className="p-1.5 rounded bg-white/3 hover:bg-white/10 text-dark-text-muted hover:text-gold border border-white/5 transition-all cursor-pointer"
              title="Quản lý / Chỉnh sửa tài khoản"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map(acc => (
              <AccountCard 
                key={acc.id} 
                account={acc} 
                onSelect={() => setActiveAccount(acc.id)}
                onEdit={(e) => {
                  e.stopPropagation();
                  setEditingAccount(acc);
                  setIsEditAccountOpen(true);
                }}
              />
            ))}
            
            {/* Thẻ tạo tài khoản trống để mời chào */}
            <div 
              onClick={() => setIsCreateAccountOpen(true)}
              className="bg-transparent border border-dashed border-white/10 hover:border-gold hover:bg-white/2 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[190px] transition-all duration-300 group active:scale-98 shadow-inner"
            >
              <div className="p-3 bg-white/3 border border-white/5 rounded-full text-dark-text-muted mb-3 group-hover:text-gold group-hover:bg-gold/10 group-hover:border-gold/20 transition-all">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-gold transition-colors">Thêm tài khoản mới</span>
              <span className="text-xs text-dark-text-muted mt-1.5 px-4 leading-normal">Kết nối thêm tài khoản MT5 để quản lý rủi ro gộp bằng AI</span>
            </div>
          </div>
        </div>

        {/* Modal tạo tài khoản */}
        <CreateAccountModal 
          isOpen={isCreateAccountOpen} 
          onClose={() => setIsCreateAccountOpen(false)} 
        />

        {/* Modal chỉnh sửa tài khoản */}
        <EditAccountModal
          isOpen={isEditAccountOpen}
          onClose={() => {
            setIsEditAccountOpen(false);
            setEditingAccount(null);
          }}
          account={editingAccount}
        />
      </div>
    );
  }

  // --- TRANG CHI TIẾT TÀI KHOẢN ---
  const isUscAccount = activeAccount.currency === 'USC';
  let displayEquity: number;
  let displayInitialCapital: number;
  let displayCurrencyLabel: string;
  
  if (currencyMode === 'USC') {
    displayEquity = activeAccount.currentEquity;
    displayInitialCapital = activeAccount.initialCapital;
    displayCurrencyLabel = 'USC';
  } else {
    displayEquity = isUscAccount ? activeAccount.currentEquity / 100 : activeAccount.currentEquity;
    displayInitialCapital = isUscAccount ? activeAccount.initialCapital / 100 : activeAccount.initialCapital;
    displayCurrencyLabel = 'USD';
  }
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Nút quay lại trang chủ tổng quan */}
      <button 
        onClick={() => setActiveAccount(null)}
        className="flex items-center gap-2 text-xs text-dark-text-muted hover:text-white transition-all cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="font-semibold">Quay lại Dashboard chính</span>
      </button>

      {/* Account Info Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-black text-white font-mono leading-none tracking-tight flex items-center gap-2">
              <span>{activeAccount.id}</span>
              {activeAccount.accountName && (
                <span className="text-xs font-bold text-gold px-2.5 py-0.5 rounded bg-gold/10 border border-gold/10 uppercase font-sans tracking-wide">
                  {activeAccount.accountName}
                </span>
              )}
              <button 
                onClick={() => {
                  setEditingAccount(activeAccount);
                  setIsEditAccountOpen(true);
                }}
                className="p-1.5 rounded bg-white/3 hover:bg-white/10 text-dark-text-muted hover:text-gold border border-white/5 transition-all cursor-pointer"
                title="Chỉnh sửa hoặc Xóa tài khoản này"
              >
                <Settings className="w-4 h-4" />
              </button>
            </h2>
            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 border ${
              activeAccount.status === 'Healthy' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : activeAccount.status === 'Moderate'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                activeAccount.status === 'Healthy' 
                  ? 'bg-emerald-400 pulse-glow-green' 
                  : activeAccount.status === 'Moderate'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
              }`} />
              {activeAccount.status}
            </span>

            {/* Leverage Badge */}
            {activeAccount.leverage && (
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-amber-400 text-xs font-bold font-mono">
                1:{activeAccount.leverage}
              </span>
            )}

            {/* Currency Switcher */}
            <div className="flex bg-white/3 border border-white/5 p-0.5 rounded-lg">
              <button
                onClick={() => setCurrencyMode('USC')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  currencyMode === 'USC' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-dark-text-muted hover:text-white'
                }`}
              >
                USC
              </button>
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  currencyMode === 'USD' 
                    ? 'bg-gold text-dark-bg shadow-md' 
                    : 'text-dark-text-muted hover:text-white'
                }`}
              >
                USD
              </button>
            </div>
          </div>
          
          <p className="text-xs text-dark-text-muted font-semibold tracking-wide">
            {activeAccount.broker} · {activeAccount.server} · {activeAccount.platform} · {activeAccount.symbol} · {activeAccount.accountType}
            {isUscAccount && <span className="text-amber-400/80 ml-2">(Tài khoản Cent quy đổi: 100 USC = 1 USD)</span>}
          </p>
        </div>

        {/* Capital Display & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 self-start xl:self-auto w-full md:w-auto">
          {/* Capital Info */}
          <div className="flex gap-8 border-r border-white/5 pr-6 hidden md:flex font-mono">
            <div>
              <span className="text-[10px] font-bold text-dark-text-muted uppercase block tracking-wider">Initial Capital</span>
              <span className="text-lg font-black text-white mt-1 block">
                {currencyMode === 'USC' ? '' : '$'}{Math.round(displayInitialCapital).toLocaleString()} {displayCurrencyLabel}
              </span>
              {currencyMode === 'USD' && (
                <span className="text-[9px] text-dark-text-muted block mt-0.5">≈ {formatVnd(usdToVnd(displayInitialCapital, vndRate))}</span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-dark-text-muted uppercase block tracking-wider">Current Equity</span>
              <span className="text-lg font-black text-gold mt-1 block">
                {currencyMode === 'USC' ? '' : '$'}{Math.round(displayEquity).toLocaleString()} {displayCurrencyLabel}
              </span>
              {currencyMode === 'USD' && (
                <span className="text-[9px] text-gold/60 block mt-0.5">≈ {formatVnd(usdToVnd(displayEquity, vndRate))}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsUpdateCapitalOpen(true)}
              className="bg-white/3 border border-white/5 hover:border-gold hover:text-gold text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer active:scale-98"
            >
              <Database className="w-4 h-4" />
              <span>Update Capital</span>
            </button>
            
            <button
              onClick={() => {
                setActiveTab('transactions');
              }}
              className="bg-white/3 border border-white/5 hover:border-gold hover:text-gold text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer active:scale-98"
            >
              <Upload className="w-4 h-4" />
              <span>Upload History</span>
            </button>

            <button
              onClick={() => alert('Gợi ý quy mô vốn AI Capital Scaling: Tăng quy mô tài khoản thêm 15% dựa trên hệ số Sharpe > 5 và drawdown < 1%!')}
              className="bg-gold hover:bg-gold-hover text-dark-bg font-black py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer gold-glow active:scale-98 shadow-md"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>AI Scale</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu Selector */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-0.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-gold text-gold'
              : 'border-transparent text-dark-text-muted hover:text-white'
          }`}
        >
          <Layers className="w-4.5 h-4.5" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'transactions'
              ? 'border-gold text-gold'
              : 'border-transparent text-dark-text-muted hover:text-white'
          }`}
        >
          <Database className="w-4.5 h-4.5" />
          <span>Transactions</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' ? (
        <DetailDashboard 
          account={activeAccount} 
          period={period}
          setPeriod={setPeriod}
          currencyMode={currencyMode}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <DetailTransactions trades={activeAccount.trades} />
            </div>
            
            <div className="space-y-4">
              <div className="glass-effect-premium rounded-xl p-5 border border-white/5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <span>Hướng dẫn Cập nhật</span>
                </h4>
                <ul className="text-xs text-dark-text-muted space-y-2.5 list-none">
                  <li className="flex gap-2 items-start"><span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" /><span>Mở phần mềm <strong>MT5 Exness</strong> trên PC.</span></li>
                  <li className="flex gap-2 items-start"><span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" /><span>Vào mục <strong>Toolbox</strong> → Chọn tab <strong>History</strong>.</span></li>
                  <li className="flex gap-2 items-start"><span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" /><span>Chuột phải vào danh sách lịch sử lệnh → Chọn <strong>Report</strong>.</span></li>
                  <li className="flex gap-2 items-start"><span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" /><span>Xuất file dưới dạng <strong>Open XML (Excel)</strong> hoặc <strong>HTML</strong>.</span></li>
                  <li className="flex gap-2 items-start"><span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" /><span>Kéo thả file vào ô bên dưới — hệ thống AI tự phân tích.</span></li>
                </ul>
              </div>

              <FileUpload accountId={activeAccount.id} />
            </div>
          </div>
        </div>
      )}

      {/* Modal cập nhật vốn */}
      <UpdateCapitalModal 
        isOpen={isUpdateCapitalOpen} 
        onClose={() => setIsUpdateCapitalOpen(false)} 
        accountId={activeAccount.id}
      />
      
      {/* Modal chỉnh sửa tài khoản */}
      <EditAccountModal
        isOpen={isEditAccountOpen}
        onClose={() => {
          setIsEditAccountOpen(false);
          setEditingAccount(null);
        }}
        account={activeAccount}
      />
    </div>
  );
}
