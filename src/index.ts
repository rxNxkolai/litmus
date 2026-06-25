/**
 * promptproof — unit tests for your LLM prompts.
 *
 * Public API:
 *   import { runSuite, loadSuite, renderHtml } from 'promptproof';
 */

export { runSuite } from './runner.js';
export type { RunSuiteOptions } from './runner.js';
export { runAssertion } from './assertions.js';
export type { EvalContext } from './assertions.js';
export { render } from './templating.js';
export { computeCost, estimateTokens, priceFor } from './cost.js';
export {
  getProvider,
  defaultModel,
  mockProvider,
  openaiProvider,
  anthropicProvider,
} from './providers/index.js';
export { loadSuite, discoverSuites, validateSuite } from './loader.js';
export { saveRun, listRuns, previousRun, diffRuns, runDir } from './store.js';
export { formatConsole, renderHtml } from './reporters/index.js';
export type { ConsoleOptions } from './reporters/index.js';
export type {
  Suite,
  TestCase,
  Vars,
  AssertionSpec,
  AssertionType,
  AssertionResult,
  Provider,
  ProviderName,
  ProviderResponse,
  GenerateRequest,
  CaseResult,
  SuiteResult,
  Run,
  Delta,
  Diff,
} from './types.js';

/** Current promptproof version. */
export const version = '0.1.0';
