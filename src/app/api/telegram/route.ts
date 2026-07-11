import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error('Telegram configuration missing: Bot token or Chat ID is not set.');
      return NextResponse.json(
        { error: 'Telegram configuration is missing in environment variables (.env)' }, 
        { status: 500 }
      );
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error('Telegram Bot API response error:', data);
      return NextResponse.json(
        { error: data.description || 'Failed to send Telegram message' }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Internal server error sending Telegram alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
