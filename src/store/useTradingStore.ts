import { create } from 'zustand';
import { Trade } from '../utils/fileParser';
import { AccountStats, calculateStats, calculateRiskScore } from '../utils/analytics';
import { sendTelegramAlert } from '../utils/telegram';
import { 
  fetchAccountsFromFirestore, 
  saveAccountToFirestore, 
  deleteAccountFromFirestore,
  fetchOwnersFromFirestore,
  saveOwnerToFirestore,
  deleteOwnerFromFirestore,
} from '../utils/firebaseStore';
import {
  CapitalMove,
  OpenPosition,
  computeClosedEquity,
  reconcileCapitalMovesToEquity,
} from '../utils/capitalEquity';
import {
  convertAmountBetweenCurrencies,
  normalizeCurrency,
  type AccountCurrency,
} from '../utils/currency';
import type { DailyPnlPoint, SetParam } from '../utils/setParser';

/** Nghiên cứu bot / EA theo từng tài khoản */
export interface BotResearchData {
  fileName?: string;
  botName?: string;
  params: SetParam[];
  dailyPnl: DailyPnlPoint[];
  lastAnalysis?: {
    summary: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    riskScore: number;
    suggestedParams: { key: string; value: string; reason: string }[];
    warnings: string[];
    actions: string[];
    analyzedAt: string;
    provider?: string;
  };
  updatedAt?: string;
}

/** Tránh circular import với ownerStats — mirror normalize */
const UNASSIGNED_KEY = '__unassigned__';
function normalizeOwnerKeyLocal(ownerName?: string | null): string {
  const t = (ownerName || '').trim();
  if (!t) return UNASSIGNED_KEY;
  return t.toLowerCase().replace(/\s+/g, ' ');
}

export type { CapitalMove, OpenPosition };

/** Chủ sở hữu — tạo TRƯỚC, rồi mới gắn TK MT5 */
export interface OwnerProfile {
  id: string;
  name: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

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
  /** Tên chủ sở hữu (phải trùng OwnerProfile.name đã đăng ký). */
  ownerName?: string;
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
  capitalMoves?: CapitalMove[];
  openPositions?: OpenPosition[];
  /** File .set + PnL ngày + kết quả AI (mỗi TK 1 bot profile) */
  botResearch?: BotResearchData;
}

type AccountMeta = Omit<
  TradingAccount,
  'stats' | 'riskScore' | 'riskLabel' | 'riskColor' | 'subMetrics' | 'trades' | 'currentEquity' | 'status' | 'capitalMoves' | 'openPositions' | 'botResearch'
>;

interface TradingStore {
  accounts: TradingAccount[];
  owners: OwnerProfile[];
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
  createOwner: (data: { name: string; note?: string }) => Promise<OwnerProfile>;
  updateOwner: (id: string, data: { name?: string; note?: string }) => Promise<void>;
  deleteOwner: (id: string) => Promise<void>;
  createAccount: (accountData: AccountMeta) => Promise<void>;
  updateCapital: (id: string, initialCapital: number, currentEquity: number) => Promise<void>;
  uploadHistory: (id: string, trades: Trade[]) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  editAccount: (id: string, updatedData: Partial<AccountMeta>) => Promise<void>;
  markAllNotificationsRead: () => void;
  /** Thêm thông báo đầu list (news / risk) + persist localStorage */
  prependNotifications: (
    items: Array<{
      id: string;
      accountId: string;
      type: 'warning' | 'info' | 'critical';
      message: string;
      time: string;
      read: boolean;
    }>
  ) => void;
  hydrateNotifications: () => void;
  addCapitalMove: (
    id: string,
    move: Omit<CapitalMove, 'id' | 'createdAt'>
  ) => Promise<void>;
  removeCapitalMove: (id: string, moveId: string) => Promise<void>;
  addOpenPosition: (
    id: string,
    pos: Omit<OpenPosition, 'id'>
  ) => Promise<void>;
  removeOpenPosition: (id: string, posId: string) => Promise<void>;
  updateOpenPosition: (
    id: string,
    posId: string,
    patch: Partial<OpenPosition>
  ) => Promise<void>;
  /** Lưu / cập nhật nghiên cứu bot theo TK */
  saveBotResearch: (id: string, data: Partial<BotResearchData>) => Promise<void>;
}

/** Sinh id ổn định từ tên chủ (slug) */
export function ownerIdFromName(name: string): string {
  const key = normalizeOwnerKeyLocal(name);
  if (key === UNASSIGNED_KEY) return 'unassigned';
  const slug = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || `owner_${Date.now().toString(36)}`;
}

function mergeOwnersFromAccounts(
  registered: OwnerProfile[],
  accounts: TradingAccount[]
): OwnerProfile[] {
  const map = new Map<string, OwnerProfile>();
  registered.forEach((o) => {
    const k = normalizeOwnerKeyLocal(o.name);
    if (k !== UNASSIGNED_KEY) map.set(k, o);
  });
  const now = new Date().toISOString();
  accounts.forEach((a) => {
    const name = (a.ownerName || '').trim();
    const k = normalizeOwnerKeyLocal(name);
    if (k === UNASSIGNED_KEY || map.has(k)) return;
    map.set(k, {
      id: ownerIdFromName(name),
      name,
      note: '',
      createdAt: now,
      updatedAt: now,
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
  );
}

function refreshEquity(acc: TradingAccount): TradingAccount {
  return {
    ...acc,
    currentEquity: computeClosedEquity(
      acc.initialCapital,
      acc.trades || [],
      acc.capitalMoves || []
    ),
  };
}

function statusFromRisk(label: string): TradingAccount['status'] {
  if (label === 'HIGH RISK') return 'High Risk';
  if (label === 'MODERATE') return 'Moderate';
  return 'Healthy';
}

/** Key ổn định để merge history — ưu tiên ticket, fallback fingerprint đầy đủ */
function tradeKey(t: Trade): string {
  const ticket = String(t.ticket || '').trim();
  if (ticket && !/^P\d+$/i.test(ticket) && ticket !== '-') {
    return `t:${ticket}`;
  }
  return [
    'f',
    t.openTime || '',
    t.closeTime || '',
    t.symbol || '',
    t.type || '',
    t.volume,
    t.openPrice,
    t.closePrice,
    t.profit,
    t.commission,
    t.swap,
  ].join('|');
}

/**
 * Merge history theo ticket.
 * Chỉ full-replace khi file mới cover ≥90% ticket cũ (báo cáo full MT5).
 * Không thay vì chỉ vì file dài hơn — tránh mất lệnh khi upload partial lớn hơn.
 */
function mergeTradeHistory(prev: Trade[], incoming: Trade[]): Trade[] {
  if (!prev.length) return incoming;
  if (!incoming.length) return prev;

  const newByKey = new Map<string, Trade>();
  incoming.forEach((t) => newByKey.set(tradeKey(t), t));

  const covered = prev.filter((t) => newByKey.has(tradeKey(t))).length;
  const coverRatio = covered / prev.length;
  // Full report: cover gần hết ticket cũ + file không nhỏ hơn ~80% số lệnh cũ
  if (coverRatio >= 0.9 && incoming.length >= prev.length * 0.8) {
    return Array.from(newByKey.values());
  }

  // Partial / bổ sung: merge (file mới ghi đè cùng key)
  const byKey = new Map<string, Trade>();
  prev.forEach((t) => byKey.set(tradeKey(t), t));
  incoming.forEach((t) => byKey.set(tradeKey(t), t));
  return Array.from(byKey.values());
}

function applyRiskToAccount(
  acc: TradingAccount,
  trades: Trade[],
  initialCapital: number
): TradingAccount {
  const capitalMoves = acc.capitalMoves || [];
  const stats = calculateStats(trades, initialCapital, capitalMoves);
  const risk = calculateRiskScore(stats);
  return refreshEquity({
    ...acc,
    initialCapital,
    trades,
    capitalMoves,
    stats,
    riskScore: risk.score,
    riskLabel: risk.label,
    riskColor: risk.color,
    subMetrics: risk.subMetrics,
    status: statusFromRisk(risk.label),
  });
}

async function persist(acc: TradingAccount) {
  await saveAccountToFirestore(acc);
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

const NOTIF_STORAGE_KEY = 'goldquant_notifications_v1';

type NotifItem = {
  id: string;
  accountId: string;
  type: 'warning' | 'info' | 'critical';
  message: string;
  time: string;
  read: boolean;
};

function loadStoredNotifications(): NotifItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as NotifItem[];
    return Array.isArray(arr) ? arr.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveStoredNotifications(list: NotifItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

const DEFAULT_NOTIF: NotifItem = {
  id: '1',
  accountId: 'system',
  type: 'info',
  message:
    'Hệ thống GoldQuant AI đã sẵn sàng. Tin XAU (≤5h / LIVE) sẽ hiện tại chuông Notifications.',
  time: 'Vừa xong',
  read: false,
};

export const useTradingStore = create<TradingStore>((set, get) => ({
  accounts: [],
  owners: [],
  activeAccountId: null,
  isLoading: false,
  notifications: [DEFAULT_NOTIF],

  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const [firestoreAccs, firestoreOwners] = await Promise.all([
        fetchAccountsFromFirestore(),
        fetchOwnersFromFirestore(),
      ]);
      
      // Kiểm tra xem đã từng khởi tạo tài khoản mẫu chưa
      const isInitialized = typeof window !== 'undefined' ? localStorage.getItem('goldquant_initialized') : 'true';
      
      // Nếu Firebase hoàn toàn trống và chưa từng khởi tạo mặc định
      if (firestoreAccs.length === 0 && firestoreOwners.length === 0 && !isInitialized) {
        const defaultOwner: OwnerProfile = {
          id: ownerIdFromName('Tôi'),
          name: 'Tôi',
          note: 'Chủ sở hữu mặc định',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveOwnerToFirestore(defaultOwner);

        const stats = calculateStats(sampleTransactions, 2000, []);
        const risk = calculateRiskScore(stats);
        
        const sampleMoves: CapitalMove[] = [];
        const sampleEquity = computeClosedEquity(2000, sampleTransactions, sampleMoves);
        const defaultAcc: TradingAccount = {
          id: '160087297',
          accountName: 'Gold Scalper Pro 1',
          ownerName: 'Tôi',
          broker: 'Exness',
          platform: 'MT5',
          server: 'Exness-MT5Real30',
          symbol: 'XAUUSD',
          accountType: 'Standard',
          currency: 'USD',
          initialCapital: 2000,
          currentEquity: sampleEquity,
          status: 'Healthy',
          stats,
          riskScore: risk.score,
          riskLabel: risk.label,
          riskColor: risk.color,
          subMetrics: risk.subMetrics,
          trades: sampleTransactions,
          capitalMoves: sampleMoves,
          openPositions: [],
        };
        
        await saveAccountToFirestore(defaultAcc);
        if (typeof window !== 'undefined') {
          localStorage.setItem('goldquant_initialized', 'true');
        }
        
        set({ 
          accounts: [defaultAcc],
          owners: [defaultOwner],
          activeAccountId: get().activeAccountId,
          isLoading: false 
        });
      } else {
        const recomputed = firestoreAccs.map((acc) =>
          applyRiskToAccount(
            {
              ...acc,
              currency: normalizeCurrency(acc.currency),
              capitalMoves: acc.capitalMoves || [],
              openPositions: acc.openPositions || [],
              botResearch: acc.botResearch,
              ownerName: (acc.ownerName || '').trim(),
            },
            acc.trades || [],
            Number(acc.initialCapital) || 0
          )
        );
        // Đồng bộ owner từ accounts (migrate tên cũ)
        const owners = mergeOwnersFromAccounts(firestoreOwners, recomputed);
        // Persist owners mới phát sinh từ accounts
        for (const o of owners) {
          if (!firestoreOwners.some((x) => normalizeOwnerKeyLocal(x.name) === normalizeOwnerKeyLocal(o.name))) {
            void saveOwnerToFirestore(o);
          }
        }
        const currentActiveId = get().activeAccountId;
        const preservedId = currentActiveId && recomputed.some(a => a.id === currentActiveId)
          ? currentActiveId
          : null;
        set({ 
          accounts: recomputed,
          owners,
          activeAccountId: preservedId,
          isLoading: false 
        });
      }
    } catch (err) {
      console.error('Failed to load accounts from Firestore:', err);
      set({ isLoading: false });
    }
  },

  setActiveAccount: (id) => set({ activeAccountId: id }),

  createOwner: async ({ name, note }) => {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Vui lòng nhập tên chủ sở hữu.');
    const key = normalizeOwnerKeyLocal(trimmed);
    if (key === UNASSIGNED_KEY) throw new Error('Tên chủ sở hữu không hợp lệ.');
    if (get().owners.some((o) => normalizeOwnerKeyLocal(o.name) === key)) {
      throw new Error(`Chủ sở hữu "${trimmed}" đã tồn tại.`);
    }
    const now = new Date().toISOString();
    const owner: OwnerProfile = {
      id: ownerIdFromName(trimmed),
      name: trimmed,
      note: (note || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    // Tránh trùng id
    if (get().owners.some((o) => o.id === owner.id)) {
      owner.id = `${owner.id}_${Date.now().toString(36).slice(-4)}`;
    }
    await saveOwnerToFirestore(owner);
    set((state) => ({
      owners: [...state.owners, owner].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
      ),
      notifications: [
        {
          id: Date.now().toString(),
          accountId: 'system',
          type: 'info' as const,
          message: `Đã tạo chủ sở hữu "${owner.name}". Tiếp theo: thêm TK MT5 cho người này.`,
          time: 'Vừa xong',
          read: false,
        },
        ...state.notifications,
      ],
    }));
    return owner;
  },

  updateOwner: async (id, data) => {
    const prev = get().owners.find((o) => o.id === id);
    if (!prev) throw new Error('Không tìm thấy chủ sở hữu.');
    const nextName = data.name !== undefined ? data.name.trim() : prev.name;
    if (!nextName) throw new Error('Tên chủ sở hữu không được trống.');
    const nextKey = normalizeOwnerKeyLocal(nextName);
    if (nextKey === UNASSIGNED_KEY) throw new Error('Tên không hợp lệ.');
    if (
      get().owners.some(
        (o) => o.id !== id && normalizeOwnerKeyLocal(o.name) === nextKey
      )
    ) {
      throw new Error(`Tên "${nextName}" đã được dùng.`);
    }
    const updated: OwnerProfile = {
      ...prev,
      name: nextName,
      note: data.note !== undefined ? data.note.trim() : prev.note,
      updatedAt: new Date().toISOString(),
    };
    await saveOwnerToFirestore(updated);

    // Đổi tên → cập nhật ownerName trên mọi TK
    const rename = normalizeOwnerKeyLocal(prev.name) !== nextKey;
    let accounts = get().accounts;
    if (rename) {
      accounts = await Promise.all(
        get().accounts.map(async (acc) => {
          if (normalizeOwnerKeyLocal(acc.ownerName) !== normalizeOwnerKeyLocal(prev.name)) {
            return acc;
          }
          const next = { ...acc, ownerName: nextName };
          await saveAccountToFirestore(next);
          return next;
        })
      );
    }

    set({
      owners: get()
        .owners.map((o) => (o.id === id ? updated : o))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })),
      accounts,
    });
  },

  deleteOwner: async (id) => {
    const owner = get().owners.find((o) => o.id === id);
    if (!owner) throw new Error('Không tìm thấy chủ sở hữu.');
    const linked = get().accounts.filter(
      (a) => normalizeOwnerKeyLocal(a.ownerName) === normalizeOwnerKeyLocal(owner.name)
    );
    if (linked.length > 0) {
      throw new Error(
        `Không xóa được: còn ${linked.length} TK MT5 gắn với "${owner.name}". Xóa/chuyển TK trước.`
      );
    }
    await deleteOwnerFromFirestore(id);
    set((state) => ({
      owners: state.owners.filter((o) => o.id !== id),
      notifications: [
        {
          id: Date.now().toString(),
          accountId: 'system',
          type: 'warning' as const,
          message: `Đã xóa chủ sở hữu "${owner.name}".`,
          time: 'Vừa xong',
          read: false,
        },
        ...state.notifications,
      ],
    }));
  },

  createAccount: async (accountData) => {
    const id = String(accountData.id || '').trim();
    if (!id) {
      throw new Error('ID tài khoản không hợp lệ.');
    }
    // Chặn trùng ID tài khoản
    if (get().accounts.some((a) => a.id === id)) {
      throw new Error(`Tài khoản ID "${id}" đã tồn tại.`);
    }

    const ownerName = (accountData.ownerName || '').trim();
    if (!ownerName) {
      throw new Error('Phải chọn Chủ sở hữu trước khi tạo TK MT5.');
    }
    const ownerKey = normalizeOwnerKeyLocal(ownerName);
    const hasOwner = get().owners.some((o) => normalizeOwnerKeyLocal(o.name) === ownerKey);
    if (!hasOwner) {
      throw new Error(
        `Chủ sở hữu "${ownerName}" chưa được đăng ký. Vào Owners → Tạo chủ sở hữu trước.`
      );
    }
    // Chuẩn hóa casing theo registry
    const registryName =
      get().owners.find((o) => normalizeOwnerKeyLocal(o.name) === ownerKey)?.name || ownerName;

    const currency = normalizeCurrency(accountData.currency);
    const initialCapital = Number(accountData.initialCapital);
    if (!Number.isFinite(initialCapital) || initialCapital < 0) {
      throw new Error('Số vốn ban đầu không hợp lệ.');
    }
    const leverage = Math.max(1, Number(accountData.leverage) || 500);

    const stats = calculateStats([], initialCapital, []);
    const risk = calculateRiskScore(stats);

    const newAcc: TradingAccount = {
      ...accountData,
      id,
      currency,
      initialCapital,
      leverage,
      ownerName: registryName,
      accountName: (accountData.accountName || '').trim(),
      currentEquity: initialCapital,
      status: statusFromRisk(risk.label),
      stats,
      riskScore: risk.score,
      riskLabel: risk.label,
      riskColor: risk.color,
      subMetrics: risk.subMetrics,
      trades: [],
      capitalMoves: [],
      openPositions: [],
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
      `• <b>Chủ sở hữu:</b> ${newAcc.ownerName?.trim() || 'Chưa phân'}\n` +
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
    const init = Number(initialCapital) || 0;
    const targetEq = Number(currentEquity) || 0;

    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        // Đồng bộ capitalMoves để refreshEquity/load không ghi đè equity user set
        const capitalMoves = reconcileCapitalMovesToEquity(
          acc.capitalMoves || [],
          init,
          acc.trades || [],
          targetEq
        );
        updatedAccount = applyRiskToAccount(
          { ...acc, capitalMoves },
          acc.trades || [],
          init
        );
        // Đảm bảo equity khớp target (sau reconcile + làm tròn)
        if (updatedAccount && Math.abs(updatedAccount.currentEquity - targetEq) >= 0.01) {
          const again = reconcileCapitalMovesToEquity(
            updatedAccount.capitalMoves || [],
            init,
            updatedAccount.trades || [],
            targetEq
          );
          updatedAccount = refreshEquity({
            ...updatedAccount,
            capitalMoves: again,
          });
        }
        return updatedAccount!;
      });

      return { accounts };
    });

    // Lưu vào Firestore
    if (updatedAccount) {
      await saveAccountToFirestore(updatedAccount);
    }

    const targetAcc = get().accounts.find(a => a.id === id);
    const currency = targetAcc?.currency || 'USD';
    const mon = (n: number) =>
      currency === 'USD'
        ? `$${Number(n).toLocaleString()}`
        : `${Number(n).toLocaleString()} USC`;
    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: 'info' as const,
      message: `Đã cập nhật số vốn cho tài khoản ${id}. Số vốn ban đầu: ${mon(initialCapital)}, Vốn hiện tại: ${mon(currentEquity)}.`,
      time: 'Vừa xong',
      read: false
    };

    // Gửi Telegram
    const teleMsg = `💰 <b>[GoldQuant AI] Cập nhật vốn tài khoản</b>\n` +
      `• <b>Tài khoản:</b> <code>${id}</code>\n` +
      `• <b>Vốn ban đầu mới:</b> ${mon(initialCapital)}\n` +
      `• <b>Vốn hiện tại mới:</b> ${mon(currentEquity)}`;
    sendTelegramAlert(teleMsg);

    set((state) => ({
      notifications: [newNotification, ...state.notifications]
    }));
  },

  uploadHistory: async (id, parsedTrades) => {
    let updatedAccount: TradingAccount | null = null;
    let mergedCount = 0;

    if (!parsedTrades?.length) {
      set((state) => ({
        notifications: [
          {
            id: Date.now().toString(),
            accountId: id,
            type: 'critical' as const,
            message: `Không có lệnh hợp lệ trong file upload (TK ${id}).`,
            time: 'Vừa xong',
            read: false,
          },
          ...state.notifications,
        ],
      }));
      return;
    }

    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        const uniqueTrades = mergeTradeHistory(acc.trades || [], parsedTrades);
        mergedCount = uniqueTrades.length;
        updatedAccount = applyRiskToAccount(acc, uniqueTrades, acc.initialCapital);
        return updatedAccount!;
      });
      return { accounts };
    });

    if (updatedAccount) {
      try {
        await saveAccountToFirestore(updatedAccount);
      } catch (err) {
        console.error('[uploadHistory] Firestore save failed', err);
      }
    }

    const targetAcc = get().accounts.find((a) => a.id === id);
    const net = Math.round(
      parsedTrades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0) * 100
    ) / 100;
    const newNotification = {
      id: Date.now().toString(),
      accountId: id,
      type: 'info' as const,
      message: `Upload OK · +${parsedTrades.length} lệnh file · tổng ${mergedCount} lệnh · PnL file ${net >= 0 ? '+' : ''}${net} (TK ${id})`,
      time: 'Vừa xong',
      read: false,
    };

    if (targetAcc) {
      const stats = targetAcc.stats;
      const currency = targetAcc.currency;
      const profitFormatted =
        currency === 'USD'
          ? `$${stats.netProfit.toLocaleString()}`
          : `${stats.netProfit.toLocaleString()} USC`;
      const teleMsg =
        `📊 <b>[GoldQuant AI] Upload history OK</b>\n` +
        `• <b>TK:</b> <code>${id}</code>\n` +
        `• <b>Lệnh (file/tổng):</b> ${parsedTrades.length}/${stats.totalTrades}\n` +
        `• <b>Net PnL:</b> ${stats.netProfit >= 0 ? '+' : ''}${profitFormatted}\n` +
        `• <b>WR:</b> ${stats.winRate}% · <b>DD:</b> ${stats.maxDrawdown}%\n` +
        `• <b>Risk:</b> ${targetAcc.riskScore}/100 (${targetAcc.riskLabel})`;
      void sendTelegramAlert(teleMsg);
    }

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
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
        if (acc.id !== id) return acc;

        const prevCurrency = normalizeCurrency(acc.currency);
        const nextCurrency = updatedData.currency
          ? normalizeCurrency(updatedData.currency)
          : prevCurrency;

        let trades = acc.trades || [];
        let capitalMoves = acc.capitalMoves || [];
        let init =
          updatedData.initialCapital !== undefined
            ? Number(updatedData.initialCapital)
            : acc.initialCapital;

        // Đổi USD ↔ USC: scale PnL / nạp-rút / vốn để không làm sai stats
        if (prevCurrency !== nextCurrency) {
          const scaleMoney = (n: number) =>
            convertAmountBetweenCurrencies(n, prevCurrency, nextCurrency);

          trades = trades.map((t) => ({
            ...t,
            profit: scaleMoney(t.profit),
            commission: scaleMoney(t.commission),
            swap: scaleMoney(t.swap),
          }));
          capitalMoves = capitalMoves.map((m) => ({
            ...m,
            amount: scaleMoney(m.amount),
          }));
          // initialCapital từ form đã ở đơn vị mới; nếu không gửi → scale từ cũ
          if (updatedData.initialCapital === undefined) {
            init = scaleMoney(acc.initialCapital);
          }
        }

        if (!Number.isFinite(init) || init < 0) {
          init = acc.initialCapital;
        }

        const merged: TradingAccount = {
          ...acc,
          ...updatedData,
          // Không cho đổi id qua edit
          id: acc.id,
          currency: nextCurrency as AccountCurrency,
          initialCapital: init,
          ownerName:
            updatedData.ownerName !== undefined
              ? String(updatedData.ownerName || '').trim()
              : acc.ownerName,
          accountName:
            updatedData.accountName !== undefined
              ? String(updatedData.accountName || '').trim()
              : acc.accountName,
          leverage:
            updatedData.leverage !== undefined
              ? Math.max(1, Number(updatedData.leverage) || 1)
              : acc.leverage,
          capitalMoves,
          openPositions: acc.openPositions || [],
        };

        updatedAccount = applyRiskToAccount(merged, trades, init);
        return updatedAccount!;
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

  markAllNotificationsRead: () =>
    set((state) => {
      const notifications = state.notifications.map((n) => ({
        ...n,
        read: true,
      }));
      saveStoredNotifications(notifications);
      return { notifications };
    }),

  prependNotifications: (items) => {
    if (!items?.length) return;
    set((state) => {
      const ids = new Set(state.notifications.map((n) => n.id));
      const unique = items.filter((n) => !ids.has(n.id));
      if (!unique.length) return state;
      const notifications = [...unique, ...state.notifications].slice(0, 50);
      saveStoredNotifications(notifications);
      return { notifications };
    });
  },

  hydrateNotifications: () => {
    const stored = loadStoredNotifications();
    if (!stored.length) return;
    set((state) => {
      // Merge stored + current (tránh mất default nếu empty)
      const byId = new Map<string, NotifItem>();
      [...stored, ...state.notifications].forEach((n) => {
        if (!byId.has(n.id)) byId.set(n.id, n);
      });
      const notifications = Array.from(byId.values()).slice(0, 50);
      return { notifications };
    });
  },

  addCapitalMove: async (id, move) => {
    const amount = Number(move.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Số tiền nạp/rút phải > 0.');
    }
    if (move.type !== 'deposit' && move.type !== 'withdrawal') {
      throw new Error('Loại giao dịch vốn không hợp lệ.');
    }

    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        const entry: CapitalMove = {
          ...move,
          amount,
          id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
        };
        updated = refreshEquity({
          ...acc,
          capitalMoves: [...(acc.capitalMoves || []), entry],
        });
        return updated;
      });
      return {
        accounts,
        notifications: [
          {
            id: Date.now().toString(),
            accountId: id,
            type: 'info' as const,
            message: `${move.type === 'deposit' ? 'Nạp' : 'Rút'} ${amount} — equity đã cập nhật.`,
            time: 'Vừa xong',
            read: false,
          },
          ...state.notifications,
        ],
      };
    });
    if (updated) {
      await persist(updated);
      const m = move.type === 'deposit' ? '💰 Nạp' : '💸 Rút';
      sendTelegramAlert(
        `${m} <b>${amount}</b> · TK <code>${id}</code>${move.note ? `\n${move.note}` : ''}`
      );
    }
  },

  removeCapitalMove: async (id, moveId) => {
    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        updated = refreshEquity({
          ...acc,
          capitalMoves: (acc.capitalMoves || []).filter((m) => m.id !== moveId),
        });
        return updated;
      });
      return { accounts };
    });
    if (updated) await persist(updated);
  },

  addOpenPosition: async (id, pos) => {
    const volume = Number(pos.volume);
    const openPrice = Number(pos.openPrice);
    if (!Number.isFinite(volume) || volume <= 0) {
      throw new Error('Volume phải > 0.');
    }
    if (!Number.isFinite(openPrice) || openPrice <= 0) {
      throw new Error('Giá mở phải > 0.');
    }
    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        const entry: OpenPosition = {
          ...pos,
          volume,
          openPrice,
          currentPrice: Number(pos.currentPrice) > 0 ? Number(pos.currentPrice) : openPrice,
          type: pos.type === 'SELL' ? 'SELL' : 'BUY',
          id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        };
        updated = {
          ...acc,
          openPositions: [...(acc.openPositions || []), entry],
        };
        return updated;
      });
      return { accounts };
    });
    if (updated) await persist(updated);
  },

  removeOpenPosition: async (id, posId) => {
    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        updated = {
          ...acc,
          openPositions: (acc.openPositions || []).filter((p) => p.id !== posId),
        };
        return updated;
      });
      return { accounts };
    });
    if (updated) await persist(updated);
  },

  updateOpenPosition: async (id, posId, patch) => {
    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        updated = {
          ...acc,
          openPositions: (acc.openPositions || []).map((p) =>
            p.id === posId ? { ...p, ...patch } : p
          ),
        };
        return updated;
      });
      return { accounts };
    });
    if (updated) await persist(updated);
  },

  saveBotResearch: async (id, data) => {
    let updated: TradingAccount | null = null;
    set((state) => {
      const accounts = state.accounts.map((acc) => {
        if (acc.id !== id) return acc;
        const prev = acc.botResearch || {
          params: [],
          dailyPnl: [],
        };
        updated = {
          ...acc,
          botResearch: {
            ...prev,
            ...data,
            params: data.params !== undefined ? data.params : prev.params,
            dailyPnl: data.dailyPnl !== undefined ? data.dailyPnl : prev.dailyPnl,
            updatedAt: new Date().toISOString(),
          },
        };
        return updated;
      });
      return { accounts };
    });
    if (updated) await persist(updated);
  },
}));
