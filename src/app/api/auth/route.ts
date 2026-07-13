import { NextResponse } from 'next/server';
import crypto from 'crypto';

function getCorrectToken() {
  const login = process.env.ADMIN_LOGIN || 'QTUSDEV207';
  const password = process.env.ADMIN_PASSWORD || '123456@';
  // Generate a stable hash token based on the env credentials
  return crypto
    .createHash('sha256')
    .update(`${login}:${password}:goldquant_salt_2026`)
    .digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, login, password, token } = body;

    const correctToken = getCorrectToken();

    if (action === 'login') {
      const correctLogin = process.env.ADMIN_LOGIN || 'QTUSDEV207';
      const correctPassword = process.env.ADMIN_PASSWORD || '123456@';

      if (login === correctLogin && password === correctPassword) {
        return NextResponse.json({ success: true, token: correctToken });
      } else {
        return NextResponse.json({ success: false, error: 'Sai tài khoản hoặc mật khẩu' });
      }
    }

    if (action === 'verify') {
      if (token === correctToken) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ success: false });
      }
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ success: false, error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
