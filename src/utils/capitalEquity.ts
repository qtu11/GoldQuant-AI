import { Trade } from './fileParser';

export interface CapitalMove {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl?: number;
  tp?: number;
  openTime: string;
  comment?: string;
}

/** Net nạp/rút: deposit +, withdrawal − */
export function netCapitalMoves(moves: CapitalMove[] = []): number {
  return moves.reduce((sum, m) => {
    const amt = Number(m.amount) || 0;
    return sum + (m.type === 'deposit' ? amt : -amt);
  }, 0);
}

/** Net PnL từ lệnh đã đóng */
export function netTradeProfit(trades: Trade[] = []): number {
  return trades.reduce((sum, t) => sum + t.profit + t.commission + t.swap, 0);
}

/**
 * Equity = initialCapital + trade PnL + net capital moves
 * (không tính floating — floating hiển thị riêng)
 */
export function computeClosedEquity(
  initialCapital: number,
  trades: Trade[] = [],
  capitalMoves: CapitalMove[] = []
): number {
  const eq = initialCapital + netTradeProfit(trades) + netCapitalMoves(capitalMoves);
  return Math.round(eq * 100) / 100;
}

/**
 * Khi user set equity thủ công, đồng bộ capitalMoves để load/refreshEquity không ghi đè.
 * Thêm 1 dòng điều chỉnh (deposit/withdrawal) sao cho:
 * initial + tradePnL + netMoves = targetEquity
 */
export function reconcileCapitalMovesToEquity(
  existingMoves: CapitalMove[] = [],
  initialCapital: number,
  trades: Trade[] = [],
  targetEquity: number
): CapitalMove[] {
  const tradeNet = netTradeProfit(trades);
  const baseWithoutMoves = initialCapital + tradeNet;
  const needNet = Math.round((targetEquity - baseWithoutMoves) * 100) / 100;
  const currentNet = netCapitalMoves(existingMoves);
  const delta = Math.round((needNet - currentNet) * 100) / 100;

  if (Math.abs(delta) < 0.005) {
    return existingMoves;
  }

  const adj: CapitalMove = {
    id: `cm_reconcile_${Date.now()}`,
    type: delta >= 0 ? 'deposit' : 'withdrawal',
    amount: Math.abs(delta),
    note: 'Đồng bộ equity (Update Capital)',
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  return [...existingMoves, adj];
}

/**
 * Floating PnL XAU-style: $1 price move ≈ $100 / 1.0 lot (contract 100)
 * Trả về ĐƠN VỊ TÀI KHOẢN:
 * - USD: diff × lot × contractSize
 * - USC (cent): ×100 vì 1 USD = 100 USC (cùng giá/lot, base currency là cent)
 */
export function floatingPnl(
  pos: OpenPosition,
  contractSize = 100,
  currency: 'USD' | 'USC' = 'USD'
): number {
  const diff =
    pos.type === 'BUY'
      ? pos.currentPrice - pos.openPrice
      : pos.openPrice - pos.currentPrice;
  let pnl = diff * pos.volume * contractSize;
  if (currency === 'USC') pnl *= 100;
  return Math.round(pnl * 100) / 100;
}

export function totalFloatingPnl(
  positions: OpenPosition[] = [],
  contractSize = 100,
  currency: 'USD' | 'USC' = 'USD'
): number {
  return positions.reduce((s, p) => s + floatingPnl(p, contractSize, currency), 0);
}

export function totalExposureLots(positions: OpenPosition[] = []): number {
  return Math.round(positions.reduce((s, p) => s + p.volume, 0) * 100) / 100;
}
