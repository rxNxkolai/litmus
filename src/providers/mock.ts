import type { GenerateRequest, Provider, ProviderResponse } from '../types.js';
import { estimateTokens } from '../cost.js';

const POSITIVE = [
  'love',
  'loved',
  'great',
  'excellent',
  'amazing',
  'awesome',
  'good',
  'fantastic',
  'wonderful',
  'happy',
  'perfect',
  'best',
  'recommend',
];
const NEGATIVE = [
  'hate',
  'hated',
  'terrible',
  'awful',
  'bad',
  'worst',
  'horrible',
  'broken',
  'disappointed',
  'slow',
  'buggy',
  'useless',
  'refund',
];

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) {
    const matches = lower.match(new RegExp(`\\b${w}\\b`, 'g'));
    n += matches ? matches.length : 0;
  }
  return n;
}

function classifySentiment(text: string): { sentiment: string; confidence: number } {
  const pos = countMatches(text, POSITIVE);
  const neg = countMatches(text, NEGATIVE);
  let sentiment = 'neutral';
  if (pos > neg) sentiment = 'positive';
  else if (neg > pos) sentiment = 'negative';
  const confidence = Math.min(0.99, 0.5 + 0.1 * Math.abs(pos - neg));
  return { sentiment, confidence: Number(confidence.toFixed(2)) };
}

function respond(model: string, prompt: string): string {
  const behavior = model.includes(':') ? model.slice(model.indexOf(':') + 1) : 'echo';
  switch (behavior) {
    case 'sentiment':
      return JSON.stringify(classifySentiment(prompt));
    case 'json':
      return JSON.stringify({ echo: prompt.trim(), length: prompt.trim().length });
    case 'echo':
    default:
      return prompt.trim();
  }
}

/**
 * Deterministic, offline provider for testing the framework with no API keys.
 * Behavior is chosen by the model id suffix:
 *
 *   mock:sentiment  -> JSON sentiment classification of the prompt
 *   mock:json       -> deterministic JSON echo of the prompt
 *   mock:echo       -> returns the prompt text (default)
 */
export const mockProvider: Provider = {
  name: 'mock',
  async generate(req: GenerateRequest): Promise<ProviderResponse> {
    const text = respond(req.model, req.prompt);
    return {
      text,
      model: req.model,
      promptTokens: estimateTokens(`${req.system ?? ''}\n${req.prompt}`),
      completionTokens: estimateTokens(text),
    };
  },
};
