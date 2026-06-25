import type { Provider, ProviderResponse } from '../types.js';
import { estimateTokens } from '../cost.js';

/** Thin OpenAI Chat Completions adapter. Active only when OPENAI_API_KEY is set. */
export const openaiProvider: Provider = {
  name: 'openai',
  async generate(req): Promise<ProviderResponse> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not set. Use --provider mock to run offline.');
    }

    const messages = req.system
      ? [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ]
      : [{ role: 'user', content: req.prompt }];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: req.model, messages }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const usage = data?.usage ?? {};
    return {
      text,
      model: data?.model ?? req.model,
      promptTokens: usage.prompt_tokens ?? estimateTokens(req.prompt),
      completionTokens: usage.completion_tokens ?? estimateTokens(text),
    };
  },
};
