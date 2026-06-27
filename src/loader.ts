import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Suite } from './types.js';

const SUITE_RE = /\.(suite|litmus)\.(json|mjs|js)$/;

/**
 * Load a suite from `.json` (parsed) or `.js`/`.mjs` (dynamically imported,
 * using the module's default or named `suite` export).
 */
export async function loadSuite(path: string): Promise<Suite> {
  if (extname(path).toLowerCase() === '.json') {
    return JSON.parse(readFileSync(path, 'utf8')) as Suite;
  }
  const mod = await import(pathToFileURL(resolve(path)).href);
  const suite = (mod.default ?? mod.suite) as Suite | undefined;
  if (!suite) {
    throw new Error(`${path} does not export a default (or "suite") object`);
  }
  return suite;
}

/** Expand file/dir paths into concrete suite files (`*.suite.{json,mjs,js}`). */
export function discoverSuites(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (file: string) => {
    if (!seen.has(file)) {
      seen.add(file);
      out.push(file);
    }
  };

  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && SUITE_RE.test(entry.name)) add(full);
    }
  };

  for (const p of paths) {
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p);
    else if (st.isFile()) add(p);
  }
  return out;
}

/** Validate the minimum shape of a loaded suite, throwing a clear error if invalid. */
export function validateSuite(suite: Suite, path: string): void {
  if (!suite || typeof suite !== 'object') throw new Error(`${path}: suite must be an object`);
  if (!suite.name) throw new Error(`${path}: suite.name is required`);
  if (typeof suite.prompt !== 'string')
    throw new Error(`${path}: suite.prompt (string) is required`);
  if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
    throw new Error(`${path}: suite.cases must be a non-empty array`);
  }
  for (const c of suite.cases) {
    if (!c.name) throw new Error(`${path}: every case needs a name`);
    if (!Array.isArray(c.assert))
      throw new Error(`${path}: case "${c.name}" needs an assert array`);
  }
}
