import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { audit } from '../src/audit.ts';
import { formatViolations } from '../src/report.ts';
import { rules } from '../src/rules/index.ts';

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);
const options = { wait: 0, timeout: 60_000 };

describe('audit', () => {
  test('reports nothing for a clean deck', async () => {
    const violations = await audit({ entry: fixture('clean.md'), ...options });
    expect(violations).toEqual([]);
    expect(formatViolations(violations)).toBe('');
  }, 90_000);

  test('reports elements that overflow the slide', async () => {
    const violations = await audit({ entry: fixture('overflow.md'), ...options });
    expect(violations.map((v) => [v.ruleId, v.slide.no])).toEqual([
      ['no-overflow', 2],
      ['no-overflow', 3],
    ]);
    const [text, box] = violations;
    expect(text?.message).toMatch(/beyond the bottom edge/);
    expect(text?.element).toContain('Line 12');
    expect(box?.message).toMatch(/220px beyond the right edge/);
    expect(box?.slide.line).toBe(18);
    expect(box?.slide.filepath).toBe(fixture('overflow.md'));

    const report = formatViolations(violations, import.meta.dirname);
    expect(report).toContain('fixtures/overflow.md:18  error');
    expect(report).toContain('no-overflow');
    expect(report).toContain('✖ 2 problems');
  }, 90_000);

  test('reports elements that overlap each other once per pair', async () => {
    const violations = await audit({ entry: fixture('overlap.md'), ...options });
    expect(violations.map((v) => [v.ruleId, v.slide.no])).toEqual([
      ['no-overlap', 2],
      ['no-overlap', 3],
    ]);
    const [boxes, texts] = violations;
    expect(boxes?.element).toContain('First box');
    expect(boxes?.message).toMatch(/overlaps <div\.absolute\.bg-blue-200> "Second box" by 100×100px/);
    expect(texts?.message).toMatch(/Another sentence/);
    expect(texts?.hint).toMatch(/Text is drawn over other text/);
  }, 90_000);

  test('runs only the requested rules', async () => {
    const violations = await audit({ entry: fixture('overlap.md'), ...options, rules: [rules[0]!] });
    expect(violations).toEqual([]);
  }, 90_000);
});

describe('cli', () => {
  test('exits with 1 and prints the report when there are violations', async () => {
    const proc = Bun.spawn(['bun', path.join(import.meta.dirname, '../src/cli.ts'), fixture('overflow.md')], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(1);
    expect(stdout).toContain('no-overflow');
  }, 90_000);

  test('exits with 0 and prints nothing for a clean deck', async () => {
    const proc = Bun.spawn(['bun', path.join(import.meta.dirname, '../src/cli.ts'), fixture('clean.md')], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    expect(stdout).toBe('');
  }, 90_000);
});
