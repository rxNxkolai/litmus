import { describe, it, expect } from 'vitest';
import { runSuite } from '../src/runner.js';
import { mockProvider } from '../src/providers/mock.js';
import type { Provider, Suite } from '../src/types.js';

const suite: Suite = {
  name: 'sentiment',
  prompt: 'Classify: {{review}}',
  model: 'mock:sentiment',
  cases: [
    {
      name: 'pos',
      vars: { review: 'love great best' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
    },
    {
      name: 'wrong',
      vars: { review: 'terrible worst broken' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
    },
  ],
};

describe('runSuite', () => {
  it('runs cases and tallies pass/fail', async () => {
    const res = await runSuite(suite, { provider: mockProvider, model: 'mock:sentiment' });
    expect(res.total).toBe(2);
    expect(res.passed).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.cases[0]?.pass).toBe(true);
    expect(res.cases[1]?.pass).toBe(false);
  });

  it('captures provider errors as failing cases', async () => {
    const boom: Provider = {
      name: 'mock',
      async generate() {
        throw new Error('kaboom');
      },
    };
    const res = await runSuite(
      {
        name: 'e',
        prompt: 'x',
        cases: [{ name: 'c', assert: [{ type: 'contains', value: 'a' }] }],
      },
      { provider: boom, model: 'm' },
    );
    expect(res.cases[0]?.pass).toBe(false);
    expect(res.cases[0]?.error).toContain('kaboom');
  });

  it('merges suite defaults with case vars', async () => {
    const s: Suite = {
      name: 'd',
      prompt: '{{greeting}} {{name}}',
      model: 'mock:echo',
      defaults: { greeting: 'hello' },
      cases: [{ name: 'c', vars: { name: 'bo' }, assert: [{ type: 'equals', value: 'hello bo' }] }],
    };
    const res = await runSuite(s, { provider: mockProvider, model: 'mock:echo' });
    expect(res.cases[0]?.pass).toBe(true);
  });
});
