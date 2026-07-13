/**
 * Position sizing cho XAUUSD (standard + cent).
 * riskAmount = equity * (riskPercent/100)
 * lot ≈ riskAmount / (slPips * pipValuePerLot)
 *
 * XAUUSD chuẩn: 1 pip ≈ $0.1 / 0.01 lot khi pip=0.1$ move? 
 * Thực tế: 1 standard lot XAU = 100 oz; $1 move ≈ $100/lot
 * 1 pip (0.01$) ≈ $1 per standard lot; 1 pip (0.1$) ≈ $10/lot — dùng tick theo broker.
 * Mặc định: pipValuePerLot = 1 (mỗi 0.01 price = $1/lot) — user chỉnh được.
 */

export interface PositionSizeInput {
  equity: number;
  riskPercent: number; // e.g. 1 = 1%
  stopLossPips: number; // distance in pips
  pipValuePerLot?: number; // $ per pip per 1.0 lot
  isCentAccount?: boolean;
}

export interface PositionSizeResult {
  riskAmount: number;
  lots: number;
  lotsRounded: number;
  maxLots: number;
  note: string;
}

export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const {
    equity,
    riskPercent,
    stopLossPips,
    pipValuePerLot = 1,
    isCentAccount = false,
  } = input;

  const riskAmount = equity * (Math.max(0, riskPercent) / 100);
  const sl = Math.max(0.01, stopLossPips);
  const pv = Math.max(0.01, pipValuePerLot);

  // risk = lots * sl * pipValue
  const lots = riskAmount / (sl * pv);

  // Cent account: volume display often same units but $ risk is /100 — user nhập equity đúng đơn vị
  if (isCentAccount) {
    // equity đã là USC; riskAmount USC; pip value thường cũng theo cent
    // giữ công thức, chỉ ghi chú
  }

  const lotsRounded = Math.floor(lots * 100) / 100; // round down 0.01
  // Không ép min 0.01 khi risk không đủ — tránh over-risk
  const maxLots = lotsRounded;

  let note = '';
  if (lotsRounded < 0.01) {
    note = 'Rủi ro quá nhỏ hoặc SL quá rộng — lot < 0.01. Giảm SL hoặc tăng risk %.';
  } else if (lotsRounded > 10) {
    note = 'Lot rất lớn (>10). Kiểm tra lại pip value / equity.';
  } else {
    note = `Risk ${riskPercent}% ≈ ${riskAmount.toFixed(2)} · SL ${sl} pips`;
  }
  if (isCentAccount) {
    note += ' · Cent: equity phải cùng đơn vị với pip value.';
  }

  return {
    riskAmount: Math.round(riskAmount * 100) / 100,
    lots: Math.round(lots * 10000) / 10000,
    lotsRounded,
    maxLots,
    note,
  };
}

/** Ước tính $ risk nếu vào lot cố định */
export function riskFromLots(
  lots: number,
  stopLossPips: number,
  pipValuePerLot = 1
): number {
  return Math.round(lots * stopLossPips * pipValuePerLot * 100) / 100;
}
