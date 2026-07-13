/**
 * Gemini generateContent yêu cầu contents:
 * - Bắt đầu bằng role "user"
 * - Xen kẽ user / model (không 2 user hoặc 2 model liền nhau)
 * - Kết thúc bằng role "user" (câu hỏi hiện tại)
 */

export type GeminiContent = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

export function sanitizeGeminiContents(
  raw: { role: string; parts: { text: string }[] }[]
): GeminiContent[] {
  const cleaned: GeminiContent[] = [];

  for (const item of raw) {
    const text = (item.parts?.[0]?.text || '').trim();
    if (!text) continue;
    const role: 'user' | 'model' = item.role === 'user' ? 'user' : 'model';

    if (cleaned.length === 0) {
      // Bắt buộc mở đầu bằng user
      if (role === 'model') {
        cleaned.push({
          role: 'user',
          parts: [{ text: '[Ngữ cảnh chat trước]' }],
        });
        cleaned.push({ role: 'model', parts: [{ text }] });
      } else {
        cleaned.push({ role: 'user', parts: [{ text }] });
      }
      continue;
    }

    const last = cleaned[cleaned.length - 1];
    if (last.role === role) {
      // Gộp tin nhắn cùng role thay vì gửi invalid sequence
      last.parts[0].text += `\n\n${text}`;
    } else {
      cleaned.push({ role, parts: [{ text }] });
    }
  }

  // Rỗng → placeholder user (tránh Gemini 400)
  if (!cleaned.length) {
    return [{ role: 'user', parts: [{ text: 'Xin chào' }] }];
  }

  // Kết thúc phải là user — nếu history kết bằng model, thêm prompt nhẹ
  if (cleaned[cleaned.length - 1].role === 'model') {
    cleaned.push({
      role: 'user',
      parts: [{ text: 'Tiếp tục phân tích ngắn gọn.' }],
    });
  }

  return cleaned;
}
