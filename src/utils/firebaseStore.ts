import { db } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { TradingAccount } from '../store/useTradingStore';

const ACCOUNTS_COLLECTION = 'accounts';
const LOCAL_STORAGE_KEY = 'goldquant_accounts';

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
export async function fetchAccountsFromFirestore(): Promise<TradingAccount[]> {
  try {
    const querySnapshot = await getDocs(collection(db, ACCOUNTS_COLLECTION));
    const accounts: TradingAccount[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      accounts.push({
        id: docSnap.id,
        broker: data.broker || '',
        platform: data.platform || 'MT5',
        server: data.server || '',
        symbol: data.symbol || 'XAUUSD',
        accountType: data.accountType || '',
        currency: data.currency || 'USD',
        initialCapital: Number(data.initialCapital || 0),
        currentEquity: Number(data.currentEquity || 0),
        accountName: data.accountName || '',
        leverage: Number(data.leverage || 500),
        status: data.status || 'Healthy',
        stats: data.stats || {
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
        },
        riskScore: Number(data.riskScore || 50),
        riskLabel: data.riskLabel || 'MODERATE',
        riskColor: data.riskColor || '#f5b61b',
        subMetrics: data.subMetrics || {
          profitability: 50,
          stability: 50,
          riskControl: 50,
          capitalEff: 50,
          consistency: 50,
          recovery: 50
        },
        trades: data.trades || []
      });
    });
    
    // Đồng bộ ngược lại Local Storage làm backup
    if (accounts.length > 0) {
      saveLocalStorageAccounts(accounts);
    }
    
    return accounts;
  } catch (error: any) {
    console.warn('Firebase Firestore access blocked or failed. Falling back to Local Storage data...', error.message || error);
    // Trả về dữ liệu từ local storage
    return getLocalStorageAccounts();
  }
}

/**
 * Lưu hoặc cập nhật tài khoản giao dịch trên Firestore
 */
export async function saveAccountToFirestore(account: TradingAccount, allAccounts: TradingAccount[] = []): Promise<boolean> {
  // 1. Luôn lưu vào Local Storage trước làm backup
  let currentLocalAccs = getLocalStorageAccounts();
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
      leverage: account.leverage || 500,
      status: account.status,
      stats: account.stats,
      riskScore: account.riskScore,
      riskLabel: account.riskLabel,
      riskColor: account.riskColor,
      subMetrics: account.subMetrics,
      trades: account.trades
    }, { merge: true });
    
    return true;
  } catch (error: any) {
    console.warn(`Failed to save account ${account.id} to Firestore. Local Storage saved.`, error.message || error);
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
  } catch (error: any) {
    console.warn(`Failed to delete account ${id} from Firestore. Local Storage updated.`, error.message || error);
    return false;
  }
}
