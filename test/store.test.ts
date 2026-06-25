import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffRuns, listRuns, previousRun, saveRun } from '../src/store.js';
import type { Run } from '../src/types.js';

function makeRun(id: string, casePass: boolean): Run {
  return {
    id,
    createdAt: id,
    suites: [
      {
        suite: 's',
        provider: 'mock',
        model: 'm',
        startedAt: id,
        durationMs: 1,
        total: 1,
        passed: casePass ? 1 : 0,
        failed: casePass ? 0 : 1,
        cases: [
          {
            name: 'c',
            vars: {},
            prompt: '',
            response: '',
            provider: 'mock',
            model: 'm',
            promptTokens: 0,
            completionTokens: 0,
            costUsd: 0,
            latencyMs: 0,
            assertions: [],
            pass: casePass,
          },
        ],
      },
    ],
  };
}

describe('store', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pp-store-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves and lists runs oldest-first', () => {
    saveRun(makeRun('2026-01-01T00-00-00-000Z', true), dir);
    saveRun(makeRun('2026-01-02T00-00-00-000Z', false), dir);
    expect(listRuns(dir).map((r) => r.id)).toEqual([
      '2026-01-01T00-00-00-000Z',
      '2026-01-02T00-00-00-000Z',
    ]);
    expect(previousRun(dir)?.id).toBe('2026-01-02T00-00-00-000Z');
  });

  it('returns empty results when there is no history', () => {
    expect(listRuns(dir)).toEqual([]);
    expect(previousRun(dir)).toBeUndefined();
  });

  it('detects regressions and fixes between runs', () => {
    const regress = diffRuns(makeRun('a', true), makeRun('b', false));
    expect(regress.regressions).toHaveLength(1);
    expect(regress.fixes).toHaveLength(0);

    const fix = diffRuns(makeRun('a', false), makeRun('b', true));
    expect(fix.regressions).toHaveLength(0);
    expect(fix.fixes).toHaveLength(1);
  });
});
