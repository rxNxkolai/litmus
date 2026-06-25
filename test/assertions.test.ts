import { describe, it, expect } from 'vitest';
import { runAssertion, type EvalContext } from '../src/assertions.js';

const ctx = (response: string, latencyMs = 10, costUsd = 0): EvalContext => ({
  response,
  latencyMs,
  costUsd,
});

describe('string assertions', () => {
  it('contains / not-contains with ignoreCase', () => {
    expect(runAssertion({ type: 'contains', value: 'cat' }, ctx('a cat')).pass).toBe(true);
    expect(
      runAssertion({ type: 'contains', value: 'CAT', ignoreCase: true }, ctx('a cat')).pass,
    ).toBe(true);
    expect(runAssertion({ type: 'not-contains', value: 'dog' }, ctx('a cat')).pass).toBe(true);
    expect(runAssertion({ type: 'not-contains', value: 'cat' }, ctx('a cat')).pass).toBe(false);
  });

  it('equals with trim and ignoreCase', () => {
    expect(runAssertion({ type: 'equals', value: 'Hi', trim: true }, ctx('  Hi ')).pass).toBe(true);
    expect(runAssertion({ type: 'equals', value: 'hi', ignoreCase: true }, ctx('HI')).pass).toBe(
      true,
    );
    expect(runAssertion({ type: 'equals', value: 'no' }, ctx('yes')).pass).toBe(false);
  });

  it('one-of and length bounds', () => {
    expect(
      runAssertion({ type: 'one-of', values: ['yes', 'no'], ignoreCase: true }, ctx('YES')).pass,
    ).toBe(true);
    expect(runAssertion({ type: 'min-length', value: 3 }, ctx('abc')).pass).toBe(true);
    expect(runAssertion({ type: 'max-length', value: 2 }, ctx('abc')).pass).toBe(false);
  });
});

describe('regex assertion', () => {
  it('matches and fails closed on invalid patterns', () => {
    expect(runAssertion({ type: 'regex', pattern: '^\\d+$' }, ctx('123')).pass).toBe(true);
    expect(runAssertion({ type: 'regex', pattern: '(' }, ctx('x')).pass).toBe(false);
  });
});

describe('json assertions', () => {
  it('is-json', () => {
    expect(runAssertion({ type: 'is-json' }, ctx('{"a":1}')).pass).toBe(true);
    expect(runAssertion({ type: 'is-json' }, ctx('not json')).pass).toBe(false);
  });
  it('json-path equality, indexing, and existence', () => {
    expect(
      runAssertion({ type: 'json-path', path: 'a.b', equals: 2 }, ctx('{"a":{"b":2}}')).pass,
    ).toBe(true);
    expect(
      runAssertion({ type: 'json-path', path: 'items[1]', equals: 'y' }, ctx('{"items":["x","y"]}'))
        .pass,
    ).toBe(true);
    expect(
      runAssertion({ type: 'json-path', path: 'missing', exists: false }, ctx('{"a":1}')).pass,
    ).toBe(true);
    expect(runAssertion({ type: 'json-path', path: 'a', equals: 9 }, ctx('{"a":1}')).pass).toBe(
      false,
    );
  });
  it('coerces stringy numbers', () => {
    expect(runAssertion({ type: 'json-path', path: 'c', equals: 0.9 }, ctx('{"c":0.9}')).pass).toBe(
      true,
    );
  });
});

describe('latency and cost guards', () => {
  it('enforces thresholds', () => {
    expect(runAssertion({ type: 'max-latency-ms', value: 100 }, ctx('x', 50)).pass).toBe(true);
    expect(runAssertion({ type: 'max-latency-ms', value: 10 }, ctx('x', 50)).pass).toBe(false);
    expect(runAssertion({ type: 'max-cost-usd', value: 0.01 }, ctx('x', 0, 0.005)).pass).toBe(true);
    expect(runAssertion({ type: 'max-cost-usd', value: 0.001 }, ctx('x', 0, 0.005)).pass).toBe(
      false,
    );
  });
});
