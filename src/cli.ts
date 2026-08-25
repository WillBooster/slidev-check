#!/usr/bin/env bun
import path from 'node:path';
import { parseArgs } from 'node:util';
import { audit } from './audit.ts';
import { formatViolations } from './report.ts';
import { rules } from './rules/index.ts';

const HELP = `Usage: slidev-audit [options] <slides.md>

Renders the slides with Slidev and reports layout problems. Prints nothing when no problem is found.

Options:
  -t, --theme <name>     Override the theme
  --wait <ms>            Extra time to wait before auditing (default: 0)
  --timeout <ms>         Timeout for rendering (default: 30000)
  --json                 Print violations as JSON
  -h, --help             Show this help

Rules:
${rules.map((rule) => `  ${rule.id.padEnd(22)}${rule.description}`).join('\n')}
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    theme: { type: 'string', short: 't' },
    wait: { type: 'string', default: '0' },
    timeout: { type: 'string', default: '30000' },
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
  const violations = await audit({
    entry: path.resolve(entry),
    theme: values.theme,
    wait: Number(values.wait),
    timeout: Number(values.timeout),
  });
  if (violations.length > 0) {
    process.stdout.write(`${values.json ? JSON.stringify(violations, undefined, 2) : formatViolations(violations)}\n`);
  }
  process.exit(violations.length > 0 ? 1 : 0);
} catch (error) {
  process.stderr.write(`slidev-audit: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
