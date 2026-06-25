import type { Provider, ProviderResponse } from '../types.js';
import { estimateTokens } from '../cost.js';

/** Thin Anthropic Messages adapter. Active only when ANTHROPIC_API_KEY is set. */
export const anthropicProvider: Provider = {
  name: 'anthropic',
  async generate(req): Promise<ProviderResponse> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not set. Use --provider mock to run offline.');
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: 1024,
        ...(req.system ? { system: req.system } : {}),
        messages: [{ role: 'user', content: req.prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    const text: string = Array.isArray(data?.content)
      ? data.content.map((c: any) => c?.text ?? '').join('')
      : '';
    const usage = data?.usage ?? {};
    return {
      text,
      model: data?.model ?? req.model,
      promptTokens: usage.input_tokens ?? estimateTokens(req.prompt),
      completionTokens: usage.output_tokens ?? estimateTokens(text),
    };
  },
};
