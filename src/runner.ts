import type { CaseResult, Provider, Suite, SuiteResult, Vars } from './types.js';
import { runAssertion } from './assertions.js';
import { computeCost } from './cost.js';
import { render } from './templating.js';

export interface RunSuiteOptions {
  provider: Provider;
  model: string;
}

/** Run every case in a suite and collect a {@link SuiteResult}. */
export async function runSuite(suite: Suite, opts: RunSuiteOptions): Promise<SuiteResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const cases: CaseResult[] = [];

  for (const testCase of suite.cases) {
    const vars: Vars = { ...(suite.defaults ?? {}), ...(testCase.vars ?? {}) };
    const prompt = render(suite.prompt, vars);
    const system = suite.system ? render(suite.system, vars) : undefined;
    const t0 = Date.now();

    try {
      const res = await opts.provider.generate({ prompt, system, model: opts.model });
      const latencyMs = Date.now() - t0;
      const costUsd = computeCost(res.model, res.promptTokens, res.completionTokens);
      const assertions = testCase.assert.map((spec) =>
        runAssertion(spec, { response: res.text, latencyMs, costUsd }),
      );
      cases.push({
        name: testCase.name,
        description: testCase.description,
        vars,
        prompt,
        system,
        response: res.text,
        provider: opts.provider.name,
        model: res.model,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        costUsd,
        latencyMs,
        assertions,
        pass: assertions.every((a) => a.pass),
      });
    } catch (e) {
      cases.push({
        name: testCase.name,
        description: testCase.description,
        vars,
        prompt,
        system,
        response: '',
        provider: opts.provider.name,
        model: opts.model,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - t0,
        assertions: [],
        pass: false,
        error: (e as Error).message,
      });
    }
  }

  const passed = cases.filter((c) => c.pass).length;
  return {
    suite: suite.name,
    description: suite.description,
    provider: opts.provider.name,
    model: opts.model,
    startedAt,
    durationMs: Date.now() - start,
    cases,
    passed,
    failed: cases.length - passed,
    total: cases.length,
  };
}
