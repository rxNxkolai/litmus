import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ProviderName, Run, SuiteResult } from './types.js';
import { discoverSuites, loadSuite, validateSuite } from './loader.js';
import { defaultModel, getProvider } from './providers/index.js';
import { runSuite } from './runner.js';
import { diffRuns, listRuns, previousRun, saveRun } from './store.js';
import { formatConsole } from './reporters/console.js';
import { renderHtml } from './reporters/html.js';

const VERSION = '0.1.0';
const PROVIDERS: ProviderName[] = ['mock', 'openai', 'anthropic'];

export interface RunIO {
  out: (line: string) => void;
  err: (line: string) => void;
}

const defaultIO: RunIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

interface ParsedArgs {
  command: string;
  paths: string[];
  provider?: ProviderName;
  model?: string;
  html?: string;
  input?: string;
  json: boolean;
  noColor: boolean;
  noSave: boolean;
  help: boolean;
  version: boolean;
  errors: string[];
}

const HELP = `litmus v${VERSION}
Unit tests for your LLM prompts. Runs offline against a deterministic mock model.

Usage: litmus <command> [options]

Commands:
  run <files-or-dirs...>   Run suites and report pass/fail
  report                   Re-render the latest run as an HTML report
  list                     List saved runs
  init                     Write a starter example suite

Options:
  -p, --provider <name>    mock | openai | anthropic (default: mock)
  -m, --model <id>         Model id (default: per-suite or provider default)
      --html <path>        Write an interactive HTML report to <path>
      --input <runfile>    (report) Render a specific saved run file
      --json               Emit machine-readable JSON instead of text
      --no-save            Do not persist this run to .litmus/runs
      --no-color           Disable colored output
  -v, --version            Print version
  -h, --help               Print this help

Examples:
  litmus run examples/ --html report.html
  litmus run suites/ --provider openai --model gpt-4o-mini
  litmus list

Exit codes: 0 = all passed, 1 = failures, 2 = bad usage.`;

function parseArgs(argv: string[]): ParsedArgs {
  const res: ParsedArgs = {
    command: '',
    paths: [],
    json: false,
    noColor: false,
    noSave: false,
    help: false,
    version: false,
    errors: [],
  };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i] ?? '';
    let inlineValue: string | undefined;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq !== -1) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue;
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('-') && v !== '-')) {
        res.errors.push(`Missing value for ${arg}`);
        return '';
      }
      i++;
      return v;
    };

    switch (arg) {
      case '-h':
      case '--help':
        res.help = true;
        break;
      case '-v':
      case '--version':
        res.version = true;
        break;
      case '--json':
        res.json = true;
        break;
      case '--no-color':
        res.noColor = true;
        break;
      case '--no-save':
        res.noSave = true;
        break;
      case '-p':
      case '--provider': {
        const p = takeValue();
        if ((PROVIDERS as string[]).includes(p)) res.provider = p as ProviderName;
        else if (p) res.errors.push(`Unknown provider: ${p}`);
        break;
      }
      case '-m':
      case '--model':
        res.model = takeValue();
        break;
      case '--html':
        res.html = takeValue();
        break;
      case '--input':
        res.input = takeValue();
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') res.errors.push(`Unknown option: ${arg}`);
        else if (!res.command) res.command = arg;
        else res.paths.push(arg);
    }
  }

  return res;
}

function detectColor(noColor: boolean): boolean {
  return noColor ? false : !process.env.NO_COLOR && Boolean(process.stdout.isTTY);
}

function makeRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function cmdRun(opts: ParsedArgs, io: RunIO): Promise<number> {
  if (opts.paths.length === 0) {
    io.err('run: provide one or more suite files or directories.');
    return 2;
  }
  const files = discoverSuites(opts.paths);
  if (files.length === 0) {
    io.err('No suite files found (looking for *.suite.{json,mjs,js}).');
    return 2;
  }

  const suites: SuiteResult[] = [];
  for (const file of files) {
    let suite;
    try {
      suite = await loadSuite(file);
      validateSuite(suite, file);
    } catch (e) {
      io.err(`Failed to load ${file}: ${(e as Error).message}`);
      return 2;
    }
    const providerName: ProviderName = opts.provider ?? suite.provider ?? 'mock';
    const model = opts.model ?? suite.model ?? defaultModel(providerName);
    suites.push(await runSuite(suite, { provider: getProvider(providerName), model }));
  }

  const run: Run = { id: makeRunId(), createdAt: new Date().toISOString(), suites };
  const prev = previousRun();
  const diff = prev ? diffRuns(prev, run) : undefined;

  if (opts.json) {
    io.out(JSON.stringify({ run, diff }, null, 2));
  } else {
    io.out(formatConsole(run, diff, { color: detectColor(opts.noColor) }));
  }

  if (!opts.noSave) saveRun(run);
  if (opts.html) {
    writeFileSync(opts.html, renderHtml(run, diff), 'utf8');
    if (!opts.json) io.out(`\nHTML report written to ${opts.html}`);
  }

  const failures = suites.reduce((n, s) => n + s.failed, 0);
  return failures > 0 ? 1 : 0;
}

function cmdReport(opts: ParsedArgs, io: RunIO): number {
  let run: Run | undefined;
  let diff;
  if (opts.input) {
    try {
      run = JSON.parse(readFileSync(opts.input, 'utf8')) as Run;
    } catch (e) {
      io.err(`Could not read run file ${opts.input}: ${(e as Error).message}`);
      return 2;
    }
  } else {
    const runs = listRuns();
    run = runs[runs.length - 1];
    const prior = runs[runs.length - 2];
    if (run && prior) diff = diffRuns(prior, run);
  }
  if (!run) {
    io.err('No runs found. Run `litmus run <suite>` first.');
    return 2;
  }
  const out = opts.html ?? 'litmus-report.html';
  writeFileSync(out, renderHtml(run, diff), 'utf8');
  io.out(`HTML report written to ${out}`);
  return 0;
}

function cmdList(io: RunIO): number {
  const runs = listRuns();
  if (runs.length === 0) {
    io.out('No runs yet. Run `litmus run <suite>` to create one.');
    return 0;
  }
  for (const run of runs) {
    const total = run.suites.reduce((n, s) => n + s.total, 0);
    const passed = run.suites.reduce((n, s) => n + s.passed, 0);
    io.out(`${run.id}  ${passed}/${total} passed  (${run.createdAt})`);
  }
  return 0;
}

const STARTER_SUITE = `// litmus suite. Run: litmus run example.suite.mjs
export default {
  name: 'example',
  description: 'A starter suite using the offline mock provider.',
  model: 'mock:sentiment',
  prompt: 'Classify the sentiment of this review as JSON: {{review}}',
  cases: [
    {
      name: 'positive review',
      vars: { review: 'I love this, it is great and works perfectly.' },
      assert: [
        { type: 'is-json' },
        { type: 'json-path', path: 'sentiment', equals: 'positive' },
      ],
    },
    {
      name: 'negative review',
      vars: { review: 'Terrible and buggy, the worst. I want a refund.' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'negative' }],
    },
  ],
};
`;

function cmdInit(io: RunIO): number {
  const target = 'example.suite.mjs';
  if (existsSync(target)) {
    io.err(`${target} already exists; refusing to overwrite.`);
    return 1;
  }
  writeFileSync(target, STARTER_SUITE, 'utf8');
  io.out(`Created ${target}. Run it with: litmus run ${target}`);
  return 0;
}

/** Entry point for the CLI. Returns an exit code instead of calling process.exit. */
export async function run(argv: string[], io: RunIO = defaultIO): Promise<number> {
  const opts = parseArgs(argv);

  if (opts.errors.length > 0) {
    for (const e of opts.errors) io.err(e);
    return 2;
  }
  if (opts.help || (!opts.command && !opts.version)) {
    io.out(HELP);
    return 0;
  }
  if (opts.version) {
    io.out(VERSION);
    return 0;
  }

  switch (opts.command) {
    case 'run':
      return cmdRun(opts, io);
    case 'report':
      return cmdReport(opts, io);
    case 'list':
      return cmdList(io);
    case 'init':
      return cmdInit(io);
    default:
      io.err(`Unknown command: ${opts.command}`);
      io.err('Run `litmus --help` for usage.');
      return 2;
  }
}
