import type { Diff, Run } from '../types.js';

const RESET = '\x1b[0m';
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

export interface ConsoleOptions {
  color: boolean;
}

function paint(text: string, code: string, on: boolean): string {
  return on ? `${code}${text}${RESET}` : text;
}

/** Render a run as terminal output, with failing assertions and a regression banner. */
export function formatConsole(run: Run, diff: Diff | undefined, opts: ConsoleOptions): string {
  const { color } = opts;
  const lines: string[] = [];
  let totalPass = 0;
  let totalFail = 0;
  let totalCost = 0;

  for (const suite of run.suites) {
    totalPass += suite.passed;
    totalFail += suite.failed;
    totalCost += suite.cases.reduce((sum, c) => sum + c.costUsd, 0);

    const ratio = `(${suite.passed}/${suite.total} passed)`;
    lines.push(
      paint(suite.suite, C.bold, color) +
        ' ' +
        paint(ratio, suite.failed ? C.yellow : C.green, color),
    );

    for (const c of suite.cases) {
      const badge = c.pass ? paint('PASS', C.green, color) : paint('FAIL', C.red, color);
      const cost = c.costUsd ? ` $${c.costUsd.toFixed(5)}` : '';
      const meta = paint(`${c.latencyMs}ms${cost}`, C.dim, color);
      lines.push(`  ${badge}  ${c.name}  ${meta}`);
      if (!c.pass) {
        if (c.error) lines.push(`        ${paint(`error: ${c.error}`, C.red, color)}`);
        for (const a of c.assertions.filter((x) => !x.pass)) {
          lines.push(`        ${paint(`✗ ${a.type}: ${a.message}`, C.red, color)}`);
        }
      }
    }
    lines.push('');
  }

  if (diff && (diff.regressions.length > 0 || diff.fixes.length > 0)) {
    if (diff.regressions.length > 0) {
      lines.push(paint(`⚠ ${diff.regressions.length} regression(s) since last run:`, C.red, color));
      for (const r of diff.regressions) {
        lines.push(paint(`    ${r.suite} :: ${r.case}`, C.red, color));
      }
    }
    if (diff.fixes.length > 0) {
      lines.push(paint(`✔ ${diff.fixes.length} fix(es) since last run:`, C.green, color));
      for (const f of diff.fixes) {
        lines.push(paint(`    ${f.suite} :: ${f.case}`, C.green, color));
      }
    }
    lines.push('');
  }

  const total = totalPass + totalFail;
  const cost = totalCost ? `, ~$${totalCost.toFixed(5)}` : '';
  const summary = `${totalPass}/${total} passed${totalFail ? `, ${totalFail} failed` : ''}${cost}`;
  lines.push(paint(summary, totalFail ? C.red : C.green, color));

  return lines.join('\n');
}
