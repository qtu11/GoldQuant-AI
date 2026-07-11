import { Trade, parseDate } from './fileParser';

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

export function calculateStats(trades: Trade[], initialCapital: number): AccountStats {
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
    }
  };

  if (trades.length === 0) {
    return stats;
  }

  // Sắp xếp bản sao của trades theo openTime để tính toán Equity Curve đúng trình tự thời gian
  const sortedTrades = [...trades].sort((a, b) => {
    return parseDate(a.openTime).getTime() - parseDate(b.openTime).getTime();
  });

  let totalWinProfit = 0;
  let totalLossProfit = 0;
  let currentBalance = initialCapital;
  let peakBalance = initialCapital;
  let maxDrawdownVal = 0;
  
  // Mảng chứa lợi nhuận từng giao dịch để tính Sharpe Ratio
  const profits: number[] = [];

  // Duyệt qua tất cả trades đã được sắp xếp
  sortedTrades.forEach(trade => {
    // Net Profit thực tế = profit + commission + swap
    const netTradeProfit = trade.profit + trade.commission + trade.swap;
    stats.netProfit += netTradeProfit;
    stats.totalLot += trade.volume;
    profits.push(netTradeProfit);

    // Thống kê thắng / thua
    if (netTradeProfit > 0) {
      stats.wins++;
      totalWinProfit += netTradeProfit;
    } else {
      stats.losses++;
      totalLossProfit += Math.abs(netTradeProfit);
    }

    // Thống kê phiên
    const sess = trade.session;
    stats.sessionStats[sess].trades++;
    stats.sessionStats[sess].profit += netTradeProfit;
    stats.sessionStats[sess].volume += trade.volume;

    // Tính Max Drawdown dựa trên Equity Curve (thời điểm đóng lệnh)
    currentBalance += netTradeProfit;
    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    }
    const currentDrawdown = peakBalance > 0 ? (peakBalance - currentBalance) / peakBalance : 0;
    if (currentDrawdown > maxDrawdownVal) {
      maxDrawdownVal = currentDrawdown;
    }
  });

  // Tính các tỷ lệ phần trăm và chỉ số nâng cao
  stats.winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0;
  stats.roi = initialCapital > 0 ? (stats.netProfit / initialCapital) * 100 : 0;

  // Tính Monthly ROI (giả định khoảng cách thời gian giữa lệnh đầu và lệnh cuối)
  if (sortedTrades.length > 0) {
    let minOpen = parseDate(sortedTrades[0].openTime).getTime();
    let maxClose = parseDate(sortedTrades[0].closeTime).getTime();
    sortedTrades.forEach(t => {
      const op = parseDate(t.openTime).getTime();
      const cl = parseDate(t.closeTime).getTime();
      if (op < minOpen) minOpen = op;
      if (cl > maxClose) maxClose = cl;
    });
    const durationDays = Math.max(1, (maxClose - minOpen) / (1000 * 60 * 60 * 24));
    stats.monthlyRoi = stats.roi * (30 / durationDays);
  } else {
    stats.monthlyRoi = stats.roi;
  }

  // Profit Factor = Tổng thắng / Tổng thua
  stats.profitFactor = totalLossProfit > 0 ? totalWinProfit / totalLossProfit : totalWinProfit > 0 ? 99.99 : 0;

  // Max Drawdown (%)
  stats.maxDrawdown = maxDrawdownVal * 100;

  // Recovery Factor = Net Profit / Max Drawdown Amount
  const maxDrawdownAmount = peakBalance * maxDrawdownVal;
  stats.recoveryFactor = maxDrawdownAmount > 0 ? stats.netProfit / maxDrawdownAmount : stats.netProfit > 0 ? 99.99 : 0;

  // Tính Sharpe Ratio
  if (profits.length > 1) {
    const avgProfit = stats.netProfit / profits.length;
    const variance = profits.reduce((sq, p) => sq + Math.pow(p - avgProfit, 2), 0) / (profits.length - 1);
    const stdDev = Math.sqrt(variance);
    stats.sharpeRatio = stdDev > 0 ? (avgProfit / stdDev) * Math.sqrt(252) : 0;
  } else {
    stats.sharpeRatio = 0;
  }

  // Làm tròn số
  stats.totalLot = Math.round(stats.totalLot * 100) / 100;
  stats.netProfit = Math.round(stats.netProfit * 100) / 100;
  stats.winRate = Math.round(stats.winRate * 10) / 10;
  stats.roi = Math.round(stats.roi * 10) / 10;
  stats.monthlyRoi = Math.round(stats.monthlyRoi * 10) / 10;
  stats.profitFactor = Math.round(stats.profitFactor * 100) / 100;
  stats.recoveryFactor = Math.round(stats.recoveryFactor * 100) / 100;
  stats.maxDrawdown = Math.round(stats.maxDrawdown * 10) / 10;
  stats.sharpeRatio = Math.round(stats.sharpeRatio * 100) / 100;

  // Làm tròn sessionStats
  (Object.keys(stats.sessionStats) as Array<'Asia' | 'Europe' | 'US'>).forEach(k => {
    stats.sessionStats[k].profit = Math.round(stats.sessionStats[k].profit * 100) / 100;
    stats.sessionStats[k].volume = Math.round(stats.sessionStats[k].volume * 100) / 100;
  });

  return stats;
}

// Hàm phân tích điểm số rủi ro AI Risk Score (từ 0 - 100)
export function calculateRiskScore(stats: AccountStats) {
  let score = 50; // Điểm bắt đầu

  // Max drawdown phạt nặng: > 10% giảm điểm mạnh
  if (stats.maxDrawdown <= 1) score += 20;
  else if (stats.maxDrawdown <= 3) score += 15;
  else if (stats.maxDrawdown <= 5) score += 5;
  else if (stats.maxDrawdown <= 10) score -= 10;
  else if (stats.maxDrawdown <= 20) score -= 25;
  else score -= 40;

  // Win Rate
  if (stats.winRate >= 75) score += 15;
  else if (stats.winRate >= 60) score += 10;
  else if (stats.winRate >= 50) score += 5;
  else if (stats.winRate < 40) score -= 15;

  // Profit Factor
  if (stats.profitFactor >= 3) score += 15;
  else if (stats.profitFactor >= 2) score += 10;
  else if (stats.profitFactor >= 1.5) score += 5;
  else if (stats.profitFactor < 1) score -= 20;

  // Khối lượng giao dịch và Sharpe
  if (stats.sharpeRatio >= 2) score += 10;
  else if (stats.sharpeRatio >= 1) score += 5;
  else if (stats.sharpeRatio < 0.5 && stats.totalTrades > 5) score -= 10;

  // TRẦN RỦI RO (SAFETY CAP): Nếu Max Drawdown vượt quá 30%, điểm số an toàn tối đa chỉ đạt 40 (HIGH RISK)
  if (stats.maxDrawdown > 30) {
    score = Math.min(40, score);
  } else {
    // Ràng buộc trong [1, 100]
    score = Math.max(1, Math.min(100, score));
  }

  // Phân loại nhãn
  let label = 'HIGH RISK';
  let color = '#ef4444'; // Red
  if (score >= 90) {
    label = 'EXCELLENT';
    color = '#10b981'; // Green
  } else if (score >= 75) {
    label = 'HEALTHY';
    color = '#10b981';
  } else if (score >= 50) {
    label = 'MODERATE';
    color = '#f5b61b'; // Yellow
  }

  // Giả lập 6 chỉ số phụ quanh trục
  const profitability = Math.min(100, Math.max(10, Math.round(stats.roi * 1.5 + (stats.winRate * 0.5))));
  const stability = Math.min(100, Math.max(10, Math.round(100 - stats.maxDrawdown * 4)));
  const riskControl = Math.min(100, Math.max(10, Math.round(score * 0.9 + 5)));
  const capitalEff = Math.min(100, Math.max(10, Math.round(stats.profitFactor * 15 + 20)));
  const consistency = Math.min(100, Math.max(10, Math.round(70 + (stats.sharpeRatio * 5))));
  const recovery = Math.min(100, Math.max(10, Math.round(stats.recoveryFactor * 2 + 30)));

  return {
    score,
    label,
    color,
    subMetrics: {
      profitability,
      stability,
      riskControl,
      capitalEff,
      consistency,
      recovery
    }
  };
}
