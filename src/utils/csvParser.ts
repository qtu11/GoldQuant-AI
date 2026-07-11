import { getTradingSession } from './sessions';

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

export function parseCSV(csvText: string): Trade[] {
  const trades: Trade[] = [];
  if (!csvText || csvText.trim() === '') return trades;

  // Tách các dòng
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return trades;

  // Lấy dòng header và chuẩn hóa thành chữ thường, xóa khoảng trắng thừa
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Tìm chỉ số của các cột cần thiết
  const ticketIdx = headers.findIndex(h => h.includes('ticket'));
  const openTimeIdx = headers.findIndex(h => h.includes('open time') || h.includes('opentime') || h.includes('time'));
  const closeTimeIdx = headers.findIndex(h => h.includes('close time') || h.includes('closetime'));
  const symbolIdx = headers.findIndex(h => h.includes('symbol'));
  const typeIdx = headers.findIndex(h => h.includes('type'));
  const volumeIdx = headers.findIndex(h => h.includes('volume') || h.includes('lot') || h.includes('size'));
  const openPriceIdx = headers.findIndex(h => h.includes('open price') || h.includes('openprice'));
  const closePriceIdx = headers.findIndex(h => h.includes('close price') || h.includes('closeprice'));
  const profitIdx = headers.findIndex(h => h.includes('profit'));
  const commIdx = headers.findIndex(h => h.includes('commission') || h.includes('comm') || h.includes('fee'));
  const swapIdx = headers.findIndex(h => h.includes('swap'));
  const commentIdx = headers.findIndex(h => h.includes('comment'));

  // Duyệt qua từng dòng dữ liệu
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Tách các cột (xử lý trường hợp có dấu phẩy trong nháy kép nếu có, ở đây làm đơn giản)
    // Exness export thường là CSV đơn giản không có nháy kép phức tạp
    const cols = line.split(',').map(c => c.trim());
    if (cols.length < Math.max(ticketIdx, openTimeIdx, typeIdx, profitIdx)) continue;

    const ticket = ticketIdx !== -1 ? cols[ticketIdx] : `T${Date.now()}${i}`;
    const openTime = openTimeIdx !== -1 ? cols[openTimeIdx] : new Date().toISOString();
    const closeTime = closeTimeIdx !== -1 ? cols[closeTimeIdx] : openTime;
    const symbol = symbolIdx !== -1 ? cols[symbolIdx] : 'XAUUSD';
    
    // Chuẩn hóa type
    const rawType = typeIdx !== -1 ? cols[typeIdx].toUpperCase() : 'BUY';
    const type: 'BUY' | 'SELL' = rawType.includes('SELL') || rawType.includes('SHORT') ? 'SELL' : 'BUY';

    const volume = volumeIdx !== -1 ? parseFloat(cols[volumeIdx]) || 0 : 0.01;
    const openPrice = openPriceIdx !== -1 ? parseFloat(cols[openPriceIdx]) || 0 : 0;
    const closePrice = closePriceIdx !== -1 ? parseFloat(cols[closePriceIdx]) || 0 : 0;
    const profit = profitIdx !== -1 ? parseFloat(cols[profitIdx]) || 0 : 0;
    const commission = commIdx !== -1 ? parseFloat(cols[commIdx]) || 0 : 0;
    const swap = swapIdx !== -1 ? parseFloat(cols[swapIdx]) || 0 : 0;
    const comment = commentIdx !== -1 ? cols[commentIdx] : '';

    const session = getTradingSession(openTime);

    trades.push({
      ticket,
      openTime,
      closeTime,
      symbol,
      type,
      volume,
      openPrice,
      closePrice,
      profit,
      commission,
      swap,
      comment,
      session
    });
  }

  // Sắp xếp các giao dịch theo thời gian mở lệnh tăng dần
  return trades.sort((a, b) => new Date(a.openTime.replace(/\./g, '/')).getTime() - new Date(b.openTime.replace(/\./g, '/')).getTime());
}
