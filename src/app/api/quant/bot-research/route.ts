import { NextResponse } from 'next/server';
import { callAdvisorLlm, type LlmMessage } from '../../../../utils/llmProviders';
import { sanitizeGeminiContents } from '../../../../utils/geminiContents';
import {
  ruleBasedParamSuggestions,
  summarizeDailyPnl,
  type DailyPnlPoint,
  type SetParam,
} from '../../../../utils/setParser';

export const dynamic = 'force-dynamic';

export interface BotResearchSuggestion {
  key: string;
  value: string;
  reason: string;
}

export interface BotResearchResult {
  ok: true;
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  suggestedParams: BotResearchSuggestion[];
  warnings: string[];
  actions: string[];
  meta: {
    provider: string;
    model: string | null;
    degraded: boolean;
  };
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildFallback(opts: {
  params: SetParam[];
  equityUsd: number;
  maxDrawdown: number;
  accountRisk: number;
  daily: DailyPnlPoint[];
  botName: string;
}): BotResearchResult {
  const dailySummary = summarizeDailyPnl(opts.daily);
  const suggested = ruleBasedParamSuggestions({
    params: opts.params,
    equityUsd: opts.equityUsd,
    maxDrawdown: opts.maxDrawdown,
    riskScore: opts.accountRisk,
    dailySummary,
  });

  let riskScore = opts.accountRisk || 40;
  if (dailySummary.days >= 3) {
    if (dailySummary.total < 0) riskScore += 12;
    if (dailySummary.maxLoss < -opts.equityUsd * 0.03) riskScore += 10;
    if (dailySummary.winRate < 40) riskScore += 8;
    if (dailySummary.winRate >= 60 && dailySummary.total > 0) riskScore -= 8;
  }
  if (opts.maxDrawdown > 15) riskScore += 15;
  riskScore = clampScore(riskScore);

  const riskLevel: BotResearchResult['riskLevel'] =
    riskScore < 35 ? 'LOW' : riskScore < 65 ? 'MEDIUM' : 'HIGH';

  const warnings: string[] = [];
  if (opts.maxDrawdown > 10) {
    warnings.push(`Max DD tài khoản ${opts.maxDrawdown}% — nên giảm lot / grid.`);
  }
  if (dailySummary.days > 0 && dailySummary.total < 0) {
    warnings.push(
      `PnL ${dailySummary.days} ngày gần đây: ${dailySummary.total} (âm) — tránh tăng volume.`
    );
  }
  if (!opts.params.length) {
    warnings.push('Chưa có file .set — chỉ đánh giá theo vốn & PnL ngày.');
  }

  const actions: string[] = [
    'Giữ risk/lệnh ≤ 0.5–1% equity (prop: siết hơn nếu gần max DD).',
    'Chỉnh tham số trên form bên dưới — không cần gõ lại toàn bộ .set.',
    'Xuất file .set sau khi hài lòng → nạp lại EA trên MT5.',
  ];
  if (riskLevel === 'HIGH') {
    actions.unshift('Tạm giảm lot 30–50% và tắt nhân grid đến khi DD ổn.');
  }

  const summary =
    `**${opts.botName || 'Bot'}** · Equity ~$${Math.round(opts.equityUsd)} · ` +
    `Risk ${riskLevel} (${riskScore}/100).\n\n` +
    (dailySummary.days
      ? `PnL ${dailySummary.days} ngày: **${dailySummary.total >= 0 ? '+' : ''}${dailySummary.total}** · WR ngày ${dailySummary.winRate}% · TB ${dailySummary.avg}/ngày.\n\n`
      : 'Chưa có series lợi nhuận ngày — đánh giá dựa vốn + chỉ số TK.\n\n') +
    (suggested.length
      ? `Đã gợi ý **${suggested.length}** tham số chỉnh trên form (rule engine).`
      : 'Không map được key lot/risk trong .set — kiểm tra tên biến EA.');

  return {
    ok: true,
    summary,
    riskLevel,
    riskScore,
    suggestedParams: suggested,
    warnings,
    actions,
    meta: { provider: 'rule-engine', model: null, degraded: true },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const params = (Array.isArray(body.params) ? body.params : []) as SetParam[];
    const daily = (Array.isArray(body.dailyPnl) ? body.dailyPnl : []) as DailyPnlPoint[];
    const equityUsd = Number(body.equityUsd) || 0;
    const initialUsd = Number(body.initialUsd) || equityUsd;
    const maxDrawdown = Number(body.maxDrawdown) || 0;
    const accountRisk = Number(body.accountRiskScore) || 50;
    const botName = String(body.botName || body.fileName || 'EA').slice(0, 80);
    const accountId = String(body.accountId || '').slice(0, 40);
    const currency = String(body.currency || 'USD').slice(0, 8);
    const symbol = String(body.symbol || 'XAUUSD').slice(0, 20);
    const stats = body.stats && typeof body.stats === 'object' ? body.stats : {};

    const dailySummary = summarizeDailyPnl(daily);
    const paramLines = params
      .slice(0, 80)
      .map((p) => `${p.key}=${p.value}`)
      .join('\n');

    const hasLlm = !!(
      process.env.XAI_API_KEY ||
      process.env.GROK_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    );

    if (!hasLlm) {
      return NextResponse.json(
        buildFallback({
          params,
          equityUsd,
          maxDrawdown,
          accountRisk,
          daily,
          botName,
        })
      );
    }

    const systemInstruction = `
Bạn là GoldQuant Bot Research Advisor — tối ưu tham số EA/bot XAUUSD theo vốn & rủi ro.
Trả lời JSON THUẦN (không markdown ngoài JSON), schema:
{
  "summary": "2-4 câu tiếng Việt Markdown ngắn",
  "riskLevel": "LOW"|"MEDIUM"|"HIGH",
  "riskScore": 0-100,
  "suggestedParams": [{"key":"đúng key trong list","value":"giá trị mới","reason":"ngắn"}],
  "warnings": ["..."],
  "actions": ["hành động cụ thể"]
}

QUY TẮC:
1. CHỈ gợi ý key CÓ TRONG danh sách params (không invent key lạ).
2. Ưu tiên lot / risk% / maxlot / grid / SL-TP — siết khi DD hoặc equity nhỏ.
3. Không bịa số liệu; dùng đúng equity, DD, daily PnL.
4. suggestedParams tối đa 12 mục; value là string số hoặc bool EA.
5. Giọng: Chủ tịch Tú, ngắn gọn, quyết đoán.
`.trim();

    const userPayload = `
[ACCOUNT]
id=${accountId}
bot=${botName}
symbol=${symbol}
currency=${currency}
equityUsd=${equityUsd}
initialUsd=${initialUsd}
maxDrawdown%=${maxDrawdown}
accountRiskScore=${accountRisk}
stats=${JSON.stringify(stats).slice(0, 500)}

[DAILY_PNL_SUMMARY]
days=${dailySummary.days}
total=${dailySummary.total}
avg=${dailySummary.avg}
winRate=${dailySummary.winRate}
maxWin=${dailySummary.maxWin}
maxLoss=${dailySummary.maxLoss}
series=${JSON.stringify(daily.slice(-30))}

[SET_PARAMS]
${paramLines || '(empty)'}
`.trim();

    const geminiContents = sanitizeGeminiContents([
      { role: 'user', parts: [{ text: userPayload }] },
    ]);
    const openAiMessages: LlmMessage[] = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPayload },
    ];

    const llm = await callAdvisorLlm({
      systemInstruction,
      geminiContents,
      openAiMessages,
    });

    const fallback = buildFallback({
      params,
      equityUsd,
      maxDrawdown,
      accountRisk,
      daily,
      botName,
    });

    if (!llm.text) {
      return NextResponse.json({
        ...fallback,
        meta: {
          provider: 'rule-engine',
          model: null,
          degraded: true,
        },
      } satisfies BotResearchResult);
    }

    const parsed = extractJsonObject(llm.text);
    if (!parsed) {
      return NextResponse.json({
        ...fallback,
        summary:
          fallback.summary +
          '\n\n_AI trả lời dạng tự do — đã dùng rule engine cho tham số._',
        meta: {
          provider: llm.provider === 'none' ? 'rule-engine' : llm.provider,
          model: llm.model || null,
          degraded: true,
        },
      } satisfies BotResearchResult);
    }

    const knownKeys = new Set(params.map((p) => p.key));
    const rawSug = Array.isArray(parsed.suggestedParams)
      ? (parsed.suggestedParams as unknown[])
      : [];
    let suggestedParams: BotResearchSuggestion[] = rawSug
      .map((s) => {
        const o = s as Record<string, unknown>;
        return {
          key: String(o.key || '').trim(),
          value: String(o.value ?? '').trim(),
          reason: String(o.reason || '').slice(0, 160),
        };
      })
      .filter((s) => s.key && knownKeys.has(s.key) && s.value !== '');

    // Bổ sung rule nếu LLM quên lot/risk
    if (suggestedParams.length < 2) {
      const extra = fallback.suggestedParams.filter(
        (s) => !suggestedParams.some((x) => x.key === s.key)
      );
      suggestedParams = [...suggestedParams, ...extra].slice(0, 12);
    }

    const riskLevelRaw = String(parsed.riskLevel || fallback.riskLevel).toUpperCase();
    const riskLevel: BotResearchResult['riskLevel'] =
      riskLevelRaw === 'LOW' || riskLevelRaw === 'HIGH' || riskLevelRaw === 'MEDIUM'
        ? riskLevelRaw
        : fallback.riskLevel;

    const result: BotResearchResult = {
      ok: true,
      summary: String(parsed.summary || fallback.summary).slice(0, 2500),
      riskLevel,
      riskScore: clampScore(Number(parsed.riskScore) || fallback.riskScore),
      suggestedParams: suggestedParams.slice(0, 12),
      warnings: (Array.isArray(parsed.warnings) ? parsed.warnings : fallback.warnings)
        .map((w) => String(w).slice(0, 200))
        .slice(0, 8),
      actions: (Array.isArray(parsed.actions) ? parsed.actions : fallback.actions)
        .map((a) => String(a).slice(0, 200))
        .slice(0, 8),
      meta: {
        provider: llm.provider === 'none' ? 'deterministic' : llm.provider,
        model: llm.model || null,
        degraded: false,
      },
    };

    return NextResponse.json(result);
  } catch {
    // Không lộ stack — trả rule engine sạch
    return NextResponse.json(
      buildFallback({
        params: [],
        equityUsd: 0,
        maxDrawdown: 0,
        accountRisk: 50,
        daily: [],
        botName: 'Bot',
      })
    );
  }
}
