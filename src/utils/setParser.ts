/**
 * Parse MT5 Expert Advisor .set files + daily PnL series for Bot Research.
 * .set formats: key=value | key=value||default||step||optimize | ;comments
 */

export interface SetParam {
  key: string;
  value: string;
  /** Giá trị gốc từ file (nếu có dạng value||...) */
  rawValue?: string;
  defaultValue?: string;
  step?: string;
  optimize?: boolean;
  /** AI / user note ngắn */
  note?: string;
}

export interface DailyPnlPoint {
  date: string; // YYYY-MM-DD
  profit: number;
  note?: string;
}

export interface ParsedSetFile {
  params: SetParam[];
  fileName: string;
  botHint: string;
  lineCount: number;
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/** Decode UTF-8 / UTF-16 LE .set */
export function decodeSetBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
  if (u8.length > 8) {
    let zeros = 0;
    for (let i = 1; i < Math.min(u8.length, 200); i += 2) {
      if (u8[i] === 0) zeros++;
    }
    if (zeros > 40) return new TextDecoder('utf-16le').decode(u8);
  }
  return new TextDecoder('utf-8').decode(u8);
}

/**
 * Parse nội dung .set → danh sách tham số chỉnh sửa được.
 */
export function parseSetContent(text: string, fileName = 'bot.set'): ParsedSetFile {
  const clean = stripBom(String(text || ''));
  const lines = clean.split(/\r?\n/);
  const params: SetParam[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }
    // key=value...
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    // Bỏ section headers kiểu [Chart] nếu lỡ parse
    if (key.startsWith('[')) continue;

    let rest = trimmed.slice(eq + 1).trim();
    // Bỏ comment cuối dòng ; ...
    const semi = rest.indexOf(';');
    if (semi >= 0 && !rest.includes('||')) {
      rest = rest.slice(0, semi).trim();
    }

    let value = rest;
    let defaultValue: string | undefined;
    let step: string | undefined;
    let optimize: boolean | undefined;

    if (rest.includes('||')) {
      const parts = rest.split('||').map((p) => p.trim());
      value = parts[0] ?? '';
      defaultValue = parts[1];
      step = parts[2];
      const opt = (parts[3] || '').toUpperCase();
      optimize = opt === 'Y' || opt === 'YES' || opt === '1' || opt === 'TRUE';
    }

    seen.add(key.toLowerCase());
    params.push({
      key,
      value,
      rawValue: rest,
      defaultValue,
      step,
      optimize,
    });
  }

  // Gợi ý tên bot từ file name
  const base = fileName.replace(/\.set$/i, '').replace(/[_-]+/g, ' ').trim();
  const botHint = base || 'EA / Bot';

  return {
    params,
    fileName: fileName || 'bot.set',
    botHint,
    lineCount: lines.length,
  };
}

/** Xuất lại .set (giữ format MT5 value||default||step||Y/N khi có meta) */
export function exportSetContent(params: SetParam[], headerNote?: string): string {
  const lines: string[] = [];
  lines.push(`; GoldQuant Bot Research export`);
  if (headerNote) lines.push(`; ${headerNote}`);
  lines.push(`; ${new Date().toISOString()}`);
  lines.push('');
  for (const p of params) {
    if (!p.key) continue;
    if (
      p.defaultValue !== undefined ||
      p.step !== undefined ||
      p.optimize !== undefined
    ) {
      const opt = p.optimize ? 'Y' : 'N';
      lines.push(
        `${p.key}=${p.value}||${p.defaultValue ?? p.value}||${p.step ?? '0'}||${opt}`
      );
    } else {
      lines.push(`${p.key}=${p.value}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Parse series lợi nhuận ngày:
 * - CSV: date,profit
 * - tab/space
 * - JSON array
 * - 1 số / dòng (gán ngày giả từ hôm nay lùi)
 */
export function parseDailyPnlText(text: string): DailyPnlPoint[] {
  const raw = String(text || '').trim();
  if (!raw) return [];

  // JSON
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw);
      const arr = Array.isArray(data) ? data : data.days || data.series || [];
      return (arr as unknown[])
        .map((row) => {
          if (typeof row === 'number') {
            return { date: '', profit: row };
          }
          const o = row as Record<string, unknown>;
          const profit = Number(o.profit ?? o.pnl ?? o.net ?? o.value ?? 0);
          const date = String(o.date ?? o.day ?? o.time ?? '').slice(0, 10);
          return { date, profit: Number.isFinite(profit) ? profit : 0 };
        })
        .filter((p) => Number.isFinite(p.profit));
    } catch {
      /* fall through */
    }
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const points: DailyPnlPoint[] = [];
  let pureIndex = 0;

  for (const line of lines) {
    if (/^(date|ngày|day|profit|pnl)/i.test(line) && line.includes(',')) continue;

    // date,profit | date\tprofit | date profit
    const m = line.match(
      /^(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})[,;\t\s]+([+-]?\d+(?:[.,]\d+)?)/
    );
    if (m) {
      const date = m[1]
        .replace(/\./g, '-')
        .replace(/\//g, '-')
        .replace(
          /(\d{4})-(\d{1,2})-(\d{1,2})/,
          (_, y, mo, d) =>
            `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
        );
      const profit = parseFloat(m[2].replace(',', '.'));
      if (Number.isFinite(profit)) points.push({ date, profit });
      continue;
    }

    // profit only
    const n = parseFloat(line.replace(/[^\d,.\-+]/g, '').replace(',', '.'));
    if (Number.isFinite(n) && /[0-9]/.test(line)) {
      const d = new Date();
      d.setDate(d.getDate() - pureIndex);
      pureIndex += 1;
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      points.push({ date, profit: n });
    }
  }

  // pure-only lines were assigned newest-first; reverse so chronological
  if (points.every((p) => p.date) && pureIndex === points.length) {
    points.reverse();
  }

  return points;
}

export function summarizeDailyPnl(points: DailyPnlPoint[]) {
  if (!points.length) {
    return {
      days: 0,
      total: 0,
      avg: 0,
      wins: 0,
      losses: 0,
      maxWin: 0,
      maxLoss: 0,
      winRate: 0,
    };
  }
  let total = 0;
  let wins = 0;
  let losses = 0;
  let maxWin = 0;
  let maxLoss = 0;
  points.forEach((p) => {
    total += p.profit;
    if (p.profit > 0) {
      wins += 1;
      maxWin = Math.max(maxWin, p.profit);
    } else if (p.profit < 0) {
      losses += 1;
      maxLoss = Math.min(maxLoss, p.profit);
    }
  });
  const decided = wins + losses;
  return {
    days: points.length,
    total: Math.round(total * 100) / 100,
    avg: Math.round((total / points.length) * 100) / 100,
    wins,
    losses,
    maxWin: Math.round(maxWin * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0,
  };
}

/** Tham số quan trọng thường gặp — ưu tiên hiển thị đầu */
const PRIORITY_KEYS = [
  'lot',
  'lots',
  'volume',
  'risk',
  'riskpercent',
  'risk%',
  'sl',
  'stoploss',
  'tp',
  'takeprofit',
  'maxlot',
  'minlot',
  'maxorders',
  'maxpos',
  'grid',
  'step',
  'distance',
  'multiplier',
  'martingale',
  'trailing',
  'breakeven',
  'magic',
  'slippage',
  'spread',
  'time',
  'session',
  'equity',
  'dd',
  'drawdown',
  'protection',
];

export function sortParamsForUi(params: SetParam[]): SetParam[] {
  const score = (k: string) => {
    const lk = k.toLowerCase();
    const idx = PRIORITY_KEYS.findIndex((p) => lk.includes(p));
    return idx >= 0 ? idx : 500 + k.length;
  };
  return [...params].sort((a, b) => score(a.key) - score(b.key) || a.key.localeCompare(b.key));
}

/** Rule-engine gợi ý lot/risk khi LLM offline — không lộ lỗi kỹ thuật */
export function ruleBasedParamSuggestions(opts: {
  params: SetParam[];
  equityUsd: number;
  maxDrawdown: number;
  riskScore: number;
  dailySummary: ReturnType<typeof summarizeDailyPnl>;
}): { key: string; value: string; reason: string }[] {
  const { params, equityUsd, maxDrawdown, riskScore, dailySummary } = opts;
  const out: { key: string; value: string; reason: string }[] = [];
  const eq = Math.max(50, equityUsd || 0);

  // Risk % target theo DD / risk score
  let targetRiskPct = 1;
  if (maxDrawdown > 15 || riskScore >= 70) targetRiskPct = 0.5;
  else if (maxDrawdown > 8 || riskScore >= 50) targetRiskPct = 0.75;
  else if (dailySummary.winRate >= 60 && maxDrawdown < 5) targetRiskPct = 1.25;

  // Lot gợi ý XAU: ~$100 / 1 lot / $1 move; risk 1% equity với SL 50$ ≈ lot = risk$/(50*100)
  const riskUsd = (eq * targetRiskPct) / 100;
  const assumedSlUsd = 50; // $ move
  const suggestedLot = Math.max(
    0.01,
    Math.floor((riskUsd / (assumedSlUsd * 100)) * 100) / 100
  );

  const find = (pred: (k: string) => boolean) =>
    params.find((p) => pred(p.key.toLowerCase()));

  const lotP = find(
    (k) =>
      (k.includes('lot') || k.includes('volume') || k === 'size') &&
      !k.includes('max') &&
      !k.includes('min')
  );
  if (lotP) {
    out.push({
      key: lotP.key,
      value: String(suggestedLot),
      reason: `Equity ~$${Math.round(eq)} · risk ~${targetRiskPct}% · SL giả định $50`,
    });
  }

  const riskP = find((k) => k.includes('risk') && (k.includes('percent') || k.includes('%') || k.includes('pct')));
  if (riskP) {
    out.push({
      key: riskP.key,
      value: String(targetRiskPct),
      reason:
        maxDrawdown > 10
          ? `DD ${maxDrawdown}% cao — siết risk`
          : `Cân bằng theo risk score ${riskScore}`,
    });
  }

  const maxLot = find((k) => k.includes('max') && k.includes('lot'));
  if (maxLot) {
    const cap = Math.max(0.01, Math.round(suggestedLot * 3 * 100) / 100);
    out.push({
      key: maxLot.key,
      value: String(cap),
      reason: 'Trần lot ≈ 3× lot gợi ý',
    });
  }

  const grid = find((k) => k.includes('grid') || k.includes('martingale') || k.includes('multiplier'));
  if (grid && (maxDrawdown > 10 || riskScore >= 60)) {
    const n = parseFloat(grid.value);
    if (Number.isFinite(n) && n > 1.2) {
      out.push({
        key: grid.key,
        value: String(Math.max(1.1, Math.round(n * 0.85 * 100) / 100)),
        reason: 'Giảm hệ số grid/martingale khi DD/risk cao',
      });
    }
  }

  return out;
}
