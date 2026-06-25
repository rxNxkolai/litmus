import type { AssertionResult, AssertionSpec } from './types.js';

export interface EvalContext {
  response: string;
  latencyMs: number;
  costUsd: number;
}

/** Evaluate one assertion against a generation result. */
export function runAssertion(spec: AssertionSpec, ctx: EvalContext): AssertionResult {
  const make = (pass: boolean, message: string): AssertionResult => ({
    type: spec.type,
    pass,
    message,
    spec,
  });
  const text = ctx.response;

  switch (spec.type) {
    case 'contains': {
      const hay = spec.ignoreCase ? text.toLowerCase() : text;
      const needle = spec.ignoreCase ? spec.value.toLowerCase() : spec.value;
      const pass = hay.includes(needle);
      return make(
        pass,
        pass ? `contains "${spec.value}"` : `expected output to contain "${spec.value}"`,
      );
    }
    case 'not-contains': {
      const hay = spec.ignoreCase ? text.toLowerCase() : text;
      const needle = spec.ignoreCase ? spec.value.toLowerCase() : spec.value;
      const pass = !hay.includes(needle);
      return make(
        pass,
        pass
          ? `does not contain "${spec.value}"`
          : `expected output NOT to contain "${spec.value}"`,
      );
    }
    case 'equals': {
      let a = text;
      let b = spec.value;
      if (spec.trim) {
        a = a.trim();
        b = b.trim();
      }
      if (spec.ignoreCase) {
        a = a.toLowerCase();
        b = b.toLowerCase();
      }
      const pass = a === b;
      return make(
        pass,
        pass ? 'equals expected value' : `expected output to equal "${spec.value}"`,
      );
    }
    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(spec.pattern, spec.flags);
      } catch (e) {
        return make(false, `invalid regex: ${(e as Error).message}`);
      }
      const pass = re.test(text);
      const label = `/${spec.pattern}/${spec.flags ?? ''}`;
      return make(pass, pass ? `matches ${label}` : `expected output to match ${label}`);
    }
    case 'is-json': {
      const pass = isJson(text);
      return make(pass, pass ? 'output is valid JSON' : 'expected output to be valid JSON');
    }
    case 'json-path': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return make(false, 'output is not valid JSON');
      }
      const found = getPath(parsed, spec.path);
      if (spec.exists !== undefined) {
        const pass = (found !== undefined) === spec.exists;
        return make(
          pass,
          pass
            ? `path ${spec.path} ${spec.exists ? 'exists' : 'is absent'}`
            : `expected path ${spec.path} to ${spec.exists ? 'exist' : 'be absent'}`,
        );
      }
      if ('equals' in spec) {
        const pass = looseEqual(found, spec.equals);
        return make(
          pass,
          pass
            ? `${spec.path} == ${JSON.stringify(spec.equals)}`
            : `expected ${spec.path} to equal ${JSON.stringify(spec.equals)} (got ${JSON.stringify(found)})`,
        );
      }
      const pass = found !== undefined;
      return make(pass, pass ? `path ${spec.path} exists` : `path ${spec.path} not found`);
    }
    case 'min-length': {
      const pass = text.length >= spec.value;
      return make(
        pass,
        pass
          ? `length ${text.length} >= ${spec.value}`
          : `expected length >= ${spec.value}, got ${text.length}`,
      );
    }
    case 'max-length': {
      const pass = text.length <= spec.value;
      return make(
        pass,
        pass
          ? `length ${text.length} <= ${spec.value}`
          : `expected length <= ${spec.value}, got ${text.length}`,
      );
    }
    case 'one-of': {
      const hay = spec.ignoreCase ? text.trim().toLowerCase() : text.trim();
      const options = spec.ignoreCase ? spec.values.map((v) => v.toLowerCase()) : spec.values;
      const pass = options.includes(hay);
      return make(
        pass,
        pass
          ? `output is one of the allowed values`
          : `expected output to be one of [${spec.values.join(', ')}]`,
      );
    }
    case 'max-latency-ms': {
      const pass = ctx.latencyMs <= spec.value;
      return make(
        pass,
        pass
          ? `latency ${ctx.latencyMs}ms <= ${spec.value}ms`
          : `latency ${ctx.latencyMs}ms exceeded ${spec.value}ms`,
      );
    }
    case 'max-cost-usd': {
      const pass = ctx.costUsd <= spec.value;
      return make(
        pass,
        pass
          ? `cost $${ctx.costUsd.toFixed(6)} <= $${spec.value}`
          : `cost $${ctx.costUsd.toFixed(6)} exceeded $${spec.value}`,
      );
    }
    default: {
      const exhaustive: never = spec;
      return make(false, `unknown assertion: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a dotted/bracketed path like `a.b[0].c` against a parsed value. */
function getPath(obj: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** Equality with light coercion so `"0.9"` matches `0.9` and objects compare structurally. */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}
