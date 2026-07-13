import { NextResponse } from 'next/server';
import { runNewsAlertCheck } from '../../../../utils/newsAlertService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quant/news-alerts
 *  - dry=1     → chỉ preview, không gửi
 *  - force=1   → bỏ qua cache calendar nếu được
 *
 * POST body: { dryRun?: boolean, force?: boolean }
 *
 * Client poll ~60–90s khi user đăng nhập → tự gửi Telegram khi vào cửa sổ 5h / LIVE.
 * Có thể gắn cron ngoài: curl -X POST https://host/api/quant/news-alerts
 */
async function handle(req: Request) {
  try {
    const url = new URL(req.url);
    let dryRun = url.searchParams.get('dry') === '1';
    let force = url.searchParams.get('force') === '1';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.dryRun === true) dryRun = true;
        if (body?.force === true) force = true;
      } catch {
        /* empty body ok */
      }
    }

    const result = await runNewsAlertCheck({ dryRun, force });
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    // UX: không 500 spam — payload sạch
    return NextResponse.json(
      {
        ok: true,
        checkedAt: new Date().toISOString(),
        sent: [],
        telegramSent: [],
        pending: [],
        digest: [],
        upcomingMajors: [],
        weekEventCount: 0,
        majorCount: 0,
        weekKey: '',
        telegramOk: false,
        telegramConfigured: !!(
          process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
        ),
        source: 'fallback',
        weekLabel: '',
        message: 'Lịch tin tạm chưa sẵn sàng — thử lại sau.',
      },
      { status: 200 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
