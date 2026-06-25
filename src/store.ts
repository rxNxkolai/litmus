import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Delta, Diff, Run } from './types.js';

const RUNS_SUBDIR = join('.promptproof', 'runs');

/** Absolute path to the run-history directory under `cwd`. */
export function runDir(cwd: string = process.cwd()): string {
  return join(cwd, RUNS_SUBDIR);
}

/** Persist a run as JSON and return the file path written. */
export function saveRun(run: Run, cwd: string = process.cwd()): string {
  const dir = runDir(cwd);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${run.id}.json`);
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  return file;
}

/** Load all saved runs, sorted oldest to newest by id. */
export function listRuns(cwd: string = process.cwd()): Run[] {
  let files: string[];
  try {
    files = readdirSync(runDir(cwd)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((f) => JSON.parse(readFileSync(join(runDir(cwd), f), 'utf8')) as Run)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The most recent saved run, if any. */
export function previousRun(cwd: string = process.cwd()): Run | undefined {
  const runs = listRuns(cwd);
  return runs.length > 0 ? runs[runs.length - 1] : undefined;
}

/** Compute regressions (pass -> fail) and fixes (fail -> pass) between two runs. */
export function diffRuns(prev: Run, next: Run): Diff {
  const prevPass = new Map<string, boolean>();
  for (const suite of prev.suites) {
    for (const c of suite.cases) prevPass.set(`${suite.suite}::${c.name}`, c.pass);
  }

  const regressions: Delta[] = [];
  const fixes: Delta[] = [];
  for (const suite of next.suites) {
    for (const c of suite.cases) {
      const was = prevPass.get(`${suite.suite}::${c.name}`);
      if (was === undefined) continue;
      if (was && !c.pass) regressions.push({ suite: suite.suite, case: c.name, was, now: c.pass });
      else if (!was && c.pass) fixes.push({ suite: suite.suite, case: c.name, was, now: c.pass });
    }
  }
  return { regressions, fixes };
}
