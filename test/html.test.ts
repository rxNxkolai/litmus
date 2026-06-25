import { describe, it, expect } from 'vitest';
import { renderHtml } from '../src/reporters/html.js';
import type { Run } from '../src/types.js';

function makeRun(): Run {
  return {
    id: 'run-1',
    createdAt: '2026-06-25T00:00:00.000Z',
    suites: [
      {
        suite: 'demo',
        provider: 'mock',
        model: 'mock:echo',
        startedAt: 'x',
        durationMs: 5,
        total: 2,
        passed: 1,
        failed: 1,
        cases: [
          {
            name: 'ok',
            vars: { a: '1' },
            prompt: 'p',
            response: 'hi',
            provider: 'mock',
            model: 'mock:echo',
            promptTokens: 1,
            completionTokens: 1,
            costUsd: 0,
            latencyMs: 2,
            pass: true,
            assertions: [
              {
                type: 'contains',
                pass: true,
                message: 'contains "hi"',
                spec: { type: 'contains', value: 'hi' },
              },
            ],
          },
          {
            name: 'xss',
            vars: {},
            prompt: 'p',
            response: '<script>alert(1)</script>',
            provider: 'mock',
            model: 'mock:echo',
            promptTokens: 1,
            completionTokens: 1,
            costUsd: 0,
            latencyMs: 2,
            pass: false,
            assertions: [
              {
                type: 'contains',
                pass: false,
                message: 'expected output to contain "x"',
                spec: { type: 'contains', value: 'x' },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('renderHtml', () => {
  it('produces a self-contained document with summary', () => {
    const html = renderHtml(makeRun());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('promptproof');
    expect(html).toContain('demo');
    expect(html).toContain('50%');
  });

  it('escapes HTML in responses to prevent injection', () => {
    const html = renderHtml(makeRun());
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a regression banner when given a diff', () => {
    const html = renderHtml(makeRun(), {
      regressions: [{ suite: 'demo', case: 'ok', was: true, now: false }],
      fixes: [],
    });
    expect(html).toContain('regression');
  });
});
