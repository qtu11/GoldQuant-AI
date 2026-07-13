import { Trade, parseDate } from './fileParser';
import type { CapitalMove } from './capitalEquity';
import { netCapitalMoves } from './capitalEquity';

export interface AccountStats {
  totalTrades: number;
  wins: number;
  losses: number;
  totalLot: number;
  netProfit: number;
  winRate: number;
  roi: number;
  monthlyRoi: number;
  profitFactor: number;
  recoveryFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sessionStats: {
    Asia: { trades: number; profit: number; volume: number };
    Europe: { trades: number; profit: number; volume: number };
    US: { trades: number; profit: number; volume: number };
  };
}

/** Thời điểm capital move (ms) — date YYYY-MM-DD hoặc ISO */
function capitalMoveTimeMs(m: CapitalMove): number {
  const raw = m.date || m.createdAt || '';
  if (!raw) return NaN;
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return d.getTime();
}

/**
 * Lọc trades theo period (dùng mốc closeTime mới nhất trong sample làm "now"
 * để dữ liệu lịch sử demo vẫn filter được, không phụ thuộc đồng hồ hệ thống).
 */
export function filterTradesByPeriod(trades: Trade[], period: string): Trade[] {
  if (!trades.length || period === 'all') return trades;

  const daysMap: Record<string, number> = {
    '1w': 7,
    '1m': 30,
    '1q': 90,
    '1y': 365,
  };
  const days = daysMap[period];
  if (!days) return trades;

  const closeTimes = trades
    .map(t => parseDate(t.closeTime || t.openTime).getTime())
    .filter(t => !isNaN(t));
  if (!closeTimes.length) return trades;

  const maxTime = Math.max(...closeTimes);
  const cutoff = maxTime - days * 24 * 60 * 60 * 1000;
  return trades.filter(t => {
    const tClose = parseDate(t.closeTime || t.openTime).getTime();
    return !isNaN(tClose) && tClose >= cutoff;
  });
}

/**
 * @param capitalMoves — nạp/rút (đồng bộ equity curve & closed equity).
 * DD/recovery theo equity path = initial + trades + capital moves.
 * ROI = trade net PnL / (initial + net deposits dương).
 */
export function calculateStats(
  trades: Trade[],
  initialCapital: number,
  capitalMoves: CapitalMove[] = []
): AccountStats {
  const stats: AccountStats = {
    totalTrades: trades.length,
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
  };

  const capitalBase = initialCapital > 0 ? initialCapital : 0;
  const netMoves = netCapitalMoves(capitalMoves);
  const investedBase =
    capitalBase > 0
      ? Math.max(capitalBase, capitalBase + Math.max(0, netMoves))
      : Math.max(0, netMoves);

  type EqEvent = { time: number; net: number; isTrade: boolean; trade?: Trade };
  const events: EqEvent[] = [];

  trades.forEach((trade) => {
    const time = parseDate(trade.closeTime || trade.openTime).getTime();
    if (isNaN(time)) return;
    events.push({
      time,
      net: trade.profit + trade.commission + trade.swap,
      isTrade: true,
      trade,
    });
  });

  capitalMoves.forEach((m) => {
    const time = capitalMoveTimeMs(m);
    if (isNaN(time)) return;
    const signed = (Number(m.amount) || 0) * (m.type === 'deposit' ? 1 : -1);
    events.push({ time, net: signed, isTrade: false });
  });

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.isTrade !== b.isTrade) return a.isTrade ? 1 : -1;
    return 0;
  });

  if (events.length === 0) {
    return stats;
  }

  let totalWinProfit = 0;
  let totalLossProfit = 0;
  let currentBalance = capitalBase;
  let peakBalance = capitalBase > 0 ? capitalBase : 0;
  let maxDrawdownVal = 0;
  let everHadPositivePeak = capitalBase > 0;
  const profits: number[] = [];
  const sortedTrades: Trade[] = [];

  events.forEach((ev) => {
    if (ev.isTrade && ev.trade) {
      const trade = ev.trade;
      const netTradeProfit = ev.net;
      stats.netProfit += netTradeProfit;
      stats.totalLot += trade.volume;
      profits.push(netTradeProfit);
      sortedTrades.push(trade);

      if (netTradeProfit > 0) {
        stats.wins++;
        totalWinProfit += netTradeProfit;
      } else if (netTradeProfit < 0) {
        stats.losses++;
        totalLossProfit += Math.abs(netTradeProfit);
      }

      const sess =
        trade.session === 'Europe' || trade.session === 'US' ? trade.session : 'Asia';
      stats.sessionStats[sess].trades++;
      stats.sessionStats[sess].profit += netTradeProfit;
      stats.sessionStats[sess].volume += trade.volume;
    }

    currentBalance += ev.net;
    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
      if (peakBalance > 0) everHadPositivePeak = true;
    }
    if (peakBalance > 0) {
      const dd = (peakBalance - currentBalance) / peakBalance;
      if (dd > maxDrawdownVal) maxDrawdownVal = dd;
    } else if (!everHadPositivePeak && currentBalance < 0) {
      maxDrawdownVal = Math.max(maxDrawdownVal, 1);
    }
  });

  const decided = stats.wins + stats.losses;
  stats.winRate = decided > 0 ? (stats.wins / decided) * 100 : 0;
  stats.roi = investedBase > 0 ? (stats.netProfit / investedBase) * 100 : 0;

  let durationDays = 1;
  const calendarDays = new Set<string>();
  if (sortedTrades.length > 0) {
    let minOpen = parseDate(sortedTrades[0].openTime).getTime();
    let maxClose = parseDate(
      sortedTrades[0].closeTime || sortedTrades[0].openTime
    ).getTime();
    sortedTrades.forEach((t) => {
      const op = parseDate(t.openTime).getTime();
      const cl = parseDate(t.closeTime || t.openTime).getTime();
      if (!isNaN(op) && op < minOpen) minOpen = op;
      if (!isNaN(cl) && cl > maxClose) maxClose = cl;
      if (!isNaN(cl)) {
        const d = new Date(cl);
        calendarDays.add(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        );
      }
    });
    durationDays = Math.max(1 / 24, (maxClose - minOpen) / (1000 * 60 * 60 * 24));
  }
  const uniqueDays = Math.max(1, calendarDays.size || 1);

  if (sortedTrades.length === 0) {
    stats.monthlyRoi = 0;
  } else if (uniqueDays < 7 || durationDays < 7) {
    stats.monthlyRoi = stats.roi;
  } else {
    const baseDays = Math.max(uniqueDays, durationDays);
    const projected = stats.roi * (30 / baseDays);
    stats.monthlyRoi = Math.max(-300, Math.min(300, projected));
  }

  if (totalLossProfit > 0) {
    stats.profitFactor = Math.min(20, totalWinProfit / totalLossProfit);
  } else {
    stats.profitFactor = totalWinProfit > 0 ? 20 : 0;
  }

  stats.maxDrawdown = Math.min(100, maxDrawdownVal * 100);

  const maxDrawdownAmount = peakBalance > 0 ? peakBalance * maxDrawdownVal : 0;
  if (maxDrawdownAmount > 0) {
    stats.recoveryFactor = Math.min(50, stats.netProfit / maxDrawdownAmount);
  } else {
    stats.recoveryFactor = stats.netProfit > 0 ? 20 : 0;
  }

  if (profits.length > 1) {
    const avgProfit = stats.netProfit / profits.length;
    const variance =
      profits.reduce((sq, p) => sq + Math.pow(p - avgProfit, 2), 0) /
      (profits.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      const tradesPerYear = Math.min(
        500,
        Math.max(50, profits.length * (365 / Math.max(durationDays, 1)))
      );
      stats.sharpeRatio = (avgProfit / stdDev) * Math.sqrt(tradesPerYear);
      stats.sharpeRatio = Math.max(-5, Math.min(10, stats.sharpeRatio));
    } else {
      stats.sharpeRatio = 0;
    }
  } else {
    stats.sharpeRatio = 0;
  }

  stats.totalLot = Math.round(stats.totalLot * 100) / 100;
  stats.netProfit = Math.round(stats.netProfit * 100) / 100;
  stats.winRate = Math.round(stats.winRate * 10) / 10;
  stats.roi = Math.round(stats.roi * 10) / 10;
  stats.monthlyRoi = Math.round(stats.monthlyRoi * 10) / 10;
  stats.profitFactor = Math.round(stats.profitFactor * 100) / 100;
  stats.recoveryFactor = Math.round(stats.recoveryFactor * 100) / 100;
  stats.maxDrawdown = Math.round(stats.maxDrawdown * 10) / 10;
  stats.sharpeRatio = Math.round(stats.sharpeRatio * 100) / 100;

  (Object.keys(stats.sessionStats) as Array<'Asia' | 'Europe' | 'US'>).forEach((k) => {
    stats.sessionStats[k].profit =
      Math.round(stats.sessionStats[k].profit * 100) / 100;
    stats.sessionStats[k].volume =
      Math.round(stats.sessionStats[k].volume * 100) / 100;
  });

  return stats;
}

/**
 * Equity tại mốc cutoff (trước period) = initial + PnL trades trước cutoff + net moves trước cutoff.
 */
export function equityAtCutoff(
  trades: Trade[],
  initialCapital: number,
  capitalMoves: CapitalMove[] = [],
  cutoffMs: number
): number {
  let eq = initialCapital > 0 ? initialCapital : 0;
  trades.forEach((t) => {
    const time = parseDate(t.closeTime || t.openTime).getTime();
    if (!isNaN(time) && time < cutoffMs) {
      eq += t.profit + t.commission + t.swap;
    }
  });
  capitalMoves.forEach((m) => {
    const time = capitalMoveTimeMs(m);
    if (!isNaN(time) && time < cutoffMs) {
      eq += (Number(m.amount) || 0) * (m.type === 'deposit' ? 1 : -1);
    }
  });
  return Math.round(eq * 100) / 100;
}

/** Cutoff ms theo period (mốc = closeTime mới nhất trong sample). */
export function periodCutoffMs(trades: Trade[], period: string): number | null {
  if (!trades.length || period === 'all') return null;
  const daysMap: Record<string, number> = {
    '1w': 7,
    '1m': 30,
    '1q': 90,
    '1y': 365,
  };
  const days = daysMap[period];
  if (!days) return null;
  const closeTimes = trades
    .map((t) => parseDate(t.closeTime || t.openTime).getTime())
    .filter((t) => !isNaN(t));
  if (!closeTimes.length) return null;
  return Math.max(...closeTimes) - days * 24 * 60 * 60 * 1000;
}

/** Moves trong period (sau cutoff). */
export function filterCapitalMovesByPeriod(
  moves: CapitalMove[],
  cutoffMs: number | null
): CapitalMove[] {
  if (cutoffMs == null) return moves;
  return moves.filter((m) => {
    const t = capitalMoveTimeMs(m);
    return !isNaN(t) && t >= cutoffMs;
  });
}

/** Clamp helper */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * AI Risk Score 0–100 (CAO = rủi ro CAO).
 *
 * Không cộng/trừ bậc thang (±15) → account đẹp không còn bị dồn về 1.
 * Dùng trung bình có trọng số các thành phần rủi ro liên tục 0–100.
 *
 * Tham chiếu account đẹp (DD~2%, WR~78%, PF~5.7, Sharpe~3, ~50 lệnh):
 *   → khoảng 12–22 (HEALTHY), không phải 1.
 */
export function calculateRiskScore(stats: AccountStats) {
  const n = stats.totalTrades || 0;
  const dd = Math.max(0, stats.maxDrawdown);
  const wr = clamp(stats.winRate, 0, 100);
  const pf = Math.max(0, stats.profitFactor);
  const sharpe = stats.sharpeRatio;
  const roi = stats.roi;

  // 1) Drawdown risk — trục chính (0%→5, 5%→25, 10%→50, 20%→80, 40%→100)
  const ddRisk = clamp(
    dd <= 5
      ? 5 + (dd / 5) * 20
      : dd <= 10
        ? 25 + ((dd - 5) / 5) * 25
        : dd <= 20
          ? 50 + ((dd - 10) / 10) * 30
          : 80 + Math.min(20, ((dd - 20) / 20) * 20),
    0,
    100
  );

  // 2) Win-rate risk — WR 80%→12, 50%→45, 30%→75
  const wrRisk = clamp(100 - wr * 1.1, 8, 95);

  // 3) Profit-factor risk — PF 5→10, 2→28, 1→55, 0.5→85
  let pfRisk: number;
  if (pf <= 0) pfRisk = 70;
  else if (pf >= 5) pfRisk = 10;
  else if (pf >= 2) pfRisk = 10 + ((5 - pf) / 3) * 18; // 10..28
  else if (pf >= 1) pfRisk = 28 + ((2 - pf) / 1) * 27; // 28..55
  else pfRisk = 55 + ((1 - pf) / 1) * 40; // 55..95
  pfRisk = clamp(pfRisk, 8, 95);

  // 4) Sharpe risk — 3+ →12, 1→40, 0→60, âm→80
  let sharpeRisk: number;
  if (sharpe >= 3) sharpeRisk = 12;
  else if (sharpe >= 1) sharpeRisk = 12 + ((3 - sharpe) / 2) * 28;
  else if (sharpe >= 0) sharpeRisk = 40 + (1 - sharpe) * 20;
  else sharpeRisk = 60 + Math.min(30, Math.abs(sharpe) * 15);
  sharpeRisk = clamp(sharpeRisk, 8, 95);

  // 5) Sample uncertainty — ít lệnh = không thể “risk = 1”
  //    0 lệnh→55, 10→40, 30→22, 100+→12
  const sampleRisk = clamp(
    n <= 0 ? 55 : n < 10 ? 45 - n : n < 30 ? 35 - (n - 10) * 0.65 : n < 100 ? 22 - (n - 30) * 0.12 : 12,
    10,
    55
  );

  // 6) ROI context nhẹ — ROI âm tăng risk, ROI rất cao không giảm risk xuống 0
  const roiRisk = roi >= 20 ? 15 : roi >= 0 ? 25 - roi * 0.4 : clamp(40 + Math.abs(roi) * 0.5, 40, 90);

  // Trọng số (tổng 1.0)
  const scoreRaw =
    0.32 * ddRisk +
    0.14 * wrRisk +
    0.18 * pfRisk +
    0.12 * sharpeRisk +
    0.16 * sampleRisk +
    0.08 * roiRisk;

  // Floor theo DD cực lớn
  let score = scoreRaw;
  if (dd > 30) score = Math.max(score, 72);
  if (dd > 50) score = Math.max(score, 85);
  // Floor mềm: account “hoàn hảo” vẫn ≥ 8 (tránh hiển thị 1)
  // Ceiling
  score = Math.round(clamp(score, 8, 98));

  let label = 'HIGH RISK';
  let color = '#ef4444';
  if (score < 30) {
    label = 'HEALTHY';
    color = '#10b981';
  } else if (score < 60) {
    label = 'MODERATE';
    color = '#f5b61b';
  }

  // Sub-metrics 0–100 (chất lượng — CAO = tốt), không saturate hết 100
  const profitability = clamp(
    Math.round(40 + Math.tanh(roi / 40) * 35 + (wr - 50) * 0.35),
    5,
    98
  );
  const stability = clamp(Math.round(95 - dd * 3.2), 5, 98);
  const riskControl = clamp(Math.round(100 - score), 5, 98);
  const capitalEff = clamp(Math.round(20 + Math.min(pf, 6) * 12), 5, 98);
  const consistency = clamp(Math.round(45 + Math.min(sharpe, 4) * 12), 5, 98);
  const recovery = clamp(
    Math.round(30 + Math.min(stats.recoveryFactor, 15) * 4),
    5,
    98
  );

  const healthScore = 100 - score;
  const hint =
    score < 30
      ? 'Rủi ro thấp — profile ổn định'
      : score < 60
        ? 'Rủi ro trung bình — theo dõi DD & lot'
        : 'Rủi ro cao — giảm size / siết rule';

  return {
    score,
    /** 100 − risk — chỉ để UI giải thích (cao = tốt) */
    healthScore,
    hint,
    label,
    color,
    subMetrics: {
      profitability,
      stability,
      riskControl,
      capitalEff,
      consistency,
      recovery,
    },
  };
}
