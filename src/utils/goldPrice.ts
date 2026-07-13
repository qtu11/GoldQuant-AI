/**
 * Realtime XAU (Gold) price feed — server & client safe helpers.
 * Primary: gold-api.com (free, no key)
 * Fallback: metals-api style / optional GOLDAPI_IO_KEY
 */

export interface GoldQuote {
  symbol: string;
  priceUsd: number;
  currency: string;
  source: string;
  updatedAt: string; // ISO
  updatedAtReadable: string;
  change24hPct?: number | null;
  bid?: number | null;
  ask?: number | null;
  stale: boolean;
}

let cache: { quote: GoldQuote; fetchedAt: number } | null = null;
const CACHE_MS = 45_000; // 45s — đủ realtime cho chat, tránh spam API

async function fetchFromGoldApiCom(): Promise<GoldQuote | null> {
  const res = await fetch('https://api.gold-api.com/price/XAU', {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) return null;
  const data = await res.json();
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: 'XAUUSD',
    priceUsd: Math.round(price * 100) / 100,
    currency: data.currency || 'USD',
    source: 'Gold-API.com',
    updatedAt: data.updatedAt || new Date().toISOString(),
    updatedAtReadable: data.updatedAtReadable || 'vừa xong',
    change24hPct: null,
    bid: null,
    ask: null,
    stale: false,
  };
}

/** Optional paid/more precise feed */
async function fetchFromGoldApiIo(): Promise<GoldQuote | null> {
  const key = process.env.GOLDAPI_IO_KEY || process.env.GOLD_API_KEY;
  if (!key) return null;

  const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
    signal: AbortSignal.timeout(8000),
    headers: {
      'x-access-token': key,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const price = Number(data.price ?? data.price_gram_24k);
  // goldapi returns price per ounce typically as data.price
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    symbol: 'XAUUSD',
    priceUsd: Math.round(price * 100) / 100,
    currency: 'USD',
    source: 'GoldAPI.io',
    updatedAt: data.timestamp
      ? new Date(data.timestamp * 1000).toISOString()
      : new Date().toISOString(),
    updatedAtReadable: 'live',
    change24hPct:
      typeof data.chp === 'number' ? Math.round(data.chp * 100) / 100 : null,
    bid: typeof data.bid === 'number' ? data.bid : null,
    ask: typeof data.ask === 'number' ? data.ask : null,
    stale: false,
  };
}

/** Free metals.live — không key */
async function fetchFromMetalsLive(): Promise<GoldQuote | null> {
  const res = await fetch('https://api.metals.live/v1/spot/gold', {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  // format: [[timestamp, price], ...] or { price }
  let price = 0;
  if (Array.isArray(data) && data.length) {
    const last = data[data.length - 1];
    price = Number(Array.isArray(last) ? last[1] : last?.price);
  } else {
    price = Number(data?.price ?? data?.gold ?? data?.[0]);
  }
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol: 'XAUUSD',
    priceUsd: Math.round(price * 100) / 100,
    currency: 'USD',
    source: 'metals.live',
    updatedAt: new Date().toISOString(),
    updatedAtReadable: 'live',
    change24hPct: null,
    bid: null,
    ask: null,
    stale: false,
  };
}

/** Frankfurter-style: không có gold. Dùng metals-api.com free demo nếu có */
async function fetchFromMetalpriceApi(): Promise<GoldQuote | null> {
  const key = process.env.METALPRICE_API_KEY;
  const url = key
    ? `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=XAU`
    : null;
  if (!url) return null;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  // rates.XAU often = oz per 1 USD → invert
  const xau = Number(data?.rates?.XAU);
  if (!Number.isFinite(xau) || xau <= 0) return null;
  const price = xau < 10 ? 1 / xau : xau; // heuristic
  if (!Number.isFinite(price) || price < 100 || price > 20000) return null;
  return {
    symbol: 'XAUUSD',
    priceUsd: Math.round(price * 100) / 100,
    currency: 'USD',
    source: 'MetalpriceAPI',
    updatedAt: new Date().toISOString(),
    updatedAtReadable: 'live',
    change24hPct: null,
    bid: null,
    ask: null,
    stale: false,
  };
}

/**
 * Lấy giá vàng realtime (cache ngắn).
 * Dùng trên server (AI route) hoặc gọi qua /api/quant/gold-price.
 */
export async function getLiveGoldQuote(force = false): Promise<GoldQuote> {
  const now = Date.now();
  // Cache còn hạn → fresh (không gắn stale:true nhầm)
  if (!force && cache && now - cache.fetchedAt < CACHE_MS) {
    return { ...cache.quote, stale: false };
  }

  const sources = [
    fetchFromGoldApiCom,
    fetchFromGoldApiIo,
    fetchFromMetalsLive,
    fetchFromMetalpriceApi,
  ];
  for (const fn of sources) {
    try {
      const q = await fn();
      if (q) {
        cache = { quote: q, fetchedAt: Date.now() };
        return { ...q, stale: false };
      }
    } catch (err) {
      // DNS / network — log gọn, không spam stack
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[goldPrice] ${fn.name} failed:`, msg.slice(0, 120));
    }
  }

  // Hết hạn / fetch fail → dùng cache cũ, đánh stale
  if (cache) {
    return {
      ...cache.quote,
      stale: true,
      updatedAtReadable: `cache cũ (${cache.quote.source})`,
    };
  }

  // Offline fallback — đánh dấu rõ không phải live
  return {
    symbol: 'XAUUSD',
    priceUsd: 0,
    currency: 'USD',
    source: 'Unavailable',
    updatedAt: new Date().toISOString(),
    updatedAtReadable: 'không lấy được giá live',
    change24hPct: null,
    bid: null,
    ask: null,
    stale: true,
  };
}

/** Block text inject vào system prompt / user context cho Gemini */
export function formatGoldQuoteForAI(q: GoldQuote): string {
  if (!q.priceUsd) {
    return (
      `[THỊ TRƯỜNG VÀNG — KHÔNG CÓ DỮ LIỆU LIVE]\n` +
      `Hệ thống không lấy được giá XAU realtime. ` +
      `KHÔNG được bịa giá cụ thể. Hãy nói rõ là thiếu feed và chỉ tư vấn risk/kỹ thuật chung.`
    );
  }

  const ch =
    q.change24hPct != null
      ? ` · Biến động ~24h: ${q.change24hPct >= 0 ? '+' : ''}${q.change24hPct}%`
      : '';
  const ba =
    q.bid != null && q.ask != null
      ? ` · Bid ${q.bid} / Ask ${q.ask}`
      : '';

  return (
    `[DỮ LIỆU THỊ TRƯỜNG VÀNG REALTIME — BẮT BUỘC DÙNG KHI TRẢ LỜI VỀ GIÁ]\n` +
    `• Cặp: ${q.symbol}\n` +
    `• Giá spot: $${q.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / oz USD\n` +
    `• Nguồn: ${q.source}\n` +
    `• Cập nhật: ${q.updatedAt} (${q.updatedAtReadable})${ch}${ba}\n` +
    `• Trạng thái: ${q.stale ? 'cache ngắn (<1 phút)' : 'mới fetch'}\n` +
    `QUY TẮC: Khi Chủ tịch hỏi giá vàng / XAU / spot / hiện tại bao nhiêu — ` +
    `PHẢI trích đúng con số trên, nêu nguồn + thời gian. ` +
    `CẤM dùng kiến thức huấn luyện cũ (2023/2024) làm giá hiện tại. ` +
    `Có thể quy đổi ước lượng: 1 oz ≈ 31.1035g; giá VND = USD × tỷ giá nếu có.`
  );
}

export function isGoldPriceQuestion(text: string): boolean {
  const t = (text || '').toLowerCase();
  const keys = [
    'giá vàng',
    'gia vang',
    'xau',
    'xauusd',
    'gold price',
    'spot gold',
    'vàng đang',
    'vang dang',
    'giá xau',
    'giá spot',
    'bao nhiêu một lượng',
    'giá oz',
    'giá ounce',
    'kim loại quý',
  ];
  return keys.some((k) => t.includes(k));
}
