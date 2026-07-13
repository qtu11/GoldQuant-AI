import { Trade, parseDate } from './fileParser';
import type { CapitalMove } from './capitalEquity';

export interface EquityPoint {
  index: number;
  label: string;
  equity: number;
  drawdown: number;
  profit: number;
  ticket: string;
}

type CurveEvent = {
  time: number;
  net: number;
  ticket: string;
  kind: 'trade' | 'capital';
};

/**
 * Xây equity curve từ lệnh đã đóng (+ optional nạp/rút) theo thời gian.
 * Equity = initial + trade PnL + capital moves (đồng bộ computeClosedEquity).
 */
export function buildEquityCurve(
  trades: Trade[],
  initialCapital: number,
  capitalMoves: CapitalMove[] = []
): EquityPoint[] {
  const events: CurveEvent[] = [];

  trades.forEach((t) => {
    const time = parseDate(t.closeTime || t.openTime).getTime();
    if (isNaN(time)) return;
    events.push({
      time,
      net: t.profit + t.commission + t.swap,
      ticket: t.ticket || '-',
      kind: 'trade',
    });
  });

  capitalMoves.forEach((m) => {
    const raw = m.date || m.createdAt || '';
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    const time = d.getTime();
    if (isNaN(time)) return;
    const signed = (Number(m.amount) || 0) * (m.type === 'deposit' ? 1 : -1);
    events.push({
      time,
      net: signed,
      ticket: m.type === 'deposit' ? 'DEP' : 'WD',
      kind: 'capital',
    });
  });

  if (!events.length) {
    return [
      {
        index: 0,
        label: 'Start',
        equity: initialCapital,
        drawdown: 0,
        profit: 0,
        ticket: '-',
      },
    ];
  }

  events.sort((a, b) => a.time - b.time);

  const points: EquityPoint[] = [
    {
      index: 0,
      label: 'Start',
      equity: initialCapital,
      drawdown: 0,
      profit: 0,
      ticket: '-',
    },
  ];

  let equity = initialCapital;
  let peak = initialCapital;

  events.forEach((e, i) => {
    equity += e.net;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    const d = new Date(e.time);
    // YYYY-MM-DD — tránh collision cùng MM/DD khác năm khi aggregate
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    points.push({
      index: i + 1,
      label,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(dd * 10) / 10,
      profit: Math.round(e.net * 100) / 100,
      ticket: e.ticket,
    });
  });

  return points;
}

/**
 * Gộp equity theo ngày (giữ EOD — điểm cuối mỗi ngày).
 * Giữ thứ tự thời gian.
 */
export function aggregateEquityByDay(points: EquityPoint[]): EquityPoint[] {
  if (points.length <= 2) return points;
  const out: EquityPoint[] = [];
  const seen = new Map<string, number>(); // label → index in out

  points.forEach((p) => {
    if (p.index === 0) {
      out.push(p);
      seen.set('Start', 0);
      return;
    }
    const prev = seen.get(p.label);
    if (prev === undefined) {
      seen.set(p.label, out.length);
      out.push(p);
    } else {
      // Cập nhật EOD (cùng ngày → điểm cuối)
      out[prev] = { ...p, index: out[prev].index };
    }
  });

  return out;
}
