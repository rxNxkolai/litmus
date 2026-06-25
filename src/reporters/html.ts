import type { CaseResult, Diff, Run, SuiteResult } from '../types.js';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

function money(n: number): string {
  return n === 0 ? '$0' : `$${n.toFixed(5)}`;
}

function renderAssertions(c: CaseResult): string {
  if (c.error) {
    return `<div class="assert fail"><span class="mark">✗</span> error: ${esc(c.error)}</div>`;
  }
  return c.assertions
    .map(
      (a) =>
        `<div class="assert ${a.pass ? 'pass' : 'fail'}">` +
        `<span class="mark">${a.pass ? '✓' : '✗'}</span> ` +
        `<span class="atype">${esc(a.type)}</span> ${esc(a.message)}</div>`,
    )
    .join('');
}

function renderVars(c: CaseResult): string {
  const keys = Object.keys(c.vars);
  if (keys.length === 0) return '';
  const rows = keys.map((k) => `<tr><td>${esc(k)}</td><td>${esc(c.vars[k])}</td></tr>`).join('');
  return `<div class="block"><div class="block-label">vars</div><table class="vars">${rows}</table></div>`;
}

function renderCase(c: CaseResult): string {
  const status = c.pass ? 'pass' : 'fail';
  const assertSummary = c.pass
    ? `${c.assertions.length} passed`
    : `${c.assertions.filter((a) => !a.pass).length || 1} failed`;
  const system = c.system
    ? `<div class="block"><div class="block-label">system</div><pre>${esc(c.system)}</pre></div>`
    : '';
  return `
    <details class="case ${status}">
      <summary>
        <span class="badge ${status}">${c.pass ? 'PASS' : 'FAIL'}</span>
        <span class="case-name">${esc(c.name)}</span>
        <span class="case-meta">${c.latencyMs}ms · ${esc(money(c.costUsd))} · ${esc(assertSummary)}</span>
      </summary>
      <div class="case-body">
        <div class="assert-list">${renderAssertions(c)}</div>
        ${renderVars(c)}
        ${system}
        <div class="block"><div class="block-label">prompt</div><pre>${esc(c.prompt)}</pre></div>
        <div class="block"><div class="block-label">response</div><pre>${esc(c.response)}</pre></div>
        <div class="case-foot">${esc(c.provider)} / ${esc(c.model)} · ${c.promptTokens + c.completionTokens} tokens</div>
      </div>
    </details>`;
}

function renderSuite(suite: SuiteResult): string {
  const cases = suite.cases.map(renderCase).join('');
  const cls = suite.failed ? 'has-fail' : 'all-pass';
  return `
    <section class="suite ${cls}">
      <h2>${esc(suite.suite)}
        <span class="suite-count">${suite.passed}/${suite.total}</span>
      </h2>
      ${suite.description ? `<p class="suite-desc">${esc(suite.description)}</p>` : ''}
      ${cases}
    </section>`;
}

function renderBanner(diff: Diff | undefined): string {
  if (!diff || (diff.regressions.length === 0 && diff.fixes.length === 0)) return '';
  const parts: string[] = [];
  if (diff.regressions.length > 0) {
    const items = diff.regressions.map((r) => `${esc(r.suite)} :: ${esc(r.case)}`).join(', ');
    parts.push(
      `<div class="banner regress"><strong>⚠ ${diff.regressions.length} regression(s)</strong> since last run: ${items}</div>`,
    );
  }
  if (diff.fixes.length > 0) {
    const items = diff.fixes.map((f) => `${esc(f.suite)} :: ${esc(f.case)}`).join(', ');
    parts.push(
      `<div class="banner fixed"><strong>✔ ${diff.fixes.length} fix(es)</strong> since last run: ${items}</div>`,
    );
  }
  return parts.join('');
}

function card(label: string, value: string, tone = ''): string {
  return `<div class="card ${tone}"><div class="card-value">${esc(value)}</div><div class="card-label">${esc(label)}</div></div>`;
}

/** Render a full, self-contained interactive HTML report for a run. */
export function renderHtml(run: Run, diff?: Diff): string {
  const cases = run.suites.flatMap((s) => s.cases);
  const total = cases.length;
  const passed = cases.filter((c) => c.pass).length;
  const failed = total - passed;
  const passRate = total ? Math.round((passed / total) * 100) : 100;
  const tokens = cases.reduce((n, c) => n + c.promptTokens + c.completionTokens, 0);
  const cost = cases.reduce((n, c) => n + c.costUsd, 0);
  const targets = Array.from(new Set(run.suites.map((s) => `${s.provider}/${s.model}`))).join(', ');

  const cards =
    card('pass rate', `${passRate}%`, failed ? 'warn' : 'ok') +
    card('passed', String(passed), 'ok') +
    card('failed', String(failed), failed ? 'bad' : '') +
    card('cases', String(total)) +
    card('tokens', tokens.toLocaleString('en-US')) +
    card('est. cost', money(cost));

  const suites = run.suites.map(renderSuite).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>promptproof report</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --panel-2: #1c2230; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --green: #3fb950; --red: #f85149;
    --yellow: #d29922; --accent: #58a6ff;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
  header h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.01em; }
  header h1 .dot { color: var(--accent); }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .card-value { font-size: 22px; font-weight: 650; }
  .card-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .card.ok .card-value { color: var(--green); }
  .card.bad .card-value { color: var(--red); }
  .card.warn .card-value { color: var(--yellow); }
  .banner { border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; font-size: 14px; border: 1px solid; }
  .banner.regress { background: rgba(248,81,73,0.1); border-color: var(--red); color: #ffb4ae; }
  .banner.fixed { background: rgba(63,185,80,0.1); border-color: var(--green); color: #a6e3a9; }
  .filters { display: flex; gap: 8px; margin: 18px 0 12px; }
  .filter-btn {
    background: var(--panel); color: var(--muted); border: 1px solid var(--border);
    border-radius: 999px; padding: 5px 14px; font-size: 13px; cursor: pointer;
  }
  .filter-btn.active { color: var(--text); border-color: var(--accent); }
  .suite { margin-top: 22px; }
  .suite h2 { font-size: 16px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  .suite-count { font-size: 12px; color: var(--muted); font-weight: 500; border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; }
  .suite-desc { color: var(--muted); font-size: 13px; margin: 0 0 10px; }
  details.case {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; margin-bottom: 8px; overflow: hidden;
  }
  details.case.fail { border-color: rgba(248,81,73,0.4); }
  details.case[open] { background: var(--panel-2); }
  summary { cursor: pointer; padding: 10px 14px; display: flex; align-items: center; gap: 10px; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 5px; letter-spacing: 0.03em; }
  .badge.pass { background: rgba(63,185,80,0.16); color: var(--green); }
  .badge.fail { background: rgba(248,81,73,0.16); color: var(--red); }
  .case-name { font-weight: 550; }
  .case-meta { margin-left: auto; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .case-body { padding: 4px 14px 14px; border-top: 1px solid var(--border); }
  .assert-list { margin: 10px 0; }
  .assert { font-size: 13px; padding: 3px 0; }
  .assert .mark { display: inline-block; width: 16px; font-weight: 700; }
  .assert.pass .mark { color: var(--green); }
  .assert.fail { color: #ffb4ae; }
  .assert.fail .mark { color: var(--red); }
  .atype { color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .block { margin-top: 10px; }
  .block-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  pre {
    margin: 0; background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px; white-space: pre-wrap; word-break: break-word; max-height: 320px; overflow: auto;
  }
  table.vars { border-collapse: collapse; font-size: 13px; }
  table.vars td { border: 1px solid var(--border); padding: 3px 10px; }
  table.vars td:first-child { color: var(--accent); font-family: ui-monospace, monospace; }
  .case-foot { margin-top: 10px; color: var(--muted); font-size: 12px; }
  footer { margin-top: 32px; color: var(--muted); font-size: 12px; text-align: center; }
  footer a { color: var(--accent); text-decoration: none; }
  body[data-filter="passed"] details.case.fail { display: none; }
  body[data-filter="failed"] details.case.pass { display: none; }
</style>
</head>
<body data-filter="all">
  <div class="wrap">
    <header>
      <h1>promptproof<span class="dot">.</span> report</h1>
      <div class="sub">${esc(run.id)} · ${esc(run.createdAt)} · ${esc(targets)}</div>
    </header>
    ${renderBanner(diff)}
    <div class="cards">${cards}</div>
    <div class="filters">
      <button class="filter-btn active" data-f="all" onclick="setFilter('all')">All</button>
      <button class="filter-btn" data-f="passed" onclick="setFilter('passed')">Passed</button>
      <button class="filter-btn" data-f="failed" onclick="setFilter('failed')">Failed</button>
    </div>
    ${suites}
    <footer>Generated by <a href="https://github.com/rxNxkolai/promptproof">promptproof</a></footer>
  </div>
  <script>
    function setFilter(f) {
      document.body.setAttribute('data-filter', f);
      var btns = document.querySelectorAll('.filter-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-f') === f);
      }
    }
  </script>
</body>
</html>`;
}
