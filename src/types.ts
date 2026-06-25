/**
 * Core data model for promptproof.
 *
 * A {@link Suite} is authored by the user (in JSON or JS). The {@link runSuite}
 * runner renders each case's prompt, calls a {@link Provider}, evaluates the
 * {@link AssertionSpec}s, and produces a {@link SuiteResult}. Runs are persisted
 * so later runs can be compared for regressions.
 */

export type Vars = Record<string, string | number | boolean>;

export type ProviderName = 'mock' | 'openai' | 'anthropic';

/** Declarative assertion. The runner turns each into a pass/fail {@link AssertionResult}. */
export type AssertionSpec =
  | { type: 'contains'; value: string; ignoreCase?: boolean }
  | { type: 'not-contains'; value: string; ignoreCase?: boolean }
  | { type: 'equals'; value: string; trim?: boolean; ignoreCase?: boolean }
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'is-json' }
  | { type: 'json-path'; path: string; equals?: unknown; exists?: boolean }
  | { type: 'min-length'; value: number }
  | { type: 'max-length'; value: number }
  | { type: 'one-of'; values: string[]; ignoreCase?: boolean }
  | { type: 'max-latency-ms'; value: number }
  | { type: 'max-cost-usd'; value: number };

export type AssertionType = AssertionSpec['type'];

/** A single test case: variables to render into the prompt plus assertions to check. */
export interface TestCase {
  name: string;
  description?: string;
  vars?: Vars;
  assert: AssertionSpec[];
}

/** A suite of cases sharing one prompt template, provider, and model. */
export interface Suite {
  name: string;
  description?: string;
  provider?: ProviderName;
  model?: string;
  /** Prompt template; `{{var}}` placeholders are filled from each case's vars. */
  prompt: string;
  /** Optional system-prompt template. */
  system?: string;
  /** Vars merged into every case (case vars win on conflict). */
  defaults?: Vars;
  cases: TestCase[];
}

export interface GenerateRequest {
  system?: string;
  prompt: string;
  model: string;
}

/** What a provider returns for one generation. Cost/latency are added by the runner. */
export interface ProviderResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface Provider {
  name: ProviderName;
  generate(req: GenerateRequest): Promise<ProviderResponse>;
}

export interface AssertionResult {
  type: AssertionType;
  pass: boolean;
  message: string;
  spec: AssertionSpec;
}

export interface CaseResult {
  name: string;
  description?: string;
  vars: Vars;
  prompt: string;
  system?: string;
  response: string;
  provider: ProviderName;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  assertions: AssertionResult[];
  pass: boolean;
  error?: string;
}

export interface SuiteResult {
  suite: string;
  description?: string;
  provider: ProviderName;
  model: string;
  startedAt: string;
  durationMs: number;
  cases: CaseResult[];
  passed: number;
  failed: number;
  total: number;
}

/** A persisted run, potentially spanning several suites. */
export interface Run {
  id: string;
  createdAt: string;
  suites: SuiteResult[];
}

/** A pass/fail transition for one case between two runs. */
export interface Delta {
  suite: string;
  case: string;
  was: boolean;
  now: boolean;
}

/** Regressions (pass -> fail) and fixes (fail -> pass) between two runs. */
export interface Diff {
  regressions: Delta[];
  fixes: Delta[];
}
