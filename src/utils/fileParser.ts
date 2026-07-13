import { getTradingSession } from './sessions';
import * as XLSX from 'xlsx';

export interface Trade {
  ticket: string;
  openTime: string;
  closeTime: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  comment: string;
  session: 'Asia' | 'Europe' | 'US';
}

/** Nạp/rút parse từ dòng Balance/Credit MT5 (chưa có id — store gán) */
export interface ParsedCapitalMove {
  type: 'deposit' | 'withdrawal';
  amount: number;
  date: string;
  note?: string;
}

export interface ParseResult {
  trades: Trade[];
  capitalMoves: ParsedCapitalMove[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isEmptyRow(row: (string | number)[]): boolean {
  return !row || row.every((c) => c === '' || c === null || c === undefined);
}

function safeFloat(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let s = String(val).replace(/\s/g, '').replace(/[^\d,.\-]/g, '');
  // volume "0.01 / 0.01" → lấy phần đầu
  if (s.includes('/')) s = s.split('/')[0];
  if (!s || s === '-' || s === '.' || s === ',') return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0].replace(/\./g, '') + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeType(raw: string): 'BUY' | 'SELL' {
  const u = String(raw || '').toUpperCase().trim();
  if (u.includes('SELL') || u.includes('SHORT') || u === 'S') return 'SELL';
  return 'BUY';
}

function isBuySell(raw: string): boolean {
  const u = String(raw || '').toLowerCase().trim();
  return u === 'buy' || u === 'sell' || u === 'b' || u === 's';
}

/** Format civil time components (broker wall-clock, không phụ thuộc TZ browser) */
function formatCivil(
  yyyy: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): string {
  const MM = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const HH = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${yyyy}.${MM}.${dd} ${HH}:${mm}:${ss}`;
}

/** Excel serial → civil time UTC components (tránh shift timezone local) */
function excelSerialToCivil(serial: number): string {
  const whole = Math.floor(serial);
  const frac = serial - whole;
  const utcMs = Date.UTC(1899, 11, 30) + whole * 86400000;
  const d = new Date(utcMs);
  const totalSec = Math.round(frac * 86400);
  const hour = Math.floor(totalSec / 3600) % 24;
  const minute = Math.floor((totalSec % 3600) / 60);
  const second = totalSec % 60;
  return formatCivil(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    hour,
    minute,
    second
  );
}

function formatDate(date: Date): string {
  // Prefer UTC for ISO-origin dates to keep broker-like wall clock stable
  return formatCivil(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}

export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const str = String(dateStr).trim();
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  // Excel serial as string
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const civil = excelSerialToCivil(serial);
    // Parse as local-naive via components
    const m = civil.match(
      /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );
    if (m) {
      return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      );
    }
  }
  // MT5 style: 2026.07.09 23:18:00 — parse as local civil (không Z)
  const mt5 = str.match(
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (mt5) {
    return new Date(
      Number(mt5[1]),
      Number(mt5[2]) - 1,
      Number(mt5[3]),
      Number(mt5[4] || 0),
      Number(mt5[5] || 0),
      Number(mt5[6] || 0)
    );
  }
  const normalized = str.replace(/\./g, '/');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  return new Date(str);
}

function normalizeTime(raw: string | number | Date | undefined | null): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (raw instanceof Date) {
    // cellDates from xlsx — use UTC components (serial was UTC-based)
    return formatCivil(
      raw.getUTCFullYear(),
      raw.getUTCMonth() + 1,
      raw.getUTCDate(),
      raw.getUTCHours(),
      raw.getUTCMinutes(),
      raw.getUTCSeconds()
    );
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 100000) {
    return excelSerialToCivil(raw);
  }
  const str = String(raw).trim();
  if (!str) return '';
  if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(str)) {
    // already 2026.07.09 23:18:00 — giữ wall-clock, chỉ chuẩn hóa separator
    return str
      .replace(/\//g, '.')
      .replace(/-/g, (m, offset) => (offset > 4 ? m : '.'))
      .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, (_, y, mo, d) => {
        return `${y}.${mo.padStart(2, '0')}.${d.padStart(2, '0')}`;
      });
  }
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    return excelSerialToCivil(parseFloat(str));
  }
  const d = parseDate(str);
  if (!isNaN(d.getTime())) return formatDate(d);
  return str;
}

function isTimeLike(s: string): boolean {
  return /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(String(s || '').trim());
}

/** Decode text buffer: UTF-16 LE/BE BOM hoặc UTF-8 */
export function decodeTextBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(u8.subarray(2));
  }
  // UTF-16 LE without BOM (lots of null bytes)
  if (u8.length > 8) {
    let zeros = 0;
    for (let i = 1; i < Math.min(u8.length, 200); i += 2) {
      if (u8[i] === 0) zeros++;
    }
    if (zeros > 40) return new TextDecoder('utf-16le').decode(u8);
  }
  return new TextDecoder('utf-8').decode(u8);
}

function sortTrades(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const da = parseDate(a.closeTime || a.openTime).getTime();
    const db = parseDate(b.closeTime || b.openTime).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return da - db;
  });
}

// ─────────────────────────────────────────────
// Header / section detection
// ─────────────────────────────────────────────

type TableKind = 'positions' | 'deals' | 'orders' | 'unknown';

function headerScore(row: (string | number)[]): number {
  const lower = row.map((c) => String(c || '').toLowerCase().trim());
  const keys = [
    'thời gian',
    'time',
    'symbol',
    'loai',
    'loại',
    'type',
    'khối lượng',
    'volume',
    'giá',
    'price',
    'lợi nhuận',
    'profit',
    'hoán đổi',
    'swap',
    'phí',
    'commission',
    'hướng',
    'direction',
    'giao dịch',
    'deal',
    'lệnh',
    'order',
  ];
  return keys.filter((k) => lower.some((h) => h.includes(k))).length;
}

function isHeaderRow(row: (string | number)[]): boolean {
  return headerScore(row) >= 4;
}

function detectTableKind(headers: string[]): TableKind {
  const lower = headers.map((h) => h.toLowerCase().trim());
  if (lower.some((h) => h.includes('hướng') || h === 'direction' || h === 'entry/exit')) {
    return 'deals';
  }
  if (
    lower.some(
      (h) =>
        h.includes('nhà nước') ||
        h.includes('state') ||
        h === 'filled' ||
        h.includes('market')
    )
  ) {
    return 'orders';
  }
  const times = lower.filter((h) => h.includes('thời gian') || h === 'time').length;
  const prices = lower.filter((h) => h === 'giá' || h === 'price').length;
  if (times >= 2 && prices >= 2) return 'positions';
  if (
    lower.some((h) => h.includes('lợi nhuận') || h.includes('profit')) &&
    lower.some((h) => h.includes('symbol'))
  ) {
    return 'positions';
  }
  return 'unknown';
}

function isSectionTitle(row: (string | number)[]): boolean {
  if (!row || !row.length) return false;
  const first = String(row[0] || '').trim();
  if (!first) return false;
  const restEmpty = row.slice(1).every((c) => c === '' || c === null || c === undefined);
  if (!restEmpty) return false;
  const l = first.toLowerCase();
  return (
    /^(deals|orders|positions)$/i.test(first) ||
    l.includes('các lệnh') ||
    l.includes('kết quả') ||
    l.includes('giao dịch') ||
    l.includes('positions') ||
    l.includes('orders') ||
    l.includes('deals') ||
    l.includes('số dư sụt giảm') ||
    l.includes('summary')
  );
}

// ─────────────────────────────────────────────
// Positions parser (Open/Close time + price)
// ─────────────────────────────────────────────

interface PosMap {
  openTime: number;
  ticket: number;
  symbol: number;
  type: number;
  volume: number;
  openPrice: number;
  closeTime: number;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number;
  comment: number;
}

function buildPositionsMap(headers: string[]): PosMap {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const timeIdx: number[] = [];
  const priceIdx: number[] = [];
  lower.forEach((h, i) => {
    if (h.includes('thời gian') || h === 'time') timeIdx.push(i);
    if (h === 'giá' || h === 'price') priceIdx.push(i);
  });
  const find = (...keys: string[]) =>
    lower.findIndex((h) => keys.some((k) => h === k || h.includes(k)));

  return {
    openTime: timeIdx[0] ?? 0,
    ticket: find('lệnh', 'order', 'ticket', 'deal') >= 0 ? find('lệnh', 'order', 'ticket', 'deal') : 1,
    symbol: find('symbol', 'instrument') >= 0 ? find('symbol', 'instrument') : 2,
    type: find('loai', 'loại', 'type') >= 0 ? find('loai', 'loại', 'type') : 3,
    volume: find('khối lượng', 'volume', 'lot') >= 0 ? find('khối lượng', 'volume', 'lot') : 4,
    openPrice: priceIdx[0] ?? 5,
    closeTime: timeIdx[1] ?? 8,
    closePrice: priceIdx[1] ?? 9,
    commission: find('phí', 'commission', 'comm') >= 0 ? find('phí', 'commission', 'comm') : 10,
    swap: find('hoán đổi', 'swap') >= 0 ? find('hoán đổi', 'swap') : 11,
    profit: find('lợi nhuận', 'profit') >= 0 ? find('lợi nhuận', 'profit') : 12,
    comment: find('bình luận', 'comment', 'note'),
  };
}

/** Ô volume phải là số thuần (0.01), không phải comment "CCBSN|...|0|1" */
function looksLikeVolumeCell(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  // Comment thường có chữ hoặc dấu |
  if (/[a-zA-Z|]/.test(s)) return false;
  const v = safeFloat(s);
  return v > 0 && v < 500;
}

/**
 * HTML MT5 đôi khi chèn cột Comment ngay sau Type dù header không có —
 * làm lệch Volume/Giá/Close. Detect từ dòng data đầu.
 */
function adjustPositionsMapForData(
  map: PosMap,
  sample: (string | number)[]
): PosMap {
  if (looksLikeVolumeCell(sample[map.volume])) return map;

  // Thử shift +1 (comment xen giữa type và volume)
  if (
    looksLikeVolumeCell(sample[map.volume + 1]) &&
    safeFloat(sample[map.openPrice + 1]) > 50
  ) {
    return {
      ...map,
      comment: map.volume,
      volume: map.volume + 1,
      openPrice: map.openPrice + 1,
      closeTime: map.closeTime + 1,
      closePrice: map.closePrice + 1,
      commission: map.commission + 1,
      swap: map.swap + 1,
      profit: map.profit + 1,
    };
  }
  return map;
}

function parsePositionsRows(
  rows: (string | number)[][],
  headerIdx: number,
  headers: string[]
): Trade[] {
  let map = buildPositionsMap(headers);
  const trades: Trade[] = [];

  // Hiệu chỉnh map theo dòng data đầu tiên hợp lệ
  for (let j = headerIdx + 1; j < Math.min(headerIdx + 15, rows.length); j++) {
    const r = rows[j];
    if (isEmptyRow(r) || isSectionTitle(r)) continue;
    const t = String(r[map.type] ?? '').trim();
    if (isBuySell(t) && isTimeLike(normalizeTime(r[map.openTime]))) {
      map = adjustPositionsMapForData(map, r);
      break;
    }
  }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    if (isSectionTitle(row)) break;
    if (isHeaderRow(row)) break;

    const typeRaw = String(row[map.type] ?? '').trim();
    if (!isBuySell(typeRaw)) continue;

    const openTime = normalizeTime(row[map.openTime]);
    if (!isTimeLike(openTime)) continue;

    const closeTime = normalizeTime(row[map.closeTime]) || openTime;
    const volume = Math.abs(safeFloat(row[map.volume]));
    const openPrice = safeFloat(row[map.openPrice]);
    const closePrice = safeFloat(row[map.closePrice]);
    const profit = safeFloat(row[map.profit]);
    const commission = safeFloat(row[map.commission]);
    const swap = safeFloat(row[map.swap]);
    // Lọc dòng lệch cột (openPrice quá nhỏ / closeTime không phải giờ)
    if (openPrice > 0 && openPrice < 10) continue;
    if (volume <= 0 && profit === 0) continue;
    if (!isTimeLike(closeTime) && closePrice < 10) continue;

    const ticket = String(row[map.ticket] ?? `P${i}`).trim();
    const symbol = String(row[map.symbol] ?? 'XAUUSD').trim() || 'XAUUSD';
    const comment =
      map.comment >= 0 ? String(row[map.comment] ?? '').trim() : '';

    trades.push({
      ticket,
      openTime,
      closeTime,
      symbol,
      type: normalizeType(typeRaw),
      volume: volume || 0.01,
      openPrice,
      closePrice,
      profit,
      commission,
      swap,
      comment,
      session: getTradingSession(openTime),
    });
  }
  return trades;
}

// ─────────────────────────────────────────────
// Deals parser (in/out → ghép LIFO)
// ─────────────────────────────────────────────

interface DealMap {
  time: number;
  deal: number;
  symbol: number;
  type: number;
  dir: number;
  volume: number;
  price: number;
  order: number;
  commission: number;
  swap: number;
  profit: number;
  comment: number;
}

function buildDealsMap(headers: string[]): DealMap {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...keys: string[]) => {
    for (const k of keys) {
      const i = lower.findIndex((h) => h === k || h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  // 2 cột "Phí" — commission thường cột đầu
  const feeIdxs = lower.reduce<number[]>((a, h, i) => {
    if (h.includes('phí') || h.includes('commission') || h === 'fee' || h === 'phi') a.push(i);
    return a;
  }, []);

  return {
    time: find('thời gian', 'time') >= 0 ? find('thời gian', 'time') : 0,
    deal: find('giao dịch', 'deal') >= 0 ? find('giao dịch', 'deal') : 1,
    symbol: find('symbol') >= 0 ? find('symbol') : 2,
    type: find('loai', 'loại', 'type') >= 0 ? find('loai', 'loại', 'type') : 3,
    dir: find('hướng', 'direction', 'entry') >= 0 ? find('hướng', 'direction', 'entry') : 4,
    volume: find('khối lượng', 'volume', 'lot') >= 0 ? find('khối lượng', 'volume', 'lot') : 5,
    price: find('giá', 'price') >= 0 ? find('giá', 'price') : 6,
    order: find('lệnh đặt', 'order', 'position') >= 0 ? find('lệnh đặt', 'order', 'position') : 7,
    commission: feeIdxs[0] ?? 8,
    swap: find('hoán đổi', 'swap') >= 0 ? find('hoán đổi', 'swap') : 10,
    profit: find('lợi nhuận', 'profit') >= 0 ? find('lợi nhuận', 'profit') : 11,
    comment: find('bình luận', 'comment', 'note'),
  };
}

interface OpenDeal {
  time: string;
  deal: string;
  order: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price: number;
  commission: number;
  swap: number;
  comment: string;
  symbol: string;
}

function parseDealsRows(
  rows: (string | number)[][],
  headerIdx: number,
  headers: string[]
): { trades: Trade[]; capitalMoves: ParsedCapitalMove[] } {
  const map = buildDealsMap(headers);
  const longStack: OpenDeal[] = [];
  const shortStack: OpenDeal[] = [];
  const trades: Trade[] = [];
  const capitalMoves: ParsedCapitalMove[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    if (isSectionTitle(row)) break;
    if (isHeaderRow(row)) break;

    const typeRaw = String(row[map.type] ?? '').trim().toLowerCase();
    // Balance / Credit / Deposit / Withdrawal → capital moves (không bỏ)
    if (
      typeRaw === 'balance' ||
      typeRaw === 'credit' ||
      typeRaw.includes('deposit') ||
      typeRaw.includes('withdraw') ||
      typeRaw === 'nạp' ||
      typeRaw === 'rút'
    ) {
      const time = normalizeTime(row[map.time]);
      const profit = safeFloat(row[map.profit]);
      const amt = Math.abs(profit);
      if (amt > 0 && isTimeLike(time)) {
        const comment =
          map.comment >= 0 ? String(row[map.comment] ?? '').trim() : '';
        const isWd =
          typeRaw.includes('withdraw') ||
          typeRaw === 'rút' ||
          profit < 0;
        capitalMoves.push({
          type: isWd ? 'withdrawal' : 'deposit',
          amount: amt,
          date: time.slice(0, 10).replace(/\./g, '-'),
          note: comment || typeRaw,
        });
      }
      continue;
    }
    if (!isBuySell(typeRaw)) continue;

    const dirRaw = String(row[map.dir] ?? '').trim().toLowerCase();
    // MT5: in / out / in/out / out by / localized
    const isInOut =
      /in\s*\/\s*out|inout|in-out/.test(dirRaw) || dirRaw === 'in/out';
    const isIn =
      !isInOut &&
      (dirRaw === 'in' ||
        dirRaw === 'entry' ||
        dirRaw === 'vào' ||
        dirRaw === 'vao' ||
        dirRaw.startsWith('in '));
    const isOut =
      !isInOut &&
      (dirRaw === 'out' ||
        dirRaw === 'exit' ||
        dirRaw === 'ra' ||
        dirRaw.startsWith('out') ||
        dirRaw.includes('out by'));
    if (!isIn && !isOut && !isInOut) continue;

    const time = normalizeTime(row[map.time]);
    if (!isTimeLike(time)) continue;

    const side = normalizeType(typeRaw);
    let remainingOut = Math.abs(safeFloat(row[map.volume]));
    const price = safeFloat(row[map.price]);
    const deal = String(row[map.deal] ?? '').trim();
    const order = String(row[map.order] ?? '').trim();
    const commission = safeFloat(row[map.commission]);
    const swap = safeFloat(row[map.swap]);
    const profit = safeFloat(row[map.profit]);
    const comment =
      map.comment >= 0 ? String(row[map.comment] ?? '').trim() : '';
    const symbol = String(row[map.symbol] ?? 'XAUUSD').trim() || 'XAUUSD';

    if (remainingOut <= 0) continue;

    // in/out (close+reverse): đóng stack đối diện trước, phần dư mở mới
    if (isInOut) {
      const stack = side === 'BUY' ? shortStack : longStack;
      let matched = 0;
      let openComm = 0;
      let openSwap = 0;
      let openTime = time;
      let openPrice = price;
      let openType: 'BUY' | 'SELL' = side === 'BUY' ? 'SELL' : 'BUY';
      let openTicket = order || deal || `D${i}`;
      let openSymbol = symbol;
      let openComment = comment;
      let volLeft = remainingOut;

      while (volLeft > 1e-8 && stack.length) {
        const open = stack.pop()!;
        const take = Math.min(open.volume, volLeft);
        matched += take;
        openComm += open.commission * (take / open.volume);
        openSwap += open.swap * (take / open.volume);
        openTime = open.time;
        openPrice = open.price;
        openType = open.type;
        openTicket = open.order || open.deal || openTicket;
        openSymbol = open.symbol || openSymbol;
        openComment = open.comment || openComment;
        const left = open.volume - take;
        if (left > 1e-8) {
          stack.push({
            ...open,
            volume: left,
            commission: 0,
            swap: 0,
          });
        }
        volLeft -= take;
      }

      if (matched > 1e-8) {
        const ratio = matched / remainingOut;
        trades.push({
          ticket: openTicket,
          openTime,
          closeTime: time,
          symbol: openSymbol,
          type: openType,
          volume: Math.round(matched * 100) / 100,
          openPrice,
          closePrice: price,
          profit: profit * ratio,
          commission: openComm + commission * ratio,
          swap: openSwap + swap * ratio,
          comment: comment || openComment,
          session: getTradingSession(openTime),
        });
      }
      // Residual volume → open new position
      if (volLeft > 1e-8) {
        const od: OpenDeal = {
          time,
          deal,
          order,
          type: side,
          volume: volLeft,
          price,
          commission: 0,
          swap: 0,
          comment,
          symbol,
        };
        if (side === 'BUY') longStack.push(od);
        else shortStack.push(od);
      }
      continue;
    }

    if (isIn) {
      const od: OpenDeal = {
        time,
        deal,
        order,
        type: side,
        volume: remainingOut,
        price,
        commission,
        swap,
        comment,
        symbol,
      };
      if (side === 'BUY') longStack.push(od);
      else shortStack.push(od);
      continue;
    }

    // OUT — LIFO partial close (Exness hedge)
    // buy out đóng short; sell out đóng long
    const stack = side === 'BUY' ? shortStack : longStack;
    let outLeft = remainingOut;
    let profitLeft = profit;
    let commLeft = commission;
    let swapLeft = swap;

    while (outLeft > 1e-8 && stack.length) {
      const open = stack.pop()!;
      const take = Math.min(open.volume, outLeft);
      const openShare = take / Math.max(open.volume, 1e-12);
      const isLast = outLeft - take <= 1e-8 || stack.length === 0;
      const volRatio = take / remainingOut;
      const sliceProfit = isLast ? profitLeft : profit * volRatio;
      const sliceComm = isLast
        ? open.commission * openShare + commLeft
        : open.commission * openShare + commission * volRatio;
      const sliceSwap = isLast
        ? open.swap * openShare + swapLeft
        : open.swap * openShare + swap * volRatio;

      if (!isLast) {
        profitLeft -= sliceProfit;
        commLeft -= commission * volRatio;
        swapLeft -= swap * volRatio;
      }

      trades.push({
        ticket: open.order || order || open.deal || deal || `D${i}`,
        openTime: open.time,
        closeTime: time,
        symbol: open.symbol || symbol,
        type: open.type,
        volume: Math.round(take * 100) / 100,
        openPrice: open.price,
        closePrice: price,
        profit: Math.round(sliceProfit * 100) / 100,
        commission: Math.round(sliceComm * 100) / 100,
        swap: Math.round(sliceSwap * 100) / 100,
        comment: comment || open.comment,
        session: getTradingSession(open.time),
      });

      const left = open.volume - take;
      if (left > 1e-8) {
        stack.push({
          ...open,
          volume: left,
          commission: 0,
          swap: 0,
        });
      }
      outLeft -= take;
    }
  }

  return { trades, capitalMoves };
}

// ─────────────────────────────────────────────
// Unified sheet/table parse
// ─────────────────────────────────────────────

function parseTableMatrix(rows: (string | number)[][]): ParseResult {
  if (!rows?.length) return { trades: [], capitalMoves: [] };

  let positions: Trade[] = [];
  let deals: Trade[] = [];
  let capitalMoves: ParsedCapitalMove[] = [];

  let i = 0;
  while (i < rows.length) {
    if (!isHeaderRow(rows[i])) {
      i++;
      continue;
    }
    const headers = rows[i].map((c) => String(c ?? '').trim());
    const kind = detectTableKind(headers);

    if (kind === 'positions') {
      const t = parsePositionsRows(rows, i, headers);
      if (t.length > positions.length) positions = t;
      i++;
      while (i < rows.length && !isSectionTitle(rows[i]) && !isHeaderRow(rows[i])) i++;
      continue;
    }

    if (kind === 'deals') {
      const d = parseDealsRows(rows, i, headers);
      if (d.trades.length > deals.length) {
        deals = d.trades;
        // Ưu tiên capital moves từ block deals lớn hơn
        if (d.capitalMoves.length >= capitalMoves.length) {
          capitalMoves = d.capitalMoves;
        }
      } else if (d.capitalMoves.length > capitalMoves.length) {
        capitalMoves = d.capitalMoves;
      }
      i++;
      while (i < rows.length && !isSectionTitle(rows[i]) && !isHeaderRow(rows[i])) i++;
      continue;
    }

    i++;
    while (i < rows.length && !isSectionTitle(rows[i]) && !isHeaderRow(rows[i])) i++;
  }

  // Positions ưu tiên cho trades; capital moves luôn từ deals nếu có
  const trades =
    positions.length > 0 ? sortTrades(positions) : sortTrades(deals);
  return { trades, capitalMoves };
}

// ─────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────

export function parseExcel(buffer: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    let best: ParseResult = { trades: [], capitalMoves: [] };

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
      }) as (string | number)[][];
      const parsed = parseTableMatrix(data);
      if (
        parsed.trades.length > best.trades.length ||
        (parsed.trades.length === best.trades.length &&
          parsed.capitalMoves.length > best.capitalMoves.length)
      ) {
        best = parsed;
      }
    }
    return best;
  } catch (err) {
    console.error('Excel parsing error:', err);
    return { trades: [], capitalMoves: [] };
  }
}

// ─────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 10).join('\n');
  const tabCount = (firstLines.match(/\t/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semiCount = (firstLines.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && !inQuotes) inQuotes = true;
    else if (char === '"' && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = false;
    } else if (char === delimiter && !inQuotes) {
      result.push(cur);
      cur = '';
    } else cur += char;
  }
  result.push(cur);
  return result.map((c) => c.trim());
}

export function parseCSV(csvText: string): ParseResult {
  if (!csvText?.trim()) return { trades: [], capitalMoves: [] };
  const delimiter = detectDelimiter(csvText);
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { trades: [], capitalMoves: [] };
  const rows = lines.map((l) => parseCSVLine(l, delimiter));
  return parseTableMatrix(rows);
}

// ─────────────────────────────────────────────
// HTML (UTF-16 OK nếu đã decode; không phụ thuộc DOMParser)
// ─────────────────────────────────────────────

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tách mọi <table> → matrix ô */
function htmlTablesToMatrices(html: string): (string | number)[][][] {
  const tables: (string | number)[][][] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const body = tm[1];
    const rows: (string | number)[][] = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trm: RegExpExecArray | null;
    while ((trm = trRe.exec(body))) {
      const cells: string[] = [];
      const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(trm[1]))) {
        cells.push(stripTags(cm[1]));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length >= 2) tables.push(rows);
  }
  return tables;
}

export function parseHTML(htmlText: string): ParseResult {
  if (!htmlText?.trim()) return { trades: [], capitalMoves: [] };
  try {
    let best: ParseResult = { trades: [], capitalMoves: [] };
    const pick = (p: ParseResult) => {
      if (
        p.trades.length > best.trades.length ||
        (p.trades.length === best.trades.length &&
          p.capitalMoves.length > best.capitalMoves.length)
      ) {
        best = p;
      }
    };
    const matrices = htmlTablesToMatrices(htmlText);
    for (const matrix of matrices) {
      pick(parseTableMatrix(matrix));
    }
    if (best.trades.length) return best;

    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const tables = doc.querySelectorAll('table');
      for (const table of Array.from(tables)) {
        const rows: (string | number)[][] = [];
        table.querySelectorAll('tr').forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
            (c.textContent || '').trim()
          );
          if (cells.length) rows.push(cells);
        });
        pick(parseTableMatrix(rows));
      }
    }
    return best;
  } catch (err) {
    console.error('HTML parsing error:', err);
    return { trades: [], capitalMoves: [] };
  }
}

// ─────────────────────────────────────────────
// Universal API
// ─────────────────────────────────────────────

export type SupportedFileType = 'csv' | 'html' | 'excel' | 'txt' | 'unknown';

export function detectFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  if (name.endsWith('.csv') || mimeType === 'text/csv') return 'csv';
  if (name.endsWith('.tsv') || mimeType === 'text/tab-separated-values') return 'csv';
  if (name.endsWith('.txt') || mimeType === 'text/plain') return 'txt';
  if (name.endsWith('.htm') || name.endsWith('.html') || mimeType === 'text/html') return 'html';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mimeType.includes('spreadsheet') ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  return 'unknown';
}

export function getAcceptedFileTypes(): string {
  return '.csv,.txt,.tsv,.html,.htm,.xlsx,.xls';
}

export function getFileTypeLabel(fileType: SupportedFileType): string {
  switch (fileType) {
    case 'csv':
      return 'CSV';
    case 'txt':
      return 'Text';
    case 'html':
      return 'HTML (MT5)';
    case 'excel':
      return 'Excel';
    default:
      return 'Unknown';
  }
}

function isHTMLContent(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.startsWith('<!doctype') ||
    t.startsWith('<html') ||
    t.includes('<table') ||
    (t.includes('<tr') && t.includes('<td'))
  );
}

/**
 * Parse file content → trades + capitalMoves (Balance/Credit).
 * - Excel: ArrayBuffer
 * - HTML/CSV/TXT: string hoặc ArrayBuffer (UTF-16 OK)
 */
export async function parseFile(
  content: string | ArrayBuffer,
  fileType: SupportedFileType
): Promise<ParseResult> {
  if (fileType === 'excel') {
    const buf =
      content instanceof ArrayBuffer
        ? content
        : new TextEncoder().encode(content).buffer;
    return parseExcel(buf);
  }

  const text =
    typeof content === 'string' ? content : decodeTextBuffer(content);

  if (fileType === 'html' || isHTMLContent(text)) {
    const html = parseHTML(text);
    if (html.trades.length > 0 || html.capitalMoves.length > 0) return html;
  }

  if (isHTMLContent(text)) {
    const html = parseHTML(text);
    if (html.trades.length > 0 || html.capitalMoves.length > 0) return html;
  }

  return parseCSV(text);
}
