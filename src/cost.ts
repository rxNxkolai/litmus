/**
 * Token estimation and approximate USD cost. Prices are coarse list prices in
 * USD per 1,000,000 tokens and exist to give relative cost signal, not billing
 * accuracy. Unknown models cost 0.
 */

interface Price {
  input: number;
  output: number;
}

const PRICES: Record<string, Price> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'o4-mini': { input: 1.1, output: 4.4 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
  'claude-3-opus': { input: 15, output: 75 },
};

/** Rough token estimate: ~4 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Look up a price by exact model id, then by known prefix. */
export function priceFor(model: string): Price | undefined {
  const direct = PRICES[model];
  if (direct) return direct;
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  return key ? PRICES[key] : undefined;
}

/** Approximate USD cost for a generation; 0 when the model price is unknown. */
export function computeCost(model: string, promptTokens: number, completionTokens: number): number {
  const price = priceFor(model);
  if (!price) return 0;
  return (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
}
