import { create } from 'zustand';
import { Trade } from '../utils/fileParser';
import { AccountStats, calculateStats, calculateRiskScore } from '../utils/analytics';
import { sendTelegramAlert } from '../utils/telegram';
import { 
  fetchAccountsFromFirestore, 
  saveAccountToFirestore, 
  deleteAccountFromFirestore 
} from '../utils/firebaseStore';

export interface TradingAccount {
  id: string;
  broker: string;
  platform: string;
  server: string;
  symbol: string;
  accountType: string;
  currency: 'USD' | 'USC';
  initialCapital: number;
  currentEquity: number;
  accountName?: string;
  leverage?: number;
  status: 'Healthy' | 'Moderate' | 'High Risk';
  stats: AccountStats;
  riskScore: number;
  riskLabel: string;
  riskColor: string;
  subMetrics: {
    profitability: number;
    stability: number;
    riskControl: number;
    capitalEff: number;
    consistency: number;
    recovery: number;
  };
  trades: Trade[];
}

interface TradingStore {
  accounts: TradingAccount[];
  activeAccountId: string | null;
  isLoading: boolean;
  notifications: Array<{
    id: string;
    accountId: string;
    type: 'warning' | 'info' | 'critical';
    message: string;
    time: string;
    read: boolean;
  }>;
  loadAccounts: () => Promise<void>;
  setActiveAccount: (id: string | null) => void;
  createAccount: (accountData: Omit<TradingAccount, 'stats' | 'riskScore' | 'riskLabel' | 'riskColor' | 'subMetrics' | 'trades' | 'currentEquity' | 'status'>) => Promise<void>;
  updateCapital: (id: string, initialCapital: number, currentEquity: number) => Promise<void>;
  uploadHistory: (id: string, trades: Trade[]) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  editAccount: (id: string, updatedData: Partial<Omit<TradingAccount, 'stats' | 'riskScore' | 'riskLabel' | 'riskColor' | 'subMetrics' | 'trades' | 'currentEquity' | 'status'>>) => Promise<void>;
  markAllNotificationsRead: () => void;
}

// 9 lệnh mẫu giao dịch thực tế chủ tịch yêu cầu mặc định
export const sampleTransactions: Trade[] = [
  { ticket: '3538019819', openTime: '2026.07.09 23:18:00', closeTime: '2026.07.09 23:51:00', symbol: 'XAUUSD', type: 'SELL', volume: 0.01, openPrice: 4123.93, closePrice: 4124.44, profit: 1.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'US' },
  { ticket: '3538019820', openTime: '2026.07.09 23:21:28', closeTime: '2026.07.09 23:51:00', symbol: 'XAUUSD', type: 'SELL', volume: 0.01, openPrice: 4125.19, closePrice: 4124.44, profit: 3.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'US' },
  { ticket: '3537988833', openTime: '2026.07.09 23:24:00', closeTime: '2026.07.09 23:24:10', symbol: 'XAUUSD', type: 'BUY', volume: 0.01, openPrice: 4122.95, closePrice: 4122.60, profit: 3.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'US' },
  { ticket: '3537988834', openTime: '2026.07.09 23:25:26', closeTime: '2026.07.09 23:29:10', symbol: 'XAUUSD', type: 'BUY', volume: 0.01, openPrice: 4121.86, closePrice: 4122.60, profit: 1.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'US' },
  { ticket: '3538043593', openTime: '2026.07.09 23:47:00', closeTime: '2026.07.10 00:03:38', symbol: 'XAUUSD', type: 'SELL', volume: 0.01, openPrice: 4123.84, closePrice: 4122.70, profit: 1.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'US' },
  { ticket: '3538022387', openTime: '2026.07.10 00:01:00', closeTime: '2026.07.10 00:05:19', symbol: 'XAUUSD', type: 'BUY', volume: 0.01, openPrice: 4121.40, closePrice: 4122.96, profit: 1.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'Asia' },
  { ticket: '3538059499', openTime: '2026.07.10 00:01:06', closeTime: '2026.07.10 00:06:40', symbol: 'XAUUSD', type: 'BUY', volume: 0.01, openPrice: 4121.07, closePrice: 4123.23, profit: 1.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'Asia' },
  { ticket: '3538275674', openTime: '2026.07.10 00:02:29', closeTime: '2026.07.10 00:53:13', symbol: 'XAUUSD', type: 'BUY', volume: 0.02, openPrice: 4120.11, closePrice: 4122.05, profit: 2.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'Asia' },
  { ticket: '3538043594', openTime: '2026.07.10 00:06:00', closeTime: '2026.07.10 00:08:38', symbol: 'XAUUSD', type: 'SELL', volume: 0.01, openPrice: 4124.47, closePrice: 4122.70, profit: 2.00, commission: 0, swap: 0, comment: 'Dethayhu', session: 'Asia' }
];

export const useTradingStore = create<TradingStore>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  isLoading: false,
  notifications: [
    {
      id: '1',
      accountId: 'system',
      type: 'info',
      message: 'Hệ thống GoldQuant AI đã sẵn sàng và kết nối Firestore.',
      time: 'Vừa xong',
      read: false
    }
  ],

  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const firestoreAccs = await fetchAccountsFromFirestore();
      
      // Kiểm tra xem đã từng khởi tạo tài khoản mẫu chưa
      const isInitialized = typeof window !== 'undefined' ? localStorage.getItem('goldquant_initialized') : 'true';
      
      // Nếu Firebase hoàn toàn trống và chưa từng khởi tạo mặc định, chúng ta sẽ tạo 1 tài khoản mẫu chứa 9 lệnh thật ban đầu làm mặc định
      if (firestoreAccs.length === 0 && !isInitialized) {
        const stats = calculateStats(sampleTransactions, 2000);
        const risk = calculateRiskScore(stats);
        
        const defaultAcc: TradingAccount = {
          id: '160087297',
          accountName: 'Gold Scalper Pro 1',
          broker: 'Exness',
          platform: 'MT5',
          server: 'Exness-MT5Real30',
          symbol: 'XAUUSD',
          accountType: 'Standard',
          currency: 'USD',
          initialCapital: 2000,
          currentEquity: 2014, // 2000 + 14$ profit từ 9 lệnh mẫu
          status: 'Healthy',
          stats,
          riskScore: risk.score,
          riskLabel: risk.label,
          riskColor: risk.color,
          subMetrics: risk.subMetrics,
          trades: sampleTransactions
        };
        
        await saveAccountToFirestore(defaultAcc);
        if (typeof window !== 'undefined') {
          localStorage.setItem('goldquant_initialized', 'true');
        }
        
        set({ 
          accounts: [defaultAcc], 
          activeAccountId: defaultAcc.id,
          isLoading: false 
        });
      } else {
        set({ 
          accounts: firestoreAccs, 
          activeAccountId: firestoreAccs[0]?.id || null,
          isLoading: false 
        });
      }
    } catch (err) {
      console.error('Failed to load accounts from Firestore:', err);
      set({ isLoading: false });
    }
  },

  setActiveAccount: (id) => set({ activeAccountId: id }),

  createAccount: async (accountData) => {
    const emptyStats: AccountStats = {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalLot: 0,
      netProfit: 0,
      winRate: 0,
      roi: 0,
      monthlyRoi: 0,
      profitFactor: 0,
      recoveryFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sessionStats: {
        Asia: { trades: 0, profit: 0, volume: 0 },
        Europe: { trades: 0, profit: 0, volume: 0 },
        US: { trades: 0, profit: 0, volume: 0 }
      }
    };

    const newAcc: TradingAccount = {
      ...accountData,
      currentEquity: accountData.initialCapital,
      status: 'Healthy',
      stats: emptyStats,
      riskScore: 50,
      riskLabel: 'MODERATE',
      riskColor: '#f5b61b',
      subMetrics: {
        profitability: 50,
        stability: 50,
        riskControl: 50,
        capitalEff: 50,
        consistency: 50,
        recovery: 50
      },
      trades: []
    };

    // Đẩy lên Firestore
    await saveAccountToFirestore(newAcc);
    if (typeof window !== 'undefined') {
      localStorage.setItem('goldquant_initialized', 'true');
    }

    const newNotification = {
      id: Date.now().toString(),
      accountId: newAcc.id,
      type: 'info' as const,
      message: `Tài khoản mới ${newAcc.id} đã được tạo thành công và lưu trữ trên Firebase.`,
      time: 'Vừa xong',
      read: false
    };

    // Gửi Telegram
    const teleMsg = `🔔 <b>[GoldQuant AI] Liên kết tài khoản mới thành công</b>\n` +
      `• <b>ID tài khoản:</b> <code>${newAcc.id}</code>\n` +
      `• <b>Tên tài khoản:</b> ${newAcc.accountName || 'Không có'}\n` +
      `• <b>Broker:</b> ${newAcc.broker}\n` +
      `• <b>Server:</b> ${newAcc.server}\n` +
      `• <b>Đòn bẩy:</b> 1:${newAcc.leverage || 500}\n` +
      `• <b>Số vốn ban đầu:</b> ${newAcc.currency === 'USD' ? '$' : ''}${newAcc.initialCapital.toLocaleString()} ${newAcc.currency}\n` +
      `• <b>Cặp giao dịch:</b> ${newAcc.symbol}`;
    sendTelegramAlert(teleMsg);

    set((state) => ({
      accounts: [...state.accounts, newAcc],
      activeAccountId: newAcc.id,
      notifications: [newNotification, ...state.notifications]
    }));
  },

  updateCapital: async (id, initialCapital, currentEquity) => {
    let updatedAccount: TradingAccount | null = null;
    
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id === id) {
          const stats = calculateStats(acc.trades, initialCapital);
          const risk = calculateRiskScore(stats);
          
          updatedAccount = {
            ...acc,
            initialCapital,
            currentEquity,
            stats,
            riskScore: risk.score,
            riskLabel: risk.label,
            riskColor: risk.color,
            subMetrics: risk.subMetrics,
            status: risk.label === 'HIGH RISK' ? 'High Risk' : risk.label === 'MODERATE' ? 'Moderate' : 'Healthy'
          };
          return updatedAccount;
        }
        return acc;
      });

      return { accounts };
    });

    // Lưu vào Firestore
    if (updatedAccount) {
      await saveAccountToFirestore(updatedAccount);
    }

    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: 'info' as const,
      message: `Đã cập nhật số vốn cho tài khoản ${id}. Số vốn ban đầu: $${initialCapital}, Vốn hiện tại: $${currentEquity}.`,
      time: 'Vừa xong',
      read: false
    };

    // Gửi Telegram
    const targetAcc = get().accounts.find(a => a.id === id);
    const currency = targetAcc?.currency || 'USD';
    const teleMsg = `💰 <b>[GoldQuant AI] Cập nhật vốn tài khoản</b>\n` +
      `• <b>Tài khoản:</b> <code>${id}</code>\n` +
      `• <b>Vốn ban đầu mới:</b> ${currency === 'USD' ? '$' : ''}${initialCapital.toLocaleString()} ${currency}\n` +
      `• <b>Vốn hiện tại mới:</b> ${currency === 'USD' ? '$' : ''}${currentEquity.toLocaleString()} ${currency}`;
    sendTelegramAlert(teleMsg);

    set((state) => ({
      notifications: [newNotification, ...state.notifications]
    }));
  },

  uploadHistory: async (id, parsedTrades) => {
    let updatedAccount: TradingAccount | null = null;

    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id === id) {
          const stats = calculateStats(parsedTrades, acc.initialCapital);
          const risk = calculateRiskScore(stats);
          const newEquity = acc.initialCapital + stats.netProfit;

          updatedAccount = {
            ...acc,
            currentEquity: newEquity,
            trades: parsedTrades,
            stats,
            riskScore: risk.score,
            riskLabel: risk.label,
            riskColor: risk.color,
            subMetrics: risk.subMetrics,
            status: risk.label === 'HIGH RISK' ? ('High Risk' as const) : risk.label === 'MODERATE' ? ('Moderate' as const) : ('Healthy' as const)
          };
          return updatedAccount;
        }
        return acc;
      });

      return { accounts };
    });

    // Lưu vào Firestore
    if (updatedAccount) {
      await saveAccountToFirestore(updatedAccount);
    }

    const targetAcc = get().accounts.find(a => a.id === id);
    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: (parsedTrades.length === 0 ? 'critical' : 'info') as any,
      message: parsedTrades.length === 0 
        ? `Lỗi khi phân tích tệp lịch sử giao dịch tải lên cho tài khoản ${id}.` 
        : `Tải lên lịch sử thành công cho tài khoản ${id}. Phân tích ${parsedTrades.length} lệnh. Lợi nhuận ròng mới: $${Math.round((parsedTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0)) * 100) / 100}`,
      time: 'Vừa xong',
      read: false
    };

    // Gửi Telegram
    if (parsedTrades.length > 0 && targetAcc) {
      const stats = calculateStats(parsedTrades, targetAcc.initialCapital);
      const risk = calculateRiskScore(stats);
      const currency = targetAcc.currency;
      
      const profitFormatted = currency === 'USD' 
        ? `$${stats.netProfit.toLocaleString()}` 
        : `${stats.netProfit.toLocaleString()} USC`;
        
      const teleMsg = `📊 <b>[GoldQuant AI] Phân tích lịch sử giao dịch thành công</b>\n` +
        `• <b>Tài khoản:</b> <code>${id}</code>\n` +
        `• <b>Tên tài khoản:</b> ${targetAcc.accountName || 'Không có'}\n` +
        `• <b>Tổng số lệnh đã đóng:</b> <code>${stats.totalTrades}</code>\n` +
        `• <b>Lợi nhuận ròng:</b> <b>${stats.netProfit >= 0 ? '+' : ''}${profitFormatted}</b>\n` +
        `• <b>Win Rate:</b> <code>${stats.winRate}%</code> (${stats.wins} thắng / ${stats.losses} thua)\n` +
        `• <b>Tỷ suất ROI:</b> <code>${stats.roi}%</code> (Tháng: <code>${stats.monthlyRoi}%</code>)\n` +
        `• <b>Max Drawdown:</b> <code>${stats.maxDrawdown}%</code>\n` +
        `• <b>Profit Factor:</b> <code>${stats.profitFactor}</code>\n` +
        `• <b>Sharpe Ratio:</b> <code>${stats.sharpeRatio}</code>\n` +
        `• <b>Recovery Factor:</b> <code>${stats.recoveryFactor}</code>\n` +
        `---------------------------\n` +
        `🛡 <b>AI Risk Score:</b> <code>${risk.score}/100</code> (<b>${risk.label}</b>)`;
      sendTelegramAlert(teleMsg);
    } else if (parsedTrades.length === 0) {
      sendTelegramAlert(`🚨 <b>[GoldQuant AI] Lỗi phân tích tệp lịch sử</b>\nKhông tìm thấy lệnh hợp lệ nào trong tệp vừa tải lên của tài khoản <code>${id}</code>.`);
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications]
    }));
  },

  deleteAccount: async (id) => {
    const targetAcc = get().accounts.find(a => a.id === id);
    
    // Xóa từ Firestore
    await deleteAccountFromFirestore(id);

    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: 'warning' as const,
      message: `Đã xóa tài khoản ${id} khỏi hệ thống và Firebase.`,
      time: 'Vừa xong',
      read: false
    };
    
    // Gửi Telegram
    const teleMsg = `❌ <b>[GoldQuant AI] Đã hủy liên kết tài khoản</b>\n` +
      `• <b>Tài khoản ID:</b> <code>${id}</code>\n` +
      `• <b>Tên tài khoản:</b> ${targetAcc?.accountName || 'Không có'}`;
    sendTelegramAlert(teleMsg);

    set((state) => {
      const accounts = state.accounts.filter(a => a.id !== id);
      const activeAccountId = state.activeAccountId === id ? (accounts[0]?.id || null) : state.activeAccountId;
      return {
        accounts,
        activeAccountId,
        notifications: [newNotification, ...state.notifications]
      };
    });
  },

  editAccount: async (id, updatedData) => {
    let updatedAccount: TradingAccount | null = null;

    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id === id) {
          const merged = { ...acc, ...updatedData };
          let stats = acc.stats;
          let risk = { score: acc.riskScore, label: acc.riskLabel, color: acc.riskColor, subMetrics: acc.subMetrics };
          
          if (updatedData.initialCapital !== undefined) {
            stats = calculateStats(acc.trades, updatedData.initialCapital);
            risk = calculateRiskScore(stats);
          }

          updatedAccount = {
            ...merged,
            stats,
            riskScore: risk.score,
            riskLabel: risk.label,
            riskColor: risk.color,
            subMetrics: risk.subMetrics,
            status: risk.label === 'HIGH RISK' ? ('High Risk' as const) : risk.label === 'MODERATE' ? ('Moderate' as const) : ('Healthy' as const)
          };
          return updatedAccount;
        }
        return acc;
      });

      return { accounts };
    });

    // Lưu vào Firestore
    if (updatedAccount) {
      await saveAccountToFirestore(updatedAccount);
    }

    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: 'info' as const,
      message: `Đã cập nhật thông tin tài khoản ${id} thành công trên Firebase.`,
      time: 'Vừa xong',
      read: false
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications]
    }));
  },

  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  }))
}));
