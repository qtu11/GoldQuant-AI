import { NextResponse } from 'next/server';
import {
  fetchForexFactoryWeek,
  filterCalendarEvents,
  type NewsImpact,
} from '../../../../utils/economicCalendar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/quant/calendar
 * Query:
 *  - force=1
 *  - currency=USD
 *  - impact=High | High|Medium
 *  - gold=1
 *  - upcoming=1
 *  - limit=20
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === '1';
    const currency = searchParams.get('currency') || undefined;
    const impact = searchParams.get('impact') as NewsImpact | 'High|Medium' | null;
    const goldOnly = searchParams.get('gold') === '1';
    const upcomingOnly = searchParams.get('upcoming') !== '0';
    // limit=0 hoặc bỏ trống → full tuần; mặc định 0 = không cắt
    const limitRaw = searchParams.get('limit');
    const limit =
      limitRaw == null || limitRaw === ''
        ? 0
        : Number(limitRaw);

    const snap = await fetchForexFactoryWeek(force);
    const filtered = filterCalendarEvents(snap.events, {
      currency,
      impact: impact || undefined,
      goldOnly,
      upcomingOnly,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        ...snap,
        events: filtered,
        totalWeek: snap.events.length,
        filtered: filtered.length,
        weekKey: snap.weekKey,
        eventCount: snap.eventCount ?? snap.events.length,
      },
      {
        // Client có thể cache nhẹ — giảm spam FF
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[calendar route]', err);
    return NextResponse.json(
      {
        ok: false,
        events: [],
        error: err instanceof Error ? err.message : 'Calendar fetch failed',
        hint:
          'HTTP 429 = gọi quá nhiều. Đợi 5–15 phút hoặc bấm refresh sau. Cache server 30 phút.',
      },
      { status: 200 } // 200 + ok:false để UI không crash; không 502 spam retry
    );
  }
}
