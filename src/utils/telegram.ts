/**
 * Telegram client helper + anti-spam (browser).
 * Server news alerts dùng sendTelegramServer riêng (cũng có rate limit).
 */

const CLIENT_MIN_MS = 45_000; // 45s giữa 2 lần gửi từ browser
let lastClientSendAt = 0;
const recentHashes = new Map<string, number>(); // hash → expiry

function hashMsg(msg: string): string {
  let h = 0;
  const s = msg.slice(0, 500);
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Gửi Telegram qua /api/telegram.
 * - Rate limit 45s
 * - Trùng nội dung trong 10 phút → bỏ qua
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const msg = String(message || '').trim();
  if (!msg) return false;

  const now = Date.now();
  const h = hashMsg(msg);

  // Dedup nội dung 10 phút
  const exp = recentHashes.get(h);
  if (exp && exp > now) {
    console.info('[telegram] skip duplicate message');
    return true; // coi như OK — không spam
  }

  if (now - lastClientSendAt < CLIENT_MIN_MS) {
    console.info('[telegram] rate-limited (client 45s)');
    return false;
  }

  try {
    lastClientSendAt = now;
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('Failed to send Telegram notification:', data?.error);
      return false;
    }

    recentHashes.set(h, now + 10 * 60 * 1000);
    // dọn map cũ
    if (recentHashes.size > 40) {
      recentHashes.forEach((v, k) => {
        if (v < now) recentHashes.delete(k);
      });
    }
    return true;
  } catch (err) {
    console.error('Error calling local Telegram API route:', err);
    return false;
  }
}
