import { describe, it, expect } from 'vitest';
import { computeCost, estimateTokens, priceFor } from '../src/cost.js';

describe('cost', () => {
  it('estimates tokens at ~4 chars each', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('prices known models and known prefixes', () => {
    expect(priceFor('gpt-4o')).toBeDefined();
    expect(priceFor('gpt-4o-2024-11-20')).toBeDefined();
    expect(priceFor('totally-unknown')).toBeUndefined();
  });

  it('computes cost and returns 0 for unknown models', () => {
    expect(computeCost('mock:echo', 1000, 1000)).toBe(0);
    expect(computeCost('gpt-4o', 1_000_000, 1_000_000)).toBeCloseTo(12.5, 5);
  });
});
