export interface QuantMetricsRequest {
  equityHistory: number[];
  dailyReturns: number[];
  /** Returns từng lệnh (fraction) — bổ sung khi ít ngày giao dịch */
  tradeReturns?: number[];
  currentEquity: number;
  currentDrawdown: number;
  maxDdLimit: number;
  marginLevel: number;
  allocations: number[]; // Tỷ lệ exposure để tính HHI
  anomalyCount: number;
  /** Số lệnh / ngày thật — UI badge */
  sampleTrades?: number;
  sampleDays?: number;
}

export interface QuantMetricsResponse {
  maxDrawdown: number;
  currentDrawdown: number;
  var95: number;
  cvar95: number;
  riskScore: number;
  monteCarloPaths: number[][]; // [ngày][path]
  /** Metadata cho UI — dữ liệu thật vs default */
  mcMeta?: {
    mode: 'empirical' | 'bootstrap' | 'default';
    sampleSize: number;
    sampleDays: number;
    sampleTrades: number;
    driftDaily: number;
    volDaily: number;
    startEquity: number;
  };
}

/**
 * Gọi API từ Python Quant Service để tính toán các chỉ số nâng cao (VaR, CVaR, Monte Carlo...)
 * Nếu service lỗi hoặc chưa deploy, tự động kích hoạt chế độ Fallback tính toán trên Node.js.
 */
export async function calculatePortfolioQuantMetrics(
  data: QuantMetricsRequest
): Promise<QuantMetricsResponse> {
  const quantServiceUrl = process.env.QUANT_SERVICE_URL;

  if (quantServiceUrl) {
    try {
      const response = await fetch(`${quantServiceUrl}/api/v1/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.QUANT_SERVICE_API_KEY}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const json = (await response.json()) as QuantMetricsResponse;
        // Bổ sung meta nếu service cũ không có
        if (!json.mcMeta) {
          return { ...json, mcMeta: buildMetaFromRequest(data, json) };
        }
        return json;
      }
      console.warn(
        `Quant Service API returned status: ${response.status}. Falling back to Node.js engine.`
      );
    } catch (error) {
      console.error(
        'Failed to connect to Python Quant Service, running fallback Node.js calculations:',
        error
      );
    }
  }

  return runFallbackQuantEngine(data);
}

function buildMetaFromRequest(
  data: QuantMetricsRequest,
  res: QuantMetricsResponse
): QuantMetricsResponse['mcMeta'] {
  const start =
    res.monteCarloPaths?.[0]?.[0] ?? Math.max(1, data.currentEquity || 1);
  return {
    mode: (data.dailyReturns?.length || 0) + (data.tradeReturns?.length || 0) > 0
      ? 'empirical'
      : 'default',
    sampleSize: data.dailyReturns?.length || 0,
    sampleDays: data.sampleDays ?? data.dailyReturns?.length ?? 0,
    sampleTrades: data.sampleTrades ?? 0,
    driftDaily: 0,
    volDaily: 0,
    startEquity: start,
  };
}

function finiteReturns(arr: number[] | undefined): number[] {
  return (arr || []).filter((r) => Number.isFinite(r) && Math.abs(r) < 2);
}

/**
 * Ước drift/vol từ daily + trade returns (kể cả 1 mẫu).
 */
function estimateMoments(
  dailyReturns: number[],
  tradeReturns: number[]
): { drift: number; vol: number; mode: 'empirical' | 'bootstrap' | 'default'; sampleSize: number } {
  const daily = finiteReturns(dailyReturns);
  const trades = finiteReturns(tradeReturns);

  // Ưu tiên daily nếu ≥ 2 ngày; nếu 1 ngày + có trade returns → bootstrap trades
  // Nếu chỉ 1 daily → vẫn dùng empirical mean, vol từ |r| hoặc trades
  if (daily.length >= 2) {
    const mean = daily.reduce((s, r) => s + r, 0) / daily.length;
    const variance =
      daily.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
      Math.max(1, daily.length - 1);
    let vol = Math.sqrt(Math.max(variance, 0));
    // Vol quá nhỏ (toàn BE) → lấy từ trade-level
    if (vol < 1e-6 && trades.length >= 2) {
      const tm = trades.reduce((s, r) => s + r, 0) / trades.length;
      const tv =
        trades.reduce((s, r) => s + Math.pow(r - tm, 2), 0) /
        Math.max(1, trades.length - 1);
      // scale trade vol → daily-ish (√n trades/day approx)
      const tpd = Math.max(1, trades.length / daily.length);
      vol = Math.sqrt(Math.max(tv, 0) * tpd);
    }
    return {
      drift: mean,
      vol: Math.min(0.2, Math.max(0.0005, vol)),
      mode: 'empirical',
      sampleSize: daily.length,
    };
  }

  if (daily.length === 1) {
    const d0 = daily[0];
    if (trades.length >= 2) {
      const mean = trades.reduce((s, r) => s + r, 0) / trades.length;
      const variance =
        trades.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
        Math.max(1, trades.length - 1);
      // Aggregate ~1 day of trades into daily vol
      const dayVol = Math.sqrt(Math.max(variance, 0) * trades.length);
      return {
        drift: d0, // đúng PnL ngày thật
        vol: Math.min(0.2, Math.max(0.0005, dayVol || Math.abs(d0) * 0.5)),
        mode: 'bootstrap',
        sampleSize: trades.length,
      };
    }
    // Chỉ 1 daily, không có trade returns
    return {
      drift: d0,
      vol: Math.min(0.2, Math.max(0.002, Math.abs(d0) * 0.75 || 0.005)),
      mode: 'empirical',
      sampleSize: 1,
    };
  }

  // Không có daily — dùng trade returns
  if (trades.length >= 1) {
    const mean = trades.reduce((s, r) => s + r, 0) / trades.length;
    if (trades.length === 1) {
      return {
        drift: mean,
        vol: Math.min(0.15, Math.max(0.002, Math.abs(mean) * 0.75 || 0.005)),
        mode: 'bootstrap',
        sampleSize: 1,
      };
    }
    const variance =
      trades.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
      Math.max(1, trades.length - 1);
    // ~4–8 trades/day typical gold scalp → daily vol ≈ σ * √n
    const assumedTpd = Math.min(12, Math.max(3, Math.sqrt(trades.length)));
    const dayDrift = mean * assumedTpd;
    const dayVol = Math.sqrt(Math.max(variance, 0) * assumedTpd);
    return {
      drift: Math.min(0.05, Math.max(-0.05, dayDrift)),
      vol: Math.min(0.2, Math.max(0.0005, dayVol)),
      mode: 'bootstrap',
      sampleSize: trades.length,
    };
  }

  // Không có dữ liệu → default nhẹ (đánh dấu default)
  return { drift: 0.0002, vol: 0.01, mode: 'default', sampleSize: 0 };
}

/** Box-Muller N(0,1) */
function randn(): number {
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random() || 0.0001;
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Sample 1 daily return:
 * - bootstrap: lấy mẫu có hoàn lại từ pool returns thật
 * - empirical/default: GBM μ + σZ
 */
function sampleDailyReturn(
  pool: number[],
  drift: number,
  vol: number,
  mode: 'empirical' | 'bootstrap' | 'default'
): number {
  if (mode === 'bootstrap' && pool.length > 0) {
    // Bootstrap + noise nhỏ để paths không trùng hệt
    const base = pool[Math.floor(Math.random() * pool.length)];
    const noise = vol * 0.15 * randn();
    return Math.min(0.25, Math.max(-0.25, base + noise));
  }
  const r = drift + vol * randn();
  return Math.min(0.2, Math.max(-0.2, r));
}

/**
 * Node.js Fallback Engine: Tính toán bằng TypeScript các công thức tài chính quant cơ bản
 */
function runFallbackQuantEngine(data: QuantMetricsRequest): QuantMetricsResponse {
  const currentDrawdown = data.currentDrawdown;
  const maxDrawdown =
    data.equityHistory.length > 0
      ? Math.max(
          ...data.equityHistory.map((eq, idx) => {
            const peak = Math.max(...data.equityHistory.slice(0, idx + 1));
            return peak > 0 ? ((peak - eq) / peak) * 100 : 0;
          })
        )
      : 0;

  let var95 = 0;
  let cvar95 = 0;
  const dailyForVar = finiteReturns(data.dailyReturns);
  if (dailyForVar.length > 0) {
    const sortedReturns = [...dailyForVar].sort((a, b) => a - b);
    const alphaIdx = Math.max(
      0,
      Math.min(sortedReturns.length - 1, Math.floor(0.05 * sortedReturns.length))
    );
    const var95Return = sortedReturns[alphaIdx];
    var95 = Math.abs(Math.min(0, var95Return) * data.currentEquity);

    const tailReturns = sortedReturns.slice(0, alphaIdx + 1);
    const cvar95Return =
      tailReturns.length > 0
        ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
        : var95Return;
    cvar95 = Math.abs(Math.min(0, cvar95Return) * data.currentEquity);
  }

  const totalAlloc = data.allocations.reduce((sum, w) => sum + w, 0) || 1;
  const weights = data.allocations.map((w) => w / totalAlloc);
  const hhi = weights.reduce((sum, w) => sum + Math.pow(w, 2), 0);

  const ddRatio = currentDrawdown / (data.maxDdLimit || 10.0);
  const ddRisk = 100 / (1 + Math.exp(-5 * (ddRatio - 0.7)));

  let marginRisk = 0;
  if (data.marginLevel <= 0) {
    marginRisk = 100;
  } else if (data.marginLevel < 500) {
    marginRisk = (100 * (500 - data.marginLevel)) / (500 - 150);
  }
  marginRisk = Math.min(Math.max(marginRisk, 0), 100);

  const concentrationRisk = hhi * 100;
  const anomalyRisk = Math.min(data.anomalyCount * 25, 100);

  const riskScore = Math.round(
    0.4 * ddRisk + 0.3 * marginRisk + 0.2 * concentrationRisk + 0.1 * anomalyRisk
  );

  // —— Monte Carlo từ dữ liệu THẬT (1 ngày / 1 lệnh vẫn chạy empirical) ——
  const startEquity = Math.max(1, data.currentEquity || 1000);
  const daily = finiteReturns(data.dailyReturns);
  const trades = finiteReturns(data.tradeReturns);
  const { drift, vol, mode, sampleSize } = estimateMoments(daily, trades);

  // Pool bootstrap: ưu tiên daily; nếu 1 daily + trades → dùng trade returns scale
  let pool: number[] = daily.length >= 2 ? daily : trades.length > 0 ? trades : daily;

  // Nếu pool là trade-level, scale nhẹ về daily magnitude khi sample path
  // (sampleDailyReturn với bootstrap lấy trực tiếp trade r — paths biến động theo lệnh)
  // Với mode bootstrap + trade pool: mỗi "ngày" MC = tổng 3–8 trade samples
  const days = 30;
  const pathsCount = 12;
  const paths: number[][] = [];

  for (let p = 0; p < pathsCount; p++) {
    const path: number[] = [startEquity];
    let eq = startEquity;
    for (let d = 1; d <= days; d++) {
      let dailyReturn: number;
      if (mode === 'bootstrap' && trades.length >= 2 && daily.length < 2) {
        // 1 ngày thật nhưng nhiều lệnh: mỗi ngày MC = tổng vài trade bootstrap
        const nTrades = Math.min(8, Math.max(2, Math.round(trades.length)));
        let dayR = 0;
        for (let k = 0; k < nTrades; k++) {
          dayR += trades[Math.floor(Math.random() * trades.length)];
        }
        // Clamp shock 1 ngày
        dailyReturn = Math.min(0.25, Math.max(-0.25, dayR));
      } else {
        dailyReturn = sampleDailyReturn(pool, drift, vol, mode);
      }
      eq = Math.max(0.01, eq * (1 + dailyReturn));
      path.push(Math.round(eq * 100) / 100);
    }
    paths.push(path);
  }

  // Transpose [day][path]
  const transposedPaths: number[][] = [];
  for (let d = 0; d <= days; d++) {
    const dayData: number[] = [];
    for (let p = 0; p < pathsCount; p++) {
      dayData.push(paths[p][d]);
    }
    transposedPaths.push(dayData);
  }

  return {
    maxDrawdown,
    currentDrawdown,
    var95,
    cvar95,
    riskScore: Math.min(Math.max(riskScore, 0), 100),
    monteCarloPaths: transposedPaths,
    mcMeta: {
      mode,
      sampleSize,
      sampleDays: data.sampleDays ?? daily.length,
      sampleTrades: data.sampleTrades ?? trades.length,
      driftDaily: Math.round(drift * 10000) / 10000,
      volDaily: Math.round(vol * 10000) / 10000,
      startEquity: Math.round(startEquity * 100) / 100,
    },
  };
}
