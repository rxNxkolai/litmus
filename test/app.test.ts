import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, type RunIO } from '../src/app.js';

function capture(): { io: RunIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (s) => out.push(s), err: (s) => err.push(s) }, out, err };
}

const SUITE = {
  name: 'cli-suite',
  model: 'mock:sentiment',
  prompt: 'Classify: {{review}}',
  cases: [
    {
      name: 'positive',
      vars: { review: 'love great best' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
    },
  ],
};

describe('cli run()', () => {
  let cwd0: string;
  let dir: string;
  let suitePath: string;

  beforeEach(() => {
    cwd0 = process.cwd();
    dir = mkdtempSync(join(tmpdir(), 'pp-cli-'));
    process.chdir(dir);
    suitePath = join(dir, 'cli.suite.json');
    writeFileSync(suitePath, JSON.stringify(SUITE), 'utf8');
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints help by default and exits 0', async () => {
    const c = capture();
    expect(await run([], c.io)).toBe(0);
    expect(c.out.join('\n')).toContain('litmus');
  });

  it('prints a semver version', async () => {
    const c = capture();
    expect(await run(['--version'], c.io)).toBe(0);
    expect(c.out.join('\n')).toMatch(/\d+\.\d+\.\d+/);
  });

  it('runs a suite green and exits 0', async () => {
    const c = capture();
    expect(await run(['run', suitePath, '--no-color'], c.io)).toBe(0);
    expect(c.out.join('\n')).toContain('passed');
  });

  it('writes a self-contained HTML report', async () => {
    const c = capture();
    const html = join(dir, 'report.html');
    await run(['run', suitePath, '--no-color', '--html', html], c.io);
    expect(existsSync(html)).toBe(true);
    expect(readFileSync(html, 'utf8')).toContain('<!doctype html>');
  });

  it('emits JSON with --json', async () => {
    const c = capture();
    await run(['run', suitePath, '--json', '--no-save'], c.io);
    const parsed = JSON.parse(c.out.join('\n'));
    expect(parsed.run.suites[0].passed).toBeGreaterThan(0);
  });

  it('lists saved runs', async () => {
    await run(['run', suitePath, '--no-color'], capture().io);
    const c = capture();
    expect(await run(['list'], c.io)).toBe(0);
    expect(c.out.join('\n')).toMatch(/passed/);
  });

  it('init writes a starter suite and refuses to overwrite', async () => {
    const c1 = capture();
    expect(await run(['init'], c1.io)).toBe(0);
    expect(existsSync(join(dir, 'example.suite.mjs'))).toBe(true);
    const c2 = capture();
    expect(await run(['init'], c2.io)).toBe(1);
  });

  it('exits 1 when a case fails', async () => {
    const failing = join(dir, 'fail.suite.json');
    writeFileSync(
      failing,
      JSON.stringify({
        name: 'f',
        model: 'mock:sentiment',
        prompt: 'Classify: {{review}}',
        cases: [
          {
            name: 'mislabel',
            vars: { review: 'terrible worst' },
            assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
          },
        ],
      }),
      'utf8',
    );
    const c = capture();
    expect(await run(['run', failing, '--no-color', '--no-save'], c.io)).toBe(1);
  });

  it('exits 2 on unknown command and on run without paths', async () => {
    expect(await run(['frobnicate'], capture().io)).toBe(2);
    expect(await run(['run'], capture().io)).toBe(2);
  });
});
