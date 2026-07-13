import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { TradingAccount, type OwnerProfile } from '../store/useTradingStore';
import { normalizeCurrency } from './currency';

const ACCOUNTS_COLLECTION = 'accounts';
const OWNERS_COLLECTION = 'owners';
const LOCAL_STORAGE_KEY = 'goldquant_accounts';
const LOCAL_OWNERS_KEY = 'goldquant_owners';

/**
 * Lấy dữ liệu dự phòng từ Local Storage
 */
function getLocalStorageAccounts(): TradingAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
    return [];
  }
}

/**
 * Lưu dữ liệu dự phòng xuống Local Storage
 */
function saveLocalStorageAccounts(accounts: TradingAccount[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
}

/**
 * Lấy toàn bộ tài khoản giao dịch từ Firestore (hoặc Local Storage nếu lỗi)
 */
function mapAccountDoc(docSnap: { id: string; data: () => Record<string, unknown> }): TradingAccount {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    broker: String(data.broker || ''),
    platform: String(data.platform || 'MT5'),
    server: String(data.server || ''),
    symbol: String(data.symbol || 'XAUUSD'),
    accountType: String(data.accountType || ''),
    currency: normalizeCurrency(data.currency),
    initialCapital: Number(data.initialCapital || 0),
    currentEquity: Number(data.currentEquity || 0),
    accountName: String(data.accountName || ''),
    ownerName: typeof data.ownerName === 'string' ? data.ownerName : '',
    leverage: Math.max(1, Number(data.leverage || 500) || 500),
    status: (data.status as TradingAccount['status']) || 'Healthy',
    stats: (data.stats as TradingAccount['stats']) || {
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
        US: { trades: 0, profit: 0, volume: 0 },
      },
    },
    riskScore: Number(data.riskScore || 50),
    riskLabel: String(data.riskLabel || 'MODERATE'),
    riskColor: String(data.riskColor || '#f5b61b'),
    subMetrics: (data.subMetrics as TradingAccount['subMetrics']) || {
      profitability: 50,
      stability: 50,
      riskControl: 50,
      capitalEff: 50,
      consistency: 50,
      recovery: 50,
    },
    trades: (data.trades as TradingAccount['trades']) || [],
    capitalMoves: (data.capitalMoves as TradingAccount['capitalMoves']) || [],
    openPositions: (data.openPositions as TradingAccount['openPositions']) || [],
    botResearch: (data.botResearch as TradingAccount['botResearch']) || undefined,
  };
}

/** Ước độ “mới/đầy” của account — ưu tiên bản nhiều lệnh / equity mới hơn */
function accountRichness(a: TradingAccount): number {
  const trades = a.trades?.length || 0;
  const moves = a.capitalMoves?.length || 0;
  const pos = a.openPositions?.length || 0;
  return trades * 1000 + moves * 10 + pos + Math.abs(a.currentEquity || 0) * 0.0001;
}

/**
 * Merge cloud + local: cloud empty → local; cùng id → bản richer thắng
 * (tránh wipe local khi cloud stale/empty sau write fail).
 */
function mergeAccountsPreferRicher(
  cloud: TradingAccount[],
  local: TradingAccount[]
): TradingAccount[] {
  if (!cloud.length && local.length) return local;
  if (!local.length) return cloud;

  const map = new Map<string, TradingAccount>();
  cloud.forEach((a) => map.set(a.id, a));
  local.forEach((a) => {
    const existing = map.get(a.id);
    if (!existing || accountRichness(a) > accountRichness(existing)) {
      map.set(a.id, a);
    }
  });
  // Local-only ids
  return Array.from(map.values());
}

export async function fetchAccountsFromFirestore(): Promise<TradingAccount[]> {
  const local = getLocalStorageAccounts();
  try {
    const querySnapshot = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    const accounts: TradingAccount[] = [];

    querySnapshot.forEach((docSnap) => {
      accounts.push(mapAccountDoc(docSnap as { id: string; data: () => Record<string, unknown> }));
    });

    // Cloud rỗng nhưng local còn data → giữ local (không clobber)
    if (accounts.length === 0 && local.length > 0) {
      console.warn(
        '[accounts] Firestore empty but localStorage has data — keeping local & will re-sync on next save.'
      );
      return local;
    }

    const merged = mergeAccountsPreferRicher(accounts, local);
    if (merged.length > 0) {
      saveLocalStorageAccounts(merged);
    }
    return merged;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('Firebase Firestore access blocked or failed. Falling back to Local Storage data...', msg);
    return local;
  }
}

/**
 * Lưu hoặc cập nhật tài khoản giao dịch trên Firestore
 */
export async function saveAccountToFirestore(account: TradingAccount): Promise<boolean> {
  // 1. Luôn lưu vào Local Storage trước làm backup
  const currentLocalAccs = getLocalStorageAccounts();
  const existsIdx = currentLocalAccs.findIndex(a => a.id === account.id);
  if (existsIdx !== -1) {
    currentLocalAccs[existsIdx] = account;
  } else {
    currentLocalAccs.push(account);
  }
  saveLocalStorageAccounts(currentLocalAccs);

  // 2. Cố gắng ghi lên Firebase Firestore
  try {
    const docRef = doc(db, ACCOUNTS_COLLECTION, account.id);
    await setDoc(docRef, {
      broker: account.broker,
      platform: account.platform,
      server: account.server,
      symbol: account.symbol,
      accountType: account.accountType,
      currency: account.currency,
      initialCapital: account.initialCapital,
      currentEquity: account.currentEquity,
      accountName: account.accountName || '',
      ownerName: (account.ownerName || '').trim(),
      leverage: account.leverage || 500,
      status: account.status,
      stats: account.stats,
      riskScore: account.riskScore,
      riskLabel: account.riskLabel,
      riskColor: account.riskColor,
      subMetrics: account.subMetrics,
      trades: account.trades,
      capitalMoves: account.capitalMoves || [],
      openPositions: account.openPositions || [],
      botResearch: account.botResearch || null,
    }, { merge: true });
    
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to save account ${account.id} to Firestore. Local Storage saved.`, msg);
    return false;
  }
}

/**
 * Xóa tài khoản khỏi Firestore
 */
export async function deleteAccountFromFirestore(id: string): Promise<boolean> {
  // 1. Xóa khỏi Local Storage trước
  const currentLocalAccs = getLocalStorageAccounts().filter(a => a.id !== id);
  saveLocalStorageAccounts(currentLocalAccs);

  // 2. Xóa khỏi Firebase
  try {
    const docRef = doc(db, ACCOUNTS_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to delete account ${id} from Firestore. Local Storage updated.`, msg);
    return false;
  }
}

// ========== OWNERS (chủ sở hữu — entity độc lập) ==========

function getLocalStorageOwners(): OwnerProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_OWNERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageOwners(owners: OwnerProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_OWNERS_KEY, JSON.stringify(owners));
  } catch (e) {
    console.error('Failed to write owners to localStorage:', e);
  }
}

/** Log 1 lần / session — tránh spam console khi rules chưa mở collection `owners` */
let ownersFsWarned = false;
function warnOwnersFsOnce(context: string, error: unknown) {
  if (ownersFsWarned) return;
  ownersFsWarned = true;
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(
    `[owners] Firestore ${context} failed → localStorage only. ` +
      `Mở rules cho collection "owners" nếu cần sync cloud. (${msg})`
  );
}

export async function fetchOwnersFromFirestore(): Promise<OwnerProfile[]> {
  try {
    const querySnapshot = await getDocs(collection(db, OWNERS_COLLECTION));
    const owners: OwnerProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      owners.push({
        id: docSnap.id,
        name: String(data.name || '').trim() || docSnap.id,
        note: typeof data.note === 'string' ? data.note : '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
      });
    });
    if (owners.length > 0) saveLocalStorageOwners(owners);
    return owners;
  } catch (error: unknown) {
    warnOwnersFsOnce('read', error);
    return getLocalStorageOwners();
  }
}

export async function saveOwnerToFirestore(owner: OwnerProfile): Promise<boolean> {
  const list = getLocalStorageOwners();
  const idx = list.findIndex((o) => o.id === owner.id);
  if (idx >= 0) list[idx] = owner;
  else list.push(owner);
  saveLocalStorageOwners(list);

  try {
    await setDoc(
      doc(db, OWNERS_COLLECTION, owner.id),
      {
        name: owner.name,
        note: owner.note || '',
        createdAt: owner.createdAt,
        updatedAt: owner.updatedAt,
      },
      { merge: true }
    );
    return true;
  } catch (error: unknown) {
    warnOwnersFsOnce('write', error);
    // localStorage đã lưu — UX vẫn OK offline
    return false;
  }
}

export async function deleteOwnerFromFirestore(id: string): Promise<boolean> {
  saveLocalStorageOwners(getLocalStorageOwners().filter((o) => o.id !== id));
  try {
    await deleteDoc(doc(db, OWNERS_COLLECTION, id));
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to delete owner ${id}`, msg);
    return false;
  }
}
