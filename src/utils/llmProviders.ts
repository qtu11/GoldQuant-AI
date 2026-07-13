/**
 * Multi-provider LLM for GoldQuant AI Advisor.
 * Chain: xAI (SpaceXAI) → Gemini → deterministic (caller).
 */

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmResult = {
  text: string;
  provider: 'xai' | 'gemini' | 'none';
  model: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseHttpError(status: number, body: string): { retryable: boolean; summary: string } {
  const short = body.slice(0, 280);
  if (status === 429) {
    return { retryable: true, summary: `429 quota/rate-limit: ${short}` };
  }
  if (status === 503 || status === 502 || status === 500) {
    return { retryable: true, summary: `${status} unavailable: ${short}` };
  }
  if (status === 404) {
    return { retryable: false, summary: `404 model not found: ${short}` };
  }
  if (status === 401 || status === 403) {
    return { retryable: false, summary: `${status} auth: ${short}` };
  }
  return { retryable: status >= 500, summary: `${status}: ${short}` };
}

/** xAI / SpaceXAI — OpenAI-compatible chat completions */
export async function callXaiChat(
  messages: LlmMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<LlmResult> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    return { text: '', provider: 'none', model: '', error: 'missing XAI_API_KEY' };
  }

  const models = [
    process.env.XAI_MODEL,
    'grok-4-1-fast-non-reasoning',
    'grok-4-fast-non-reasoning',
    'grok-3-mini',
    'grok-2-latest',
  ].filter(Boolean) as string[];

  let lastErr = '';
  for (const model of models) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: opts?.temperature ?? 0.4,
          max_tokens: opts?.maxTokens ?? 4096,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) {
        const body = await res.text();
        const { retryable, summary } = parseHttpError(res.status, body);
        lastErr = summary;
        console.warn(`[llm/xai] ${model}:`, summary.slice(0, 180));
        if (!retryable && (res.status === 401 || res.status === 403)) break;
        continue;
      }

      const data = await res.json();
      const text =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        '';
      if (typeof text === 'string' && text.trim()) {
        return { text: text.trim(), provider: 'xai', model };
      }
      lastErr = 'empty content from xAI';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[llm/xai] ${model} throw:`, lastErr);
    }
  }

  return { text: '', provider: 'none', model: '', error: lastErr || 'xAI failed' };
}

/** Google Gemini generateContent */
export async function callGeminiChat(
  systemInstruction: string,
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<LlmResult> {
  // KHÔNG dùng Firebase web API key làm Gemini key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return { text: '', provider: 'none', model: '', error: 'missing GEMINI_API_KEY' };
  }

  const models = [
    process.env.GEMINI_MODEL,
    // Lite / latest trước — ít dính 429 hơn 2.5-flash khi free tier
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
  ].filter(Boolean) as string[];

  // Dedup preserve order
  const seen = new Set<string>();
  const modelList = models.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  let lastErr = '';
  let hitHardQuota = false;

  for (const modelName of modelList) {
    if (hitHardQuota) break;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            generationConfig: {
              temperature: opts?.temperature ?? 0.4,
              maxOutputTokens: opts?.maxTokens ?? 4096,
            },
          }),
          signal: AbortSignal.timeout(45_000),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        const { retryable, summary } = parseHttpError(res.status, body);
        lastErr = summary;
        console.warn(`[llm/gemini] ${modelName}:`, summary.slice(0, 180));
        // 429 free tier — nghỉ ngắn rồi thử model tiếp; nếu message quota plan thì dừng
        if (res.status === 429) {
          if (/billing|plan|quota/i.test(body) && /exceeded/i.test(body)) {
            // Vẫn thử lite khác 1 lần sau delay nhỏ
            await sleep(400);
          } else {
            await sleep(300);
          }
          continue;
        }
        if (res.status === 503) {
          await sleep(500);
          continue;
        }
        if (!retryable) continue;
        continue;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts;
      let text = '';
      if (Array.isArray(parts)) {
        text = parts
          .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
          .join('')
          .trim();
      }
      if (text) {
        return { text, provider: 'gemini', model: modelName };
      }
      lastErr = data?.promptFeedback?.blockReason
        ? `blocked: ${data.promptFeedback.blockReason}`
        : 'empty candidates';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[llm/gemini] ${modelName} throw:`, lastErr);
    }
  }

  return { text: '', provider: 'none', model: '', error: lastErr || 'Gemini failed' };
}

/**
 * Gọi LLM theo thứ tự ưu tiên env:
 * 1) XAI_API_KEY (nếu có) — SpaceXAI/Grok
 * 2) GEMINI_API_KEY
 * 3) rỗng → caller dùng deterministic fallback
 */
export async function callAdvisorLlm(params: {
  systemInstruction: string;
  /** Gemini contents (user/model) */
  geminiContents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  /** OpenAI-style messages (có system) — cho xAI */
  openAiMessages: LlmMessage[];
}): Promise<LlmResult> {
  const prefer =
    (process.env.AI_PROVIDER || '').toLowerCase() ||
    (process.env.XAI_API_KEY || process.env.GROK_API_KEY ? 'xai' : 'gemini');

  const order: Array<'xai' | 'gemini'> =
    prefer === 'gemini' ? ['gemini', 'xai'] : ['xai', 'gemini'];

  const errors: string[] = [];

  for (const p of order) {
    if (p === 'xai') {
      const r = await callXaiChat(params.openAiMessages);
      if (r.text) return r;
      if (r.error) errors.push(`xai: ${r.error}`);
    } else {
      const r = await callGeminiChat(params.systemInstruction, params.geminiContents);
      if (r.text) return r;
      if (r.error) errors.push(`gemini: ${r.error}`);
    }
  }

  return {
    text: '',
    provider: 'none',
    model: '',
    error: errors.join(' | ') || 'all providers failed',
  };
}
