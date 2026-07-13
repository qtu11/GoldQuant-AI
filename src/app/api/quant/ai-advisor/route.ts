import { NextResponse } from 'next/server';
import {
  formatGoldQuoteForAI,
  getLiveGoldQuote,
  isGoldPriceQuestion,
  type GoldQuote,
} from '../../../../utils/goldPrice';
import {
  fetchForexFactoryWeek,
  formatCalendarForAI,
} from '../../../../utils/economicCalendar';
import { sanitizeGeminiContents } from '../../../../utils/geminiContents';
import { callAdvisorLlm, type LlmMessage } from '../../../../utils/llmProviders';

export const dynamic = 'force-dynamic';

function isNewsQuestion(text: string): boolean {
  const t = (text || '').toLowerCase();
  return [
    'tin tức',
    'tin tuc',
    'calendar',
    'lịch kinh tế',
    'lich kinh te',
    'nfp',
    'cpi',
    'fomc',
    'news',
    'sự kiện',
    'su kien',
    'hôm nay có tin',
    'hom nay co tin',
    'high impact',
    'tác động',
    'tac dong',
    'phân tích chi tiết sự kiện',
    'impact',
  ].some((k) => t.includes(k));
}

function isRiskQuestion(text: string): boolean {
  const t = (text || '').toLowerCase();
  return [
    'lot',
    'rủi ro',
    'rui ro',
    'risk',
    'drawdown',
    'dd',
    'position',
    'vốn',
    'von',
    'size',
    'margin',
    'session',
    'asia',
    'london',
    'new york',
    'portfolio',
    'tài khoản',
    'tai khoan',
  ].some((k) => t.includes(k));
}

/** Trả lời khi LLM fail — vẫn hữu dụng với data live */
function buildDeterministicReply(opts: {
  message: string;
  gold: GoldQuote;
  calendarBlock: string;
  portfolioContext?: string;
  llmError?: string;
}): string {
  const { message, gold, calendarBlock, portfolioContext, llmError } = opts;
  const lines: string[] = [];

  lines.push(
    `Dạ thưa Chủ tịch Tú, **AI model tạm gián đoạn** (quota/high-demand) — dưới đây là **feed realtime + rule engine** (không bịa số).`
  );
  if (llmError) {
    lines.push(`\n_Chi tiết kỹ thuật: \`${llmError.slice(0, 120)}\`_`);
  }

  if (gold.priceUsd > 0) {
    lines.push(
      `\n### Giá vàng XAUUSD\n` +
        `- **$${gold.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / oz**\n` +
        `- Nguồn: **${gold.source}**${gold.stale ? ' · *cache/stale*' : ' · live'}\n` +
        `- Cập nhật: ${gold.updatedAtReadable}`
    );
  } else {
    lines.push(
      `\n### Giá vàng\n- Chưa lấy được feed live (DNS/API). Kiểm tra mạng hoặc \`GOLDAPI_IO_KEY\`.`
    );
  }

  if (isNewsQuestion(message) && calendarBlock) {
    // Rút gọn calendar block cho UI
    const clipped =
      calendarBlock.length > 1800
        ? calendarBlock.slice(0, 1800) + '\n…'
        : calendarBlock;
    lines.push(`\n### Lịch kinh tế (Forex Factory)\n${clipped}`);
    lines.push(
      `\n**Rule session:** giảm lot / tránh entry mới ±15–30 phút quanh High Impact USD (NFP, CPI, FOMC).`
    );
  }

  if (portfolioContext?.trim()) {
    lines.push(
      `\n### Portfolio nội bộ\n\`\`\`\n${portfolioContext.trim().slice(0, 1200)}\n\`\`\``
    );
  }

  if (isRiskQuestion(message) || isGoldPriceQuestion(message)) {
    lines.push(
      `\n### Gợi ý risk (rule-based)\n` +
        `1. Risk/lệnh **≤ 0.5–1%** equity (prop: siết hơn nếu gần max DD).\n` +
        `2. Lot ≈ risk$ / (SL$ × pip value) — XAU: 1.0 lot ~ $100 / $1 move.\n` +
        `3. Tránh scale-in khi floating âm + DD > 3–5% ngày.\n` +
        `4. Ưu tiên session London/NY overlap; Asia chỉ nếu setup sẵn.`
    );
  }

  lines.push(
    `\nChủ tịch có thể **thử lại sau 30–60s** (Gemini 429/503 thường tạm thời), hoặc cấu hình \`XAI_API_KEY\` (Grok) làm fallback ổn định.`
  );

  return lines.join('\n');
}

export async function POST(req: Request) {
  try {
    const { message, history, portfolioContext } = await req.json();

    const hasGemini = !!(
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    );
    const hasXai = !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);

    // Luôn lấy giá vàng realtime (cache 45s)
    const goldQuote = await getLiveGoldQuote(isGoldPriceQuestion(message || ''));
    const marketBlock = formatGoldQuoteForAI(goldQuote);

    let calendarBlock = '';
    try {
      const cal = await fetchForexFactoryWeek(isNewsQuestion(message || ''));
      calendarBlock = formatCalendarForAI(cal, 14);
    } catch (e) {
      console.warn('[ai-advisor] calendar fetch failed', e);
      calendarBlock =
        '[LỊCH KINH TẾ] Không lấy được Forex Factory feed lúc này. Không bịa lịch tin.';
    }

    if (!hasGemini && !hasXai) {
      if (isGoldPriceQuestion(message || '') && goldQuote.priceUsd > 0) {
        return NextResponse.json({
          reply:
            `Dạ thưa Chủ tịch Tú, **giá vàng realtime** (chưa bật LLM):\n\n` +
            `• **XAUUSD: $${goldQuote.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} / oz**\n` +
            `• Nguồn: ${goldQuote.source}\n` +
            `• Cập nhật: ${goldQuote.updatedAtReadable}\n\n` +
            `_Thêm \`GEMINI_API_KEY\` và/hoặc \`XAI_API_KEY\` vào \`.env\` để bật phân tích AI._`,
          market: goldQuote,
          meta: { provider: 'none', degraded: true },
        });
      }
      return NextResponse.json({
        reply: buildDeterministicReply({
          message: String(message || ''),
          gold: goldQuote,
          calendarBlock,
          portfolioContext:
            typeof portfolioContext === 'string' ? portfolioContext : undefined,
          llmError: 'missing GEMINI_API_KEY and XAI_API_KEY',
        }),
        market: goldQuote,
        meta: { provider: 'none', degraded: true },
      });
    }

    const portfolioBlock =
      typeof portfolioContext === 'string' && portfolioContext.trim()
        ? `\n[PORTFOLIO GOLDQUANT — DỮ LIỆU NỘI BỘ]\n${portfolioContext.trim()}\n`
        : '';

    const systemInstruction = `
Bạn là GoldQuant AI Advisor, chuyên gia quản trị rủi ro định lượng (Quantitative Risk Advisor), chuyên XAUUSD, prop firm (FTMO/MCF) và multi-account.

Xưng hô: luôn gọi "Chủ tịch Tú" / "Chủ tịch" — tôn trọng, quyết đoán, ngắn gọn, tiếng Việt, Markdown sạch.

${marketBlock}

${calendarBlock}
${portfolioBlock}

QUY TẮC BẮT BUỘC VỀ GIÁ VÀNG / THỊ TRƯỜNG:
1. Khi hỏi giá vàng, XAU, XAUUSD, spot, "hiện tại bao nhiêu" → dùng ĐÚNG số trong block [DỮ LIỆU THỊ TRƯỜNG VÀNG REALTIME] ở trên.
2. Nêu rõ: giá $, nguồn, thời điểm cập nhật.
3. CẤM dùng kiến thức training cũ làm giá hiện tại.
4. Nếu block báo không có dữ liệu live → thừa nhận thiếu feed, không bịa số.
5. Tư vấn risk (lot, DD, session, tin CPI/NFP) dựa trên số liệu; nếu có portfolio context thì ưu tiên số đó.

QUY TẮC LỊCH TIN / FOREX FACTORY:
1. Khi hỏi tin tức, calendar, NFP, CPI, FOMC → dùng block [LỊCH KINH TẾ REALTIME].
2. Cảnh báo giảm lot / tránh entry mới quanh High Impact USD (±15–30 phút).
3. CẤM bịa sự kiện không có trong list.

Phong cách: tập trung định lượng (lots, drawdown, margin, ATR, session) + 1–2 hành động cụ thể.
`.trim();

    const rawContents: { role: string; parts: { text: string }[] }[] = [];

    if (history && Array.isArray(history) && history.length > 0) {
      // Chỉ lấy 12 tin gần nhất — tránh token bloat + 429
      const recent = history.slice(-12);
      for (const msg of recent) {
        if (
          msg.sender === 'ai' &&
          typeof msg.text === 'string' &&
          msg.text.includes('GoldQuant AI Advisor') &&
          (msg.text.includes('MODERATE') || msg.text.includes('realtime'))
        ) {
          continue;
        }
        rawContents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.text || '').slice(0, 4000) }],
        });
      }
    }

    let userPayload = String(message || '').trim();
    if (!userPayload) {
      return NextResponse.json(
        { reply: 'Dạ thưa Chủ tịch, tin nhắn trống — vui lòng nhập câu hỏi.' },
        { status: 200 }
      );
    }
    if (isGoldPriceQuestion(userPayload) && goldQuote.priceUsd > 0) {
      userPayload +=
        `\n\n[SYSTEM_INJECT — giá live bắt buộc]\n` +
        `XAUUSD = $${goldQuote.priceUsd} (source ${goldQuote.source}, ${goldQuote.updatedAt})`;
    }
    if (isNewsQuestion(userPayload) && calendarBlock) {
      userPayload += `\n\n[SYSTEM_INJECT — dùng lịch FF trong system instruction]`;
    }

    rawContents.push({
      role: 'user',
      parts: [{ text: userPayload }],
    });

    const contents = sanitizeGeminiContents(rawContents);

    // OpenAI-style messages for xAI
    const openAiMessages: LlmMessage[] = [
      { role: 'system', content: systemInstruction },
    ];
    for (const c of contents) {
      openAiMessages.push({
        role: c.role === 'user' ? 'user' : 'assistant',
        content: c.parts.map((p) => p.text).join('\n'),
      });
    }

    const llm = await callAdvisorLlm({
      systemInstruction,
      geminiContents: contents,
      openAiMessages,
    });

    let replyText = llm.text;
    let degraded = false;

    if (!replyText) {
      degraded = true;
      replyText = buildDeterministicReply({
        message: userPayload,
        gold: goldQuote,
        calendarBlock,
        portfolioContext:
          typeof portfolioContext === 'string' ? portfolioContext : undefined,
        llmError: llm.error,
      });
    }

    return NextResponse.json({
      reply: replyText,
      market: goldQuote,
      meta: {
        provider: llm.provider === 'none' ? 'deterministic' : llm.provider,
        model: llm.model || null,
        degraded,
      },
    });
  } catch (error) {
    console.error('Error in AI Advisor API Route:', error);

    try {
      const goldQuote = await getLiveGoldQuote(false);
      return NextResponse.json({
        reply: buildDeterministicReply({
          message: '',
          gold: goldQuote,
          calendarBlock: '',
          llmError: error instanceof Error ? error.message : String(error),
        }),
        market: goldQuote,
        meta: { provider: 'deterministic', degraded: true },
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      reply:
        'Dạ thưa Chủ tịch Tú, kết nối AI đang gián đoạn. Kiểm tra `GEMINI_API_KEY` / `XAI_API_KEY`, hoặc thử lại sau (429/503 thường tạm thời).',
      meta: { provider: 'none', degraded: true },
    });
  }
}
