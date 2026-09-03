#!/usr/bin/env bun
import path from 'node:path';
import { parseArgs } from 'node:util';
import { check } from './check.ts';
import { applyFixes } from './fix.ts';
import { formatViolations } from './report.ts';
import { allRules } from './rules/index.ts';

const HELP = `Usage: slidev-check [options] <slides.md>

Renders the slides with Slidev and reports layout problems. Prints nothing when no problem is found.

Options:
  -t, --theme <name>     Override the theme
  --wait <ms>            Extra time to wait before checking (default: 0)
  --timeout <ms>         Timeout for rendering (default: 30000)
  --fix                  Rewrite the slides with the fixes suggested by rules (e.g. the zoom of optimal-zoom)
  --json                 Print violations as JSON (with --fix: { fixed, violations })
  -h, --help             Show this help

Rules:
${allRules.map((rule) => `  ${rule.id.padEnd(22)}${rule.description}`).join('\n')}
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    theme: { type: 'string', short: 't' },
    wait: { type: 'string', default: '0' },
    timeout: { type: 'string', default: '30000' },
    fix: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const entry = positionals[0];
if (values.help || !entry) {
  process.stdout.write(HELP);
  process.exit(values.help ? 0 : 2);
}

try {
  const startedAt = performance.now();
  const options = {
    entry: path.resolve(entry),
    theme: values.theme,
    wait: Number(values.wait),
    timeout: Number(values.timeout),
  };
  let violations = await check(options);
  let fixed = 0;
  if (values.fix) {
    fixed = applyFixes(violations);
    // A fix changes the rendered deck, so the remaining violations are collected from a fresh render;
    // a fix that was skipped means the file changed underneath too.
    if (violations.some((v) => v.fix)) {
      try {
        violations = await check(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `slidev-check: rewrote ${fixed} problem(s) in the slides, but re-checking failed: ${message}\n`
        );
        process.exit(2);
      }
    }
  }
  // With --fix, the JSON also says how many problems were rewritten, so that a run that fixed
  // everything can be told apart from one that found nothing.
  const report = values.json
    ? JSON.stringify(values.fix ? { fixed, violations } : violations, undefined, 2)
    : formatViolations(violations, { durationMs: performance.now() - startedAt, ruleCount: allRules.length, fixed });
  // A clean run prints nothing, except that `--fix --json` always reports the number of fixes.
  if (report && (violations.length > 0 || fixed > 0 || (values.fix && values.json)))
    process.stdout.write(`${report}\n`);
  process.exit(violations.some((v) => v.severity === 'error') ? 1 : 0);
} catch (error) {
  process.stderr.write(`slidev-check: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
