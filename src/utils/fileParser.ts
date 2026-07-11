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

// ==========================================
// EXNESS MT5 REPORT FORMAT (TIẾNG VIỆT)
// ==========================================
// Row 6 header: Thời gian | Lệnh có trạng thái | Symbol | Loai | Khối lượng | Giá | S / L | T / P | Thời gian | Giá | Phí | Hoán đổi | Lợi nhuận
// Index:           0              1                  2       3        4          5      6       7        8          9     10      11         12
//               openTime        ticket            symbol   type    volume   openPrice  sl     tp    closeTime  closePrice comm   swap      profit

// ENGLISH VERSION:
// Time | Order | Symbol | Type | Volume | Price | S / L | T / P | Time | Price | Commission | Swap | Profit

// ==========================================
// COLUMN ALIASES - hỗ trợ cả tiếng Việt & English
// ==========================================
const HEADER_KEYWORDS_VI = ['thời gian', 'lệnh', 'symbol', 'loai', 'loại', 'khối lượng', 'giá', 'phí', 'hoán đổi', 'lợi nhuận'];
const HEADER_KEYWORDS_EN = ['time', 'ticket', 'order', 'deal', 'symbol', 'type', 'volume', 'lot', 'price', 'commission', 'swap', 'profit'];

function isHeaderRow(row: (string | number)[]): boolean {
  const lower = row.map(c => String(c || '').toLowerCase().trim());
  const matchVI = HEADER_KEYWORDS_VI.filter(k => lower.some(c => c.includes(k))).length;
  const matchEN = HEADER_KEYWORDS_EN.filter(k => lower.some(c => c.includes(k))).length;
  return matchVI >= 3 || matchEN >= 3;
}

function isSummaryRow(row: (string | number)[]): boolean {
  const first = String(row[0] || '').toLowerCase().trim();
  const skipKeywords = [
    'total', 'summary', 'balance', 'kết quả', 'tổng', 'hệ số', 'số dư', 'số lượng',
    'trung bình', 'lớn nhất', 'giao dịch có lãi', 'giao dịch thua', 'giao dịch mua',
    'giao dịch bán', 'lợi nhuận ròng', 'tổng lợi nhuận', 'hệ số lợi nhuận',
    'hệ số phục hồi', 'tỷ số sharpe', 'closed p/l', 'floating p/l',
    'credit', 'deposit', 'withdrawal', 'báo cáo', 'tên', 'tài khoản', 'công ty', 'ngày',
    'trang thai', 'trạng thái', 'cân bằng', 'credit facility', 'lời/ lỗ', 'tiền vốn',
    'mức lợi nhuận', 'mức lỗ'
  ];
  return skipKeywords.some(k => first.includes(k));
}

function isEmptyRow(row: (string | number)[]): boolean {
  return row.every(c => c === '' || c === null || c === undefined);
}

function isSectionDivider(row: (string | number)[]): boolean {
  if (!row || row.length === 0) return false;
  const firstCell = String(row[0] || '').trim();
  if (!firstCell) return false;
  
  // Kiểm tra xem các cột còn lại có trống không (đặc trưng của section header)
  const isRestEmpty = row.slice(1).every(c => c === '' || c === null || c === undefined);
  if (!isRestEmpty) return false;
  
  const dividerKeywords = [
    'các lệnh đặt', 'orders', 'deals', 'giao dịch', 'kết quả', 'summary', 
    'số dư sụt giảm', 'drawdown', 'trang thai', 'trạng thái', 'positions'
  ];
  const lower = firstCell.toLowerCase();
  return dividerKeywords.some(k => lower.includes(k) || k.includes(lower));
}

// ==========================================
// EXNESS-SPECIFIC COLUMN PARSER
// ==========================================
// Exness MT5 có format đặc biệt: 2 cột "Thời gian" (open & close), 2 cột "Giá" (open & close)
// Phải parse theo VỊ TRÍ CỘT thay vì theo tên vì có cột trùng tên

interface ExnessColumnMap {
  openTime: number;
  ticket: number;
  symbol: number;
  type: number;
  volume: number;
  openPrice: number;
  sl: number;
  tp: number;
  closeTime: number;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number;
}

function buildExnessColumnMap(headers: string[]): ExnessColumnMap | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  
  // Kiểm tra format Exness tiếng Việt: "Thời gian" xuất hiện 2 lần, "Giá" xuất hiện 2 lần
  const timeIndices = lower.reduce<number[]>((acc, h, i) => {
    if (h.includes('thời gian') || h === 'time') acc.push(i);
    return acc;
  }, []);
  
  const priceIndices = lower.reduce<number[]>((acc, h, i) => {
    if (h === 'giá' || h === 'price') acc.push(i);
    return acc;
  }, []);
  
  // Nếu đúng format Exness (có 2 cột thời gian hoặc 2 cột giá)
  if (timeIndices.length >= 2 || priceIndices.length >= 2) {
    // Format Exness standard: 
    // Col0=OpenTime, Col1=OrderID, Col2=Symbol, Col3=Type, Col4=Volume, Col5=OpenPrice, 
    // Col6=SL, Col7=TP, Col8=CloseTime, Col9=ClosePrice, Col10=Commission, Col11=Swap, Col12=Profit
    
    const ticketIdx = lower.findIndex(h => h.includes('lệnh') || h.includes('order') || h.includes('deal') || h.includes('ticket'));
    const symbolIdx = lower.findIndex(h => h.includes('symbol') || h.includes('instrument'));
    const typeIdx = lower.findIndex(h => h.includes('loai') || h.includes('loại') || h === 'type' || h === 'direction');
    const volumeIdx = lower.findIndex(h => h.includes('khối lượng') || h.includes('volume') || h.includes('lot'));
    const commIdx = lower.findIndex(h => h.includes('phí') || h.includes('commission') || h.includes('fee'));
    const swapIdx = lower.findIndex(h => h.includes('hoán đổi') || h.includes('swap'));
    const profitIdx = lower.findIndex(h => h.includes('lợi nhuận') || h.includes('profit'));
    
    return {
      openTime: timeIndices[0] ?? 0,
      ticket: ticketIdx !== -1 ? ticketIdx : 1,
      symbol: symbolIdx !== -1 ? symbolIdx : 2,
      type: typeIdx !== -1 ? typeIdx : 3,
      volume: volumeIdx !== -1 ? volumeIdx : 4,
      openPrice: priceIndices[0] ?? 5,
      sl: lower.findIndex(h => h.includes('s / l') || h.includes('s/l') || h === 'sl'),
      tp: lower.findIndex(h => h.includes('t / p') || h.includes('t/p') || h === 'tp'),
      closeTime: timeIndices[1] ?? 8,
      closePrice: priceIndices[1] ?? 9,
      commission: commIdx !== -1 ? commIdx : 10,
      swap: swapIdx !== -1 ? swapIdx : 11,
      profit: profitIdx !== -1 ? profitIdx : 12,
    };
  }
  
  return null; // Không phải format Exness
}

// ==========================================
// GENERIC COLUMN MAP (cho CSV/non-Exness)
// ==========================================
interface GenericColumnMap {
  ticket: number;
  openTime: number;
  closeTime: number;
  symbol: number;
  type: number;
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  comment: number;
}

const GENERIC_ALIASES: Record<keyof GenericColumnMap, string[]> = {
  ticket: ['ticket', 'order', 'deal', 'position', '#', 'id', 'lệnh', 'lệnh có trạng thái'],
  openTime: ['open time', 'opentime', 'time', 'open date', 'entry time', 'thời gian'],
  closeTime: ['close time', 'closetime', 'close date', 'exit time'],
  symbol: ['symbol', 'instrument', 'pair', 'asset'],
  type: ['type', 'direction', 'side', 'action', 'loai', 'loại'],
  volume: ['volume', 'lot', 'lots', 'size', 'quantity', 'khối lượng'],
  openPrice: ['open price', 'openprice', 'entry price', 'price', 'giá'],
  closePrice: ['close price', 'closeprice', 'exit price'],
  profit: ['profit', 'p/l', 'pnl', 'net profit', 'result', 'lợi nhuận'],
  commission: ['commission', 'comm', 'fee', 'phí'],
  swap: ['swap', 'rollover', 'hoán đổi'],
  comment: ['comment', 'note', 'expert', 'remark']
};

function buildGenericColumnMap(headers: string[]): GenericColumnMap {
  const lower = headers.map(h => h.toLowerCase().trim());
  
  const findIdx = (field: keyof GenericColumnMap): number => {
    const aliases = GENERIC_ALIASES[field];
    for (const alias of aliases) {
      const idx = lower.findIndex(h => h === alias || h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  
  return {
    ticket: findIdx('ticket'),
    openTime: findIdx('openTime'),
    closeTime: findIdx('closeTime'),
    symbol: findIdx('symbol'),
    type: findIdx('type'),
    volume: findIdx('volume'),
    openPrice: findIdx('openPrice'),
    closePrice: findIdx('closePrice'),
    profit: findIdx('profit'),
    commission: findIdx('commission'),
    swap: findIdx('swap'),
    comment: findIdx('comment'),
  };
}

// ==========================================
// VALUE HELPERS
// ==========================================
function safeFloat(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/\s/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeType(raw: string): 'BUY' | 'SELL' {
  const upper = String(raw || '').toUpperCase().trim();
  if (upper.includes('SELL') || upper.includes('SHORT') || upper === 'S') return 'SELL';
  return 'BUY';
}

function isTradeType(raw: string): boolean {
  const upper = String(raw || '').toUpperCase().trim();
  const nonTradeTypes = ['BALANCE', 'CREDIT', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'BONUS', 'CORRECTION',
    'NẠP TIỀN', 'RÚT TIỀN', 'CÂN BẰNG', 'TIỀN VỐN', 'LỜI', 'CREDIT FACILITY'];
  return !nonTradeTypes.some(t => upper.includes(t));
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}.${MM}.${dd} ${HH}:${mm}:${ss}`;
}

export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const str = String(dateStr).trim();
  
  // Nếu là ISOString (chứa 'T')
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Định dạng yyyy.MM.dd HH:mm:ss hoặc tương tự
  const normalized = str.replace(/\./g, '/');
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  
  return new Date(str);
}

function normalizeTime(raw: string | number | Date | undefined | null): string {
  if (!raw) return '';
  if (raw instanceof Date) return formatDate(raw);
  const str = String(raw).trim();
  if (!str) return '';
  
  // Excel serial date
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    return formatDate(date);
  }
  
  // ISOString hoặc chuỗi Date standard khác
  if (str.includes('T') || str.includes('-')) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }
  
  return str;
}

// ==========================================
// EXNESS ROW → TRADE
// ==========================================
function exnessRowToTrade(row: (string | number)[], colMap: ExnessColumnMap, idx: number): Trade | null {
  if (!row || isEmptyRow(row)) return null;
  
  const openTimeRaw = String(row[colMap.openTime] || '').trim();
  const typeRaw = String(row[colMap.type] || '').trim();
  
  // Bỏ qua nếu không có thời gian mở lệnh hoặc type không phải trade
  if (!openTimeRaw || !typeRaw) return null;
  if (!isTradeType(typeRaw)) return null;
  
  // Normalize thời gian trước khi kiểm tra regex format năm
  const openTime = normalizeTime(openTimeRaw);
  const closeTime = normalizeTime(row[colMap.closeTime]) || openTime;
  
  // Bỏ qua nếu openTime không bắt đầu bằng năm (format: 2026.xx.xx)
  if (!/^\d{4}[.\-/]/.test(openTime)) return null;
  
  const ticket = String(row[colMap.ticket] || `T${idx}`).trim();
  const symbol = String(row[colMap.symbol] || 'XAUUSD').trim();
  const type = normalizeType(typeRaw);
  const volume = Math.abs(safeFloat(row[colMap.volume]));
  const openPrice = safeFloat(row[colMap.openPrice]);
  const closePrice = safeFloat(row[colMap.closePrice]);
  const commission = safeFloat(row[colMap.commission]);
  const swap = safeFloat(row[colMap.swap]);
  const profit = safeFloat(row[colMap.profit]);
  
  // Bỏ qua nếu volume = 0 và profit = 0 (likely metadata row)
  if (volume === 0 && profit === 0 && openPrice === 0) return null;
  
  const session = getTradingSession(openTime);
  
  return {
    ticket,
    openTime,
    closeTime,
    symbol,
    type,
    volume: volume || 0.01,
    openPrice,
    closePrice,
    profit,
    commission,
    swap,
    comment: '',
    session,
  };
}

// ==========================================
// GENERIC ROW → TRADE
// ==========================================
function genericRowToTrade(row: (string | number)[], colMap: GenericColumnMap, idx: number): Trade | null {
  if (!row || isEmptyRow(row)) return null;
  
  const first = String(row[0] || '').toLowerCase().trim();
  if (isSummaryRow(row)) return null;
  
  const ticketRaw = colMap.ticket !== -1 ? String(row[colMap.ticket] || '') : '';
  const openTimeRaw = colMap.openTime !== -1 ? normalizeTime(row[colMap.openTime]) : '';
  const typeRaw = colMap.type !== -1 ? String(row[colMap.type] || '') : '';
  
  if (!openTimeRaw && !ticketRaw) return null;
  if (typeRaw && !isTradeType(typeRaw)) return null;
  
  const ticket = ticketRaw || `T${Date.now()}${idx}`;
  const openTime = openTimeRaw || new Date().toISOString();
  const closeTime = colMap.closeTime !== -1 ? (normalizeTime(row[colMap.closeTime]) || openTime) : openTime;
  const symbol = colMap.symbol !== -1 ? String(row[colMap.symbol] || 'XAUUSD').trim() : 'XAUUSD';
  const type = normalizeType(typeRaw || 'BUY');
  const volume = Math.abs(safeFloat(colMap.volume !== -1 ? row[colMap.volume] : 0.01));
  const openPrice = safeFloat(colMap.openPrice !== -1 ? row[colMap.openPrice] : 0);
  const closePrice = safeFloat(colMap.closePrice !== -1 ? row[colMap.closePrice] : 0);
  const profit = safeFloat(colMap.profit !== -1 ? row[colMap.profit] : 0);
  const commission = safeFloat(colMap.commission !== -1 ? row[colMap.commission] : 0);
  const swap = safeFloat(colMap.swap !== -1 ? row[colMap.swap] : 0);
  const comment = colMap.comment !== -1 ? String(row[colMap.comment] || '').trim() : '';
  
  if (volume === 0 && profit === 0 && openPrice === 0) return null;
  
  const session = getTradingSession(openTime);
  
  return {
    ticket,
    openTime,
    closeTime,
    symbol,
    type,
    volume: volume || 0.01,
    openPrice,
    closePrice,
    profit,
    commission,
    swap,
    comment,
    session,
  };
}

// ==========================================
// EXCEL PARSER (.xlsx / .xls)
// ==========================================
export function parseExcel(buffer: ArrayBuffer): Trade[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const trades: Trade[] = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      
      if (data.length < 2) continue;
      
      // Tìm header row
      let headerRowIdx = -1;
      let headers: string[] = [];
      
      for (let i = 0; i < Math.min(20, data.length); i++) {
        if (isHeaderRow(data[i])) {
          headerRowIdx = i;
          headers = data[i].map(c => String(c || '').trim());
          break;
        }
      }
      
      if (headerRowIdx === -1) continue;
      
      // Thử Exness format trước
      const exnessMap = buildExnessColumnMap(headers);
      
      if (exnessMap) {
        // Parse theo format Exness
        for (let i = headerRowIdx + 1; i < data.length; i++) {
          if (isSectionDivider(data[i])) break;
          if (isEmptyRow(data[i]) || isSummaryRow(data[i])) continue;
          const trade = exnessRowToTrade(data[i], exnessMap, i);
          if (trade) trades.push(trade);
        }
      } else {
        // Fallback: generic column map
        const genericMap = buildGenericColumnMap(headers);
        for (let i = headerRowIdx + 1; i < data.length; i++) {
          if (isSectionDivider(data[i])) break;
          if (isEmptyRow(data[i]) || isSummaryRow(data[i])) continue;
          const trade = genericRowToTrade(data[i], genericMap, i);
          if (trade) trades.push(trade);
        }
      }
      
      if (trades.length > 0) break;
    }
    
    return sortTrades(trades);
  } catch (err) {
    console.error('Excel parsing error:', err);
    return [];
  }
}

// ==========================================
// CSV PARSER
// ==========================================
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
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(csvText: string): Trade[] {
  if (!csvText || csvText.trim() === '') return [];
  
  const delimiter = detectDelimiter(csvText);
  const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  
  // Tìm header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const cells = lines[i].split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    if (isHeaderRow(cells)) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) return [];
  
  const headers = lines[headerIdx].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
  
  // Thử Exness format
  const exnessMap = buildExnessColumnMap(headers);
  const trades: Trade[] = [];
  
  if (exnessMap) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i], delimiter);
      if (isSectionDivider(row)) break;
      if (isSummaryRow(row)) continue;
      const trade = exnessRowToTrade(row, exnessMap, i);
      if (trade) trades.push(trade);
    }
  } else {
    const genericMap = buildGenericColumnMap(headers);
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i], delimiter);
      if (isSectionDivider(row)) break;
      if (isSummaryRow(row)) continue;
      const trade = genericRowToTrade(row, genericMap, i);
      if (trade) trades.push(trade);
    }
  }
  
  return sortTrades(trades);
}

// ==========================================
// HTML PARSER (MT5 Export)
// ==========================================
export function parseHTML(htmlText: string): Trade[] {
  if (!htmlText || htmlText.trim() === '') return [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const tables = doc.querySelectorAll('table');
    if (tables.length === 0) return [];
    
    const trades: Trade[] = [];
    
    for (const table of Array.from(tables)) {
      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) continue;
      
      let headerRowIdx = -1;
      let headers: string[] = [];
      
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const cells = rows[i].querySelectorAll('th, td');
        const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
        if (isHeaderRow(cellTexts)) {
          headerRowIdx = i;
          headers = cellTexts;
          break;
        }
      }
      
      if (headerRowIdx === -1) continue;
      
      const exnessMap = buildExnessColumnMap(headers);
      
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const row = Array.from(cells).map(c => (c.textContent || '').trim());
        if (isSectionDivider(row)) break;
        if (isSummaryRow(row) || isEmptyRow(row)) continue;
        
        if (exnessMap) {
          const trade = exnessRowToTrade(row, exnessMap, i);
          if (trade) trades.push(trade);
        } else {
          const genericMap = buildGenericColumnMap(headers);
          const trade = genericRowToTrade(row, genericMap, i);
          if (trade) trades.push(trade);
        }
      }
    }
    
    if (trades.length > 0) return sortTrades(trades);
    
    // Fallback: pre blocks
    const preBlocks = doc.querySelectorAll('pre');
    for (const pre of Array.from(preBlocks)) {
      const text = pre.textContent || '';
      if (text.trim()) {
        const result = parseCSV(text);
        if (result.length > 0) return result;
      }
    }
    
    return [];
  } catch (err) {
    console.error('HTML parsing error:', err);
    return [];
  }
}

// ==========================================
// UNIVERSAL FILE PARSER
// ==========================================
export type SupportedFileType = 'csv' | 'html' | 'excel' | 'txt' | 'unknown';

export function detectFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  if (name.endsWith('.csv') || mimeType === 'text/csv') return 'csv';
  if (name.endsWith('.tsv') || mimeType === 'text/tab-separated-values') return 'csv';
  if (name.endsWith('.txt') || mimeType === 'text/plain') return 'txt';
  if (name.endsWith('.htm') || name.endsWith('.html') || mimeType === 'text/html') return 'html';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || 
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel') return 'excel';
  
  return 'unknown';
}

export function getAcceptedFileTypes(): string {
  return '.csv,.txt,.tsv,.html,.htm,.xlsx,.xls';
}

export function getFileTypeLabel(fileType: SupportedFileType): string {
  switch (fileType) {
    case 'csv': return 'CSV';
    case 'txt': return 'Text';
    case 'html': return 'HTML (MT5)';
    case 'excel': return 'Excel';
    default: return 'Unknown';
  }
}

function isHTMLContent(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || 
         trimmed.startsWith('<html') || 
         trimmed.startsWith('<table') ||
         (trimmed.includes('<tr') && trimmed.includes('<td'));
}

export async function parseFile(content: string | ArrayBuffer, fileType: SupportedFileType): Promise<Trade[]> {
  if (fileType === 'excel' && content instanceof ArrayBuffer) {
    return parseExcel(content);
  }
  
  const text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
  
  if (fileType === 'html' || isHTMLContent(text)) {
    const htmlResult = parseHTML(text);
    if (htmlResult.length > 0) return htmlResult;
    return parseCSV(text);
  }
  
  if (fileType === 'csv' || fileType === 'txt' || fileType === 'unknown') {
    if (isHTMLContent(text)) {
      const htmlResult = parseHTML(text);
      if (htmlResult.length > 0) return htmlResult;
    }
    return parseCSV(text);
  }
  
  return parseCSV(text);
}

// ==========================================
// SORT
// ==========================================
function sortTrades(trades: Trade[]): Trade[] {
  return trades.sort((a, b) => {
    try {
      const dateA = parseDate(a.openTime).getTime();
      const dateB = parseDate(b.openTime).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateA - dateB;
    } catch {
      return 0;
    }
  });
}
