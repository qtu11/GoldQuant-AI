import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const RATE_MS = 40_000; // 40s giữa 2 message (mọi nguồn)
const RATE_FILE = path.join(process.cwd(), '.data', 'telegram-api-rate.json');
const DEDUP_FILE = path.join(process.cwd(), '.data', 'telegram-api-dedup.json');
const DEDUP_TTL_MS = 10 * 60 * 1000;

function simpleHash(s: string): string {
  let h = 0;
  const t = s.slice(0, 400);
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return String(h);
}

function ensureDataDir() {
  const d = path.join(process.cwd(), '.data');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function rateOk(): boolean {
  try {
    if (!fs.existsSync(RATE_FILE)) return true;
    const j = JSON.parse(fs.readFileSync(RATE_FILE, 'utf8')) as { lastAt?: number };
    return Date.now() - (Number(j.lastAt) || 0) >= RATE_MS;
  } catch {
    return true;
  }
}

function touchRate() {
  try {
    ensureDataDir();
    fs.writeFileSync(RATE_FILE, JSON.stringify({ lastAt: Date.now() }), 'utf8');
  } catch {
    /* ignore */
  }
}

function isDuplicate(hash: string): boolean {
  try {
    if (!fs.existsSync(DEDUP_FILE)) return false;
    const j = JSON.parse(fs.readFileSync(DEDUP_FILE, 'utf8')) as {
      items?: Record<string, number>;
    };
    const exp = j.items?.[hash];
    return !!(exp && exp > Date.now());
  } catch {
    return false;
  }
}

function rememberHash(hash: string) {
  try {
    ensureDataDir();
    let items: Record<string, number> = {};
    if (fs.existsSync(DEDUP_FILE)) {
      const j = JSON.parse(fs.readFileSync(DEDUP_FILE, 'utf8')) as {
        items?: Record<string, number>;
      };
      items = j.items || {};
    }
    const now = Date.now();
    Object.keys(items).forEach((k) => {
      if (items[k] < now) delete items[k];
    });
    items[hash] = now + DEDUP_TTL_MS;
    fs.writeFileSync(DEDUP_FILE, JSON.stringify({ items }), 'utf8');
  } catch {
    /* ignore */
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message || '').trim();
    if (!message) {
      return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        { error: 'Telegram configuration is missing in environment variables (.env)' },
        { status: 500 }
      );
    }

    const hash = simpleHash(message);
    if (isDuplicate(hash)) {
      // Anti-spam: coi như success — không gửi lại
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'duplicate_10m',
      });
    }

    if (!rateOk()) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          reason: 'rate_limit_40s',
          error: 'Telegram rate limit — thử lại sau ~40s',
        },
        { status: 429 }
      );
    }

    touchRate();

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Telegram Bot API response error:', data);
      return NextResponse.json(
        { error: data.description || 'Failed to send Telegram message' },
        { status: 400 }
      );
    }

    rememberHash(hash);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Internal server error sending Telegram alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
