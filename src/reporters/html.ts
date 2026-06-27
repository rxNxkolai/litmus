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
    return `<div class="as bad"><span class="mk">✗</span> error: ${esc(c.error)}</div>`;
  }
  return c.assertions
    .map(
      (a) =>
        `<div class="as ${a.pass ? 'ok' : 'bad'}"><span class="mk">${a.pass ? '✓' : '✗'}</span>` +
        `<span class="at">${esc(a.type)}</span> ${esc(a.message)}</div>`,
    )
    .join('');
}

function renderVars(c: CaseResult): string {
  const keys = Object.keys(c.vars);
  if (keys.length === 0) return '';
  const rows = keys.map((k) => `<tr><td>${esc(k)}</td><td>${esc(c.vars[k])}</td></tr>`).join('');
  return `<div class="blk"><div class="bl">vars</div><table class="vars">${rows}</table></div>`;
}

function renderCase(c: CaseResult, i: number): string {
  const cls = c.pass ? 'ok' : 'bad';
  const assertSummary = c.pass
    ? `${c.assertions.length} passed`
    : `${c.assertions.filter((a) => !a.pass).length || 1} failed`;
  const system = c.system
    ? `<div class="blk"><div class="bl">system</div><pre>${esc(c.system)}</pre></div>`
    : '';
  return `
    <details class="case ${cls}" style="--i:${i}">
      <summary>
        <span class="badge ${cls}">${c.pass ? 'PASS' : 'FAIL'}</span>
        <span class="ct">${esc(c.name)}</span>
        <span class="meta">${c.latencyMs}ms · ${esc(money(c.costUsd))} · ${esc(assertSummary)}</span>
        <span class="chev" aria-hidden="true">›</span>
      </summary>
      <div class="body">
        <div class="aslist">${renderAssertions(c)}</div>
        ${renderVars(c)}
        ${system}
        <div class="blk"><div class="bl">prompt</div><pre>${esc(c.prompt)}</pre></div>
        <div class="blk"><div class="bl">response</div><pre>${esc(c.response)}</pre></div>
        <div class="foot">${esc(c.provider)} / ${esc(c.model)} · ${c.promptTokens + c.completionTokens} tokens</div>
      </div>
    </details>`;
}

function renderSuite(suite: SuiteResult): string {
  const cases = suite.cases.map(renderCase).join('');
  return `
    <section class="suite">
      <h2>${esc(suite.suite)} <span class="count">${suite.passed}/${suite.total}</span></h2>
      ${suite.description ? `<p class="sdesc">${esc(suite.description)}</p>` : ''}
      ${cases}
    </section>`;
}

function renderBanner(diff: Diff | undefined): string {
  if (!diff || (diff.regressions.length === 0 && diff.fixes.length === 0)) return '';
  const parts: string[] = [];
  if (diff.regressions.length > 0) {
    const items = diff.regressions.map((r) => `${esc(r.suite)} :: ${esc(r.case)}`).join(', ');
    parts.push(
      `<div class="banner bad"><strong>⚠ ${diff.regressions.length} regression(s)</strong> since last run: ${items}</div>`,
    );
  }
  if (diff.fixes.length > 0) {
    const items = diff.fixes.map((f) => `${esc(f.suite)} :: ${esc(f.case)}`).join(', ');
    parts.push(
      `<div class="banner ok"><strong>✔ ${diff.fixes.length} fix(es)</strong> since last run: ${items}</div>`,
    );
  }
  return parts.join('');
}

function stat(label: string, value: string | number, tone = ''): string {
  return `<div class="stat ${tone}"><div class="num">${esc(value)}</div><div class="lbl">${esc(label)}</div></div>`;
}

const MARK = `<svg class="mark" viewBox="0 0 108 108" fill="none" aria-hidden="true"><g stroke="#3fb950" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="15" width="18" height="18" rx="5"/><path d="M19 24 l4 4 l7 -9"/><rect x="14" y="43" width="18" height="18" rx="5"/><path d="M19 52 l4 4 l7 -9"/><line x1="44" y1="24" x2="92" y2="24" stroke-width="5"/><line x1="44" y1="52" x2="92" y2="52" stroke-width="5"/></g><g stroke="#3a4150" stroke-width="3"><rect x="14" y="71" width="18" height="18" rx="5"/><line x1="44" y1="80" x2="76" y2="80" stroke-width="5" stroke-linecap="round"/></g></svg>`;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b0e14'/%3E%3Cpath d='M9 16 l4 4 l10 -11' fill='none' stroke='%233fb950' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

/** Render a full, self-contained interactive HTML report for a run. */
export function renderHtml(run: Run, diff?: Diff): string {
  const cases = run.suites.flatMap((s) => s.cases);
  const total = cases.length;
  const passed = cases.filter((c) => c.pass).length;
  const failed = total - passed;
  const passRate = total ? Math.round((passed / total) * 100) : 100;
  const tokens = cases.reduce((n, c) => n + c.promptTokens + c.completionTokens, 0);
  const cost = cases.reduce((n, c) => n + c.costUsd, 0);

  const stats =
    stat('pass rate', `${passRate}%`, failed ? 'warn' : 'ok') +
    stat('passed', passed, 'ok') +
    stat('failed', failed, failed ? 'bad' : '') +
    stat('cases', total) +
    stat('tokens', tokens.toLocaleString('en-US')) +
    stat('est. cost', money(cost));

  const suites = run.suites.map(renderSuite).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>litmus report</title>
<link rel="icon" href="${FAVICON}" />
<style>
  :root {
    --bg:#0b0e14; --surface:#12161f; --surface-2:#1a1f2b; --border:#2a3140;
    --ink:#e8edf5; --muted:#9aa4b2; --faint:#6b7480;
    --accent:#3fb950; --ok:#3fb950; --bad:#f85149; --warn:#d29922;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background: radial-gradient(900px 380px at 82% -8%, rgba(63,185,80,0.10), transparent 60%), var(--bg);
    color:var(--ink); line-height:1.5;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;
  }
  .wrap { max-width:920px; margin:0 auto; padding:40px 22px 72px; animation:rise .5s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes rise { from { opacity:0; transform:translateY(8px); } }
  header { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  .mark { width:42px; height:42px; flex:none; }
  header h1 { margin:0; font-size:21px; font-weight:700; letter-spacing:-0.02em; }
  header .tag { color:var(--faint); font-size:12.5px; text-transform:uppercase; letter-spacing:0.12em; margin-top:1px; }
  .banner { border-radius:11px; padding:11px 15px; margin-bottom:12px; font-size:14px; border:1px solid; }
  .banner.bad { background:rgba(248,81,73,0.1); border-color:rgba(248,81,73,0.5); color:#ffc7c2; }
  .banner.ok { background:rgba(63,185,80,0.1); border-color:rgba(63,185,80,0.5); color:#a6e3a9; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(108px,1fr)); gap:10px; margin-bottom:20px; }
  .stat { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:13px 15px; }
  .num { font-size:24px; font-weight:680; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
  .lbl { color:var(--muted); font-size:11.5px; margin-top:2px; }
  .stat.ok .num{color:var(--ok)} .stat.bad .num{color:var(--bad)} .stat.warn .num{color:var(--warn)}
  .filters { display:flex; gap:8px; margin:0 0 16px; }
  .fb { background:var(--surface); color:var(--muted); border:1px solid var(--border); border-radius:999px;
    padding:6px 15px; font-size:13px; font-weight:500; cursor:pointer; transition:color .15s, border-color .15s; }
  .fb:hover { color:var(--ink); }
  .fb.active { color:var(--ink); border-color:var(--accent); background:rgba(63,185,80,0.10); }
  .suite { margin-top:22px; }
  .suite h2 { font-size:16px; margin:0 0 4px; display:flex; align-items:center; gap:9px; font-weight:650; }
  .count { font-size:12px; color:var(--muted); font-weight:500; border:1px solid var(--border); border-radius:999px; padding:1px 9px; }
  .sdesc { color:var(--muted); font-size:13px; margin:0 0 10px; }
  details.case { background:var(--surface); border:1px solid var(--border); border-radius:12px; margin-bottom:9px; overflow:hidden;
    animation:rise .5s cubic-bezier(.2,.7,.2,1) both; animation-delay:calc(var(--i) * 35ms + 100ms); }
  details.case.bad { border-color:rgba(248,81,73,0.42); }
  details.case[open] { background:var(--surface-2); }
  summary { cursor:pointer; padding:12px 16px; display:flex; align-items:center; gap:11px; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  .badge { font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:6px; letter-spacing:0.05em; white-space:nowrap; }
  .badge.ok { background:rgba(63,185,80,0.16); color:var(--ok); }
  .badge.bad { background:rgba(248,81,73,0.16); color:var(--bad); }
  .ct { font-weight:550; font-size:14.5px; }
  .meta { margin-left:auto; color:var(--faint); font-size:12px; font-variant-numeric:tabular-nums; }
  .chev { color:var(--faint); transition:transform .2s ease; }
  details[open] .chev { transform:rotate(90deg); }
  .body { padding:4px 16px 16px; border-top:1px solid var(--border); }
  .aslist { margin:11px 0; display:grid; gap:5px; }
  .as { font-size:13.5px; } .as .mk { display:inline-block; width:16px; font-weight:800; }
  .as.ok .mk{color:var(--ok)} .as.bad{color:#ffc7c2} .as.bad .mk{color:var(--bad)}
  .at { color:var(--accent); font-family:ui-monospace,monospace; font-size:12px; }
  .blk { margin-top:11px; }
  .bl { color:var(--faint); font-size:11px; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
  pre { margin:0; background:#0a0d13; border:1px solid var(--border); border-radius:8px; padding:11px 13px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; white-space:pre-wrap; word-break:break-word; color:#c9d2de; max-height:320px; overflow:auto; }
  table.vars { border-collapse:collapse; font-size:13px; }
  table.vars td { border:1px solid var(--border); padding:4px 10px; }
  table.vars td:first-child { color:var(--accent); font-family:ui-monospace,monospace; }
  .foot { margin-top:11px; color:var(--faint); font-size:12px; }
  footer { margin-top:34px; color:var(--faint); font-size:12px; text-align:center; }
  footer a { color:var(--accent); text-decoration:none; }
  body[data-filter="failed"] details.case.ok { display:none; }
  @media (prefers-reduced-motion: reduce) { .wrap, details.case { animation:none; } }
</style>
</head>
<body data-filter="all">
  <div class="wrap">
    <header>
      ${MARK}
      <div><h1>litmus</h1><div class="tag">test report</div></div>
    </header>
    ${renderBanner(diff)}
    <div class="stats">${stats}</div>
    <div class="filters">
      <button class="fb active" data-f="all" onclick="setFilter('all')">All cases</button>
      <button class="fb" data-f="failed" onclick="setFilter('failed')">Failed only</button>
    </div>
    ${suites}
    <footer>Generated by <a href="https://github.com/rxNxkolai/litmus">litmus</a> · unit tests for your LLM prompts</footer>
  </div>
  <script>
    function setFilter(f) {
      document.body.setAttribute('data-filter', f);
      for (const b of document.querySelectorAll('.fb')) b.classList.toggle('active', b.getAttribute('data-f') === f);
    }
  </script>
</body>
</html>`;
}
