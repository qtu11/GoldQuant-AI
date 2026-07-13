import { NextResponse } from 'next/server';
import { getLiveGoldQuote } from '../../../../utils/goldPrice';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quant/gold-price
 * Trả quote XAU realtime cho UI ticker / AI context.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === '1';
    const quote = await getLiveGoldQuote(force);
    return NextResponse.json(
      { ok: true, quote, stale: quote.stale },
      {
        headers: {
          // Client có thể giữ 30s — server cache nội bộ 45s
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (err) {
    console.error('[gold-price route]', err);
    // NEVER 502 — UI ticker/AI vẫn sống với placeholder
    return NextResponse.json(
      {
        ok: false,
        quote: {
          symbol: 'XAUUSD',
          priceUsd: 0,
          currency: 'USD',
          source: 'Unavailable',
          updatedAt: new Date().toISOString(),
          updatedAtReadable: 'lỗi server',
          change24hPct: null,
          bid: null,
          ask: null,
          stale: true,
        },
        error: 'Failed to fetch gold price',
      },
      { status: 200 }
    );
  }
}
