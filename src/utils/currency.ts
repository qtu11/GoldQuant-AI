/**
 * Currency Utility - Tỷ giá realtime USD/VND + quy đổi USC/USD
 *
 * Quy tắc:
 * - 100 USC (cent) = 1 USD
 * - Tỷ giá VND/USD: lấy realtime từ API
 */

// ==========================================
// QUY ĐỔI USC ↔ USD
// ==========================================
const USC_TO_USD_RATE = 0.01; // 1 USC = 0.01 USD => 100 USC = 1 USD

export type AccountCurrency = 'USD' | 'USC';

/**
 * Chuẩn hóa currency từ Firestore / form (tránh string lạ).
 */
export function normalizeCurrency(value: unknown): AccountCurrency {
  return String(value || '')
    .trim()
    .toUpperCase() === 'USC'
    ? 'USC'
    : 'USD';
}

/**
 * Chỉ loại tài khoản có chữ "cent" mới là USC.
 * (XM/FBS Micro ≠ cent account — không auto gán USC.)
 */
export function isCentAccountType(accountType: string): boolean {
  return String(accountType || '')
    .toLowerCase()
    .includes('cent');
}

export function defaultSymbolForCurrency(currency: AccountCurrency): string {
  return currency === 'USC' ? 'XAUUSDc' : 'XAUUSD';
}

/**
 * Chuyển từ USC sang USD
 */
export function uscToUsd(uscAmount: number): number {
  return uscAmount * USC_TO_USD_RATE;
}

/**
 * Chuyển từ USD sang USC
 */
export function usdToUsc(usdAmount: number): number {
  return usdAmount / USC_TO_USD_RATE;
}

/**
 * Đổi số tiền giữa USD ↔ USC (làm tròn 2 chữ số).
 */
export function convertAmountBetweenCurrencies(
  amount: number,
  from: AccountCurrency,
  to: AccountCurrency
): number {
  if (from === to) return amount;
  const n = Number(amount) || 0;
  const converted = from === 'USC' ? uscToUsd(n) : usdToUsc(n);
  return Math.round(converted * 100) / 100;
}

/**
 * Quy đổi giá trị tài khoản sang USD (dùng khi tài khoản là USC)
 * @param amount - Số tiền gốc
 * @param currency - Loại tiền tệ (USD hoặc USC)
 * @returns Giá trị tương đương bằng USD
 */
export function toUsd(amount: number, currency: AccountCurrency): number {
  if (currency === 'USC') return uscToUsd(amount);
  return amount;
}

/**
 * Format hiển thị tiền theo đơn vị
 */
export function formatCurrency(
  amount: number,
  currency: AccountCurrency,
  showSymbol = true
): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (showSymbol) {
    return currency === 'USD' ? `$${formatted}` : `${formatted} USC`;
  }
  return formatted;
}

// ==========================================
// TỶ GIÁ USD/VND REALTIME
// ==========================================
interface ExchangeRateCache {
  rate: number;
  timestamp: number;
  source: string;
}

let rateCache: ExchangeRateCache | null = null;
const CACHE_DURATION = 30 * 60 * 1000; // Cache 30 phút
const FALLBACK_RATE = 25_850; // Tỷ giá mặc định nếu API lỗi (cập nhật 07/2026)

/**
 * Lấy tỷ giá USD/VND realtime
 * Thử nhiều API source để đảm bảo luôn có dữ liệu
 */
export async function getUsdVndRate(): Promise<ExchangeRateCache> {
  // Kiểm tra cache
  if (rateCache && (Date.now() - rateCache.timestamp) < CACHE_DURATION) {
    return rateCache;
  }
  
  // Thử các API sources theo thứ tự ưu tiên
  const sources = [
    fetchFromExchangeRateApi,
    fetchFromOpenExchangeRates,
    fetchFromFrankfurter,
  ];
  
  for (const fetchFn of sources) {
    try {
      const result = await fetchFn();
      if (result && result.rate > 0) {
        rateCache = result;
        return result;
      }
    } catch (err) {
      console.warn('Exchange rate API failed, trying next source...', err);
    }
  }
  
  // Fallback: dùng tỷ giá mặc định
  const fallback: ExchangeRateCache = {
    rate: FALLBACK_RATE,
    timestamp: Date.now(),
    source: 'Fallback (offline)'
  };
  rateCache = fallback;
  return fallback;
}

// --- API Source 1: exchangerate-api.com (free, no key needed) ---
async function fetchFromExchangeRateApi(): Promise<ExchangeRateCache | null> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.rates?.VND) {
    return {
      rate: data.rates.VND,
      timestamp: Date.now(),
      source: 'ExchangeRate-API'
    };
  }
  return null;
}

// --- API Source 2: floatrates.com (backup khác domain) ---
async function fetchFromOpenExchangeRates(): Promise<ExchangeRateCache | null> {
  const res = await fetch('https://www.floatrates.com/daily/usd.json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const vnd = data?.vnd?.rate;
  if (typeof vnd === 'number' && vnd > 0) {
    return {
      rate: vnd,
      timestamp: Date.now(),
      source: 'FloatRates'
    };
  }
  return null;
}

// --- API Source 3: Frankfurter (ECB rates, free) ---
async function fetchFromFrankfurter(): Promise<ExchangeRateCache | null> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=VND', {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.rates?.VND) {
    return {
      rate: data.rates.VND,
      timestamp: Date.now(),
      source: 'Frankfurter (ECB)'
    };
  }
  return null;
}

/**
 * Chuyển đổi USD sang VND
 */
export function usdToVnd(usdAmount: number, rate: number): number {
  return usdAmount * rate;
}

/**
 * Format VND — dùng "VND" (ASCII) để tránh glyph ₫/đ lỗi font trên Windows.
 */
export function formatVnd(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || Math.abs(n) < 0.5) {
    return '0 VND';
  }
  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)} tỷ VND`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)} tr VND`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(0)}k VND`;
  }
  return `${Math.round(n).toLocaleString('en-US')} VND`;
}

/**
 * Format USD gọn cho KPI (primary hiển thị).
 */
export function formatUsd(amount: number, signed = false): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 0.005) return '$0';
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000
      ? `$${(abs / 1_000_000).toFixed(2)}M`
      : abs >= 10_000
        ? `$${Math.round(abs).toLocaleString('en-US')}`
        : `$${abs.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`;
  const sign = n < 0 ? '−' : signed ? '+' : '';
  return `${sign}${body}`;
}

/**
 * Format tỷ giá source label
 */
export function formatRateSource(cache: ExchangeRateCache): string {
  const date = new Date(cache.timestamp);
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${cache.source} · ${timeStr}`;
}
