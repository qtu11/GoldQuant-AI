import { TradingAccount } from '../store/useTradingStore';
import { toUsd } from './currency';
import { netCapitalMoves, totalFloatingPnl } from './capitalEquity';
import { filterTradesByPeriod, calculateStats, calculateRiskScore } from './analytics';

/**
 * Sinh HTML báo cáo tuần (in / Save as PDF từ browser).
 * @param homeUrl — URL dashboard (để nút quay lại home)
 */
export function buildWeeklyReportHtml(
  accounts: TradingAccount[],
  homeUrl = '/'
): string {
  const now = new Date();
  const dateStr = now.toLocaleString('vi-VN');
  const safeHome = homeUrl || '/';

  const totalEquity = accounts.reduce((s, a) => s + toUsd(a.currentEquity, a.currency), 0);
  const totalProfit = accounts.reduce((s, a) => s + toUsd(a.stats.netProfit, a.currency), 0);
  const totalFloat = accounts.reduce(
    (s, a) => s + toUsd(totalFloatingPnl(a.openPositions || [], 100, a.currency), a.currency),
    0
  );
  const totalTrades = accounts.reduce((s, a) => s + a.stats.totalTrades, 0);

  const rows = accounts
    .map((a) => {
      const weekTrades = filterTradesByPeriod(a.trades || [], '1w');
      const weekStats = calculateStats(weekTrades, a.initialCapital, a.capitalMoves || []);
      const risk = calculateRiskScore(a.stats);
      const moves = netCapitalMoves(a.capitalMoves || []);
      return `
      <tr>
        <td><strong>${a.accountName || a.id}</strong><br/><small>${a.id} · ${a.broker}</small></td>
        <td class="num">$${toUsd(a.currentEquity, a.currency).toFixed(2)}</td>
        <td class="num ${toUsd(a.stats.netProfit, a.currency) >= 0 ? 'pos' : 'neg'}">
          ${toUsd(a.stats.netProfit, a.currency) >= 0 ? '+' : ''}$${toUsd(a.stats.netProfit, a.currency).toFixed(2)}
        </td>
        <td class="num">${a.stats.maxDrawdown}%</td>
        <td class="num">${a.stats.profitFactor}</td>
        <td class="num">${a.stats.winRate}%</td>
        <td class="num">${risk.score} (${risk.label})</td>
        <td class="num">${weekStats.totalTrades} / $${toUsd(weekStats.netProfit, a.currency).toFixed(2)}</td>
        <td class="num">$${toUsd(moves, a.currency).toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>GoldQuant AI — Weekly Report</title>
  <link rel="icon" href="${safeHome.replace(/\/$/, '')}/favicon-32.png" type="image/png"/>
  <meta name="theme-color" content="#0b0f1a"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0b0f1a; color: #eef2ff; padding: 32px; }
    h1 { background: linear-gradient(90deg, #f472b6, #a78bfa, #22d3ee); -webkit-background-clip: text; color: transparent; font-size: 28px; margin: 0 0 4px; }
    .sub { color: #8b95b0; font-size: 12px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { background: #151b2d; border: 1px solid #2a3350; border-radius: 12px; padding: 16px; border-top: 2px solid #22d3ee; }
    .kpi span { display: block; font-size: 10px; text-transform: uppercase; color: #8b95b0; letter-spacing: 0.06em; }
    .kpi strong { font-size: 20px; font-family: ui-monospace, monospace; margin-top: 8px; display: block; }
    table { width: 100%; border-collapse: collapse; background: #151b2d; border-radius: 12px; overflow: hidden; font-size: 12px; }
    th { text-align: left; padding: 10px 12px; background: #12101f; color: #8b95b0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
    td { padding: 10px 12px; border-top: 1px solid #2a3350; vertical-align: top; }
    .num { font-family: ui-monospace, monospace; text-align: right; }
    .pos { color: #34d399; }
    .neg { color: #fb7185; }
    footer { margin-top: 24px; font-size: 11px; color: #8b95b0; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 20px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700;
      text-decoration: none; cursor: pointer; border: 1px solid #2a3350;
      background: #151b2d; color: #eef2ff; font-family: inherit;
    }
    .btn:hover { border-color: #22d3ee; color: #22d3ee; }
    .btn-primary {
      background: linear-gradient(90deg, rgba(244,114,182,0.25), rgba(34,211,238,0.2));
      border-color: rgba(34,211,238,0.45); color: #22d3ee;
    }
    .btn-primary:hover { filter: brightness(1.1); }
    @media print {
      body { background: #fff; color: #111; }
      .kpi, table { background: #f8fafc; border-color: #e2e8f0; }
      th { background: #f1f5f9; color: #64748b; }
      td { border-color: #e2e8f0; }
      h1 { color: #7c3aed; -webkit-text-fill-color: #7c3aed; }
      .toolbar, .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <a class="btn btn-primary" id="btn-home" href="${safeHome}">← Về Dashboard (Home)</a>
    <button type="button" class="btn" onclick="window.print()">In / Save PDF</button>
    <button type="button" class="btn" id="btn-close" onclick="tryClose()">Đóng tab</button>
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px">
    <img src="${safeHome.replace(/\/$/, '')}/logo-neon.jpg" alt="GoldQuant AI" width="48" height="48" style="border-radius:12px;border:1px solid rgba(34,211,238,0.35);object-fit:cover"/>
    <div>
      <h1 style="margin:0">GoldQuant AI — Weekly Report</h1>
    </div>
  </div>
  <h1 style="display:none">GoldQuant AI — Weekly Report</h1>
  <p class="sub">Xuất lúc ${dateStr} · Solo Risk Manager · ${accounts.length} tài khoản</p>

  <div class="kpis">
    <div class="kpi"><span>Total Equity</span><strong>$${totalEquity.toFixed(2)}</strong></div>
    <div class="kpi"><span>Closed PnL</span><strong class="${totalProfit >= 0 ? 'pos' : 'neg'}">${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}</strong></div>
    <div class="kpi"><span>Floating PnL</span><strong class="${totalFloat >= 0 ? 'pos' : 'neg'}">${totalFloat >= 0 ? '+' : ''}$${totalFloat.toFixed(2)}</strong></div>
    <div class="kpi"><span>Total Trades</span><strong>${totalTrades}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Account</th>
        <th class="num">Equity</th>
        <th class="num">Net PnL</th>
        <th class="num">Max DD</th>
        <th class="num">PF</th>
        <th class="num">WR</th>
        <th class="num">Risk</th>
        <th class="num">1W trades / PnL</th>
        <th class="num">Net D/W</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9">Chưa có tài khoản</td></tr>'}
    </tbody>
  </table>

  <footer>
    GoldQuant AI Neon · In trang này (Ctrl+P) → Save as PDF. Dữ liệu private solo.
  </footer>
  <script>
    var HOME = ${JSON.stringify(safeHome)};
    function tryClose() {
      try { window.close(); } catch (e) {}
    }
    function goHome() {
      // Ưu tiên focus tab app + đóng report
      try {
        if (window.opener && !window.opener.closed) {
          try { window.opener.focus(); } catch (e1) {}
          try {
            if (window.opener.location && window.opener.location.href) {
              /* giữ nguyên trang opener (đã là home/dashboard) */
            }
          } catch (e2) {}
          tryClose();
          // Nếu browser không cho close about:blank → điều hướng
          setTimeout(function () {
            if (!window.closed) window.location.href = HOME;
          }, 150);
          return;
        }
      } catch (e) {}
      window.location.href = HOME;
    }
    var homeBtn = document.getElementById('btn-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', function (ev) {
        // about:blank: href=/ có thể sai → chặn và goHome()
        if (location.protocol === 'about:' || location.href === 'about:blank') {
          ev.preventDefault();
          goHome();
        }
      });
    }
  </script>
</body>
</html>`;
}

export function openWeeklyReport(accounts: TradingAccount[]) {
  const homeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : '/';
  const html = buildWeeklyReportHtml(accounts, homeUrl);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Trình duyệt chặn popup. Cho phép popup để xuất báo cáo.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
