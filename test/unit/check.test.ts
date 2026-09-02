import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { check } from '../../src/check.ts';
import { allRules } from '../../src/rules/index.ts';
import type { Violation } from '../../src/types.ts';

const fixture = (name: string): string => path.join(import.meta.dirname, '../fixtures', name);
const options = { wait: 0, timeout: 60_000 };

// Repeatedly starting and stopping Slidev's dev server inside one process can wedge it,
// so most cases run the CLI in a subprocess, which is also how the tool is really used.
async function runCli(entry: string, ...args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const proc = Bun.spawn(['bun', path.join(import.meta.dirname, '../../src/cli.ts'), ...args, entry], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  return { exitCode: await proc.exited, stdout };
}

async function runCliJson(entry: string): Promise<{ exitCode: number; violations: Violation[] }> {
  const { exitCode, stdout } = await runCli(entry, '--json');
  return { exitCode, violations: stdout ? (JSON.parse(stdout) as Violation[]) : [] };
}

describe('cli', () => {
  test('prints nothing and exits with 0 for a clean deck', async () => {
    const { exitCode, stdout } = await runCli(fixture('clean.md'));
    expect(stdout).toBe('');
    expect(exitCode).toBe(0);
  }, 90_000);

  test('reports elements that overflow the slide', async () => {
    const { exitCode, violations } = await runCliJson(fixture('overflow.md'));
    expect(exitCode).toBe(1);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['no-overflow', 'error', 2],
      ['optimal-zoom', 'warn', 2],
      ['no-overflow', 'error', 3],
    ]);
    const [text, zoom, box] = violations;
    expect(zoom?.message).toMatch(
      /^The slide content overflows the slide bottom; wrapping it in `<div style="zoom: 0\.\d+">` keeps the margin\.$/
    );
    expect(text?.message).toMatch(/overflows the slide by \d+px at the bottom/);
    expect(text?.message).toContain('Line 12');
    expect(box?.message).toMatch(/overflows the slide by 220px at the right/);
    expect(box?.slide.line).toBe(18);
    expect(box?.slide.filepath).toBe(fixture('overflow.md'));
  }, 90_000);

  test('reports elements that overlap each other once per pair', async () => {
    const { exitCode, violations } = await runCliJson(fixture('overlap.md'));
    expect(exitCode).toBe(1);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['no-overlap', 'error', 2],
      ['no-overlap', 'error', 3],
    ]);
    const [boxes, texts] = violations;
    expect(boxes?.message).toContain('First box');
    expect(boxes?.message).toMatch(/overlaps `<div\.absolute\.bg-blue-200>Second box` by 100×100px/);
    expect(texts?.message).toMatch(/Another sentence/);
    expect(texts?.help).toBe('Consider splitting the content into multiple slides.');
  }, 90_000);

  test('detects content overlapping a theme-style bottom band (global-bottom.vue)', async () => {
    const { exitCode, stdout } = await runCli(fixture('band/slides.md'));
    const output = stripVTControlCharacters(stdout);
    expect(exitCode).toBe(1);
    expect(output).toMatch(
      /^2: error no-overlap: Element `<div\.band[^`]*` overlaps `<div\.absolute>Text over the ba…`/m
    );
    expect(output).not.toMatch(/^1: /m);
    expect(output).toContain('Found 0 warnings and 1 error.');
  }, 90_000);

  test('warns on headings wrapping beyond the allowed lines, ignoring the cover title', async () => {
    const { exitCode, violations } = await runCliJson(fixture('heading.md'));
    expect(exitCode).toBe(0); // warnings do not fail the check
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([['max-heading-lines', 'warn', 3]]);
    expect(violations[0]?.message).toMatch(/spans 2 lines, exceeding the maximum of 1/);
    expect(violations[0]?.help).toBe('Consider shortening the heading.');
  }, 90_000);

  test('warns on text below the minimum font size, reporting only the outermost element', async () => {
    const { exitCode, violations } = await runCliJson(fixture('font-size.md'));
    expect(exitCode).toBe(0);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([['min-font-size', 'warn', 2]]);
    expect(violations[0]?.message).toMatch(/has a font size of 12px, smaller than the minimum of 14px/);
    expect(violations[0]?.help).toBe('Consider increasing the font size.');
  }, 90_000);
});

const zoomViolations = (violations: Violation[]): Violation[] => violations.filter((v) => v.ruleId === 'optimal-zoom');

describe('optimal-zoom', () => {
  test('warns on zoom wrappers that are too small, too large, or cannot fit, and on tight slides without one', async () => {
    const { violations } = await runCliJson(fixture('zoom.md'));
    const zoom = zoomViolations(violations);
    expect(zoom.map((v) => [v.severity, v.slide.no])).toEqual([
      ['warn', 2],
      ['warn', 3],
      ['warn', 4],
      ['warn', 6],
      ['warn', 7],
    ]);
    const [tooSmall, tooLarge, noWrapper, percent, cannotFit] = zoom;
    expect(tooSmall?.message).toMatch(
      /^Element `<div>A short list[^`]*` is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 1\.$/
    );
    expect(tooSmall?.help).toBe('Consider setting `zoom: 1`.');
    expect(tooSmall?.fix).toEqual({ line: 13, from: 'zoom: 0.5', to: 'zoom: 1' });
    expect(tooLarge?.message).toMatch(/is zoomed to 1 and overflows the slide bottom; zoom: 0\.8 keeps the margin\.$/);
    expect(tooLarge?.fix).toEqual({ line: 25, from: 'zoom: 1', to: 'zoom: 0.8' });
    expect(noWrapper?.message).toMatch(
      /^The slide content leaves only 0\.0 lines of margin above the slide bottom \(minimum 1\); wrapping it in `<div style="zoom: 0\.95">` keeps the margin\.$/
    );
    expect(noWrapper?.help).toBe('Consider wrapping the content below the heading in `<div style="zoom: 0.95">`.');
    expect(noWrapper?.fix).toBeUndefined();
    // Only the outermost wrapper is checked, and a percent value is rewritten as a percent.
    expect(percent?.message).toMatch(/^Element `<div>Outer wrapper[^`]*` is zoomed to 0\.6 but still keeps/);
    expect(percent?.fix).toEqual({ line: 47, from: 'zoom: 60%', to: 'zoom: 100%' });
    expect(cannotFit?.message).toMatch(
      /is zoomed to 0\.5 and does not fit with a margin of 1 line above the slide bottom at any zoom down to 0\.1\.$/
    );
    expect(cannotFit?.help).toBe('Consider splitting the content into multiple slides.');
    expect(cannotFit?.fix).toBeUndefined();
  }, 90_000);

  test('--fix rewrites the zoom declarations to the optimal values', async () => {
    const copy = fixture('zoom-fixed.md');
    fs.copyFileSync(fixture('zoom.md'), copy);
    try {
      const { stdout } = await runCli(copy, '--fix');
      expect(stripVTControlCharacters(stdout)).toContain('Fixed 3 problems.');
      const lines = fs.readFileSync(copy, 'utf8').split('\n');
      expect(lines[12]).toBe('<div style="zoom: 1">');
      expect(lines[24]).toBe('<div style="zoom: 0.8">');
      expect(lines[46]).toBe('<div style="zoom: 100%">');
      const { violations } = await runCliJson(copy);
      expect(zoomViolations(violations).map((v) => v.slide.no)).toEqual([4, 7]);
    } finally {
      fs.rmSync(copy, { force: true });
    }
  }, 180_000);
});

describe('check API', () => {
  test('runs only the requested rules and applies severity overrides', async () => {
    const violations = await check({
      entry: fixture('overlap.md'),
      ...options,
      rules: allRules.filter((rule) => rule.id === 'no-overlap'),
      severities: { 'no-overlap': 'warn' },
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((v) => v.ruleId === 'no-overlap' && v.severity === 'warn')).toBe(true);

    const off = await check({ entry: fixture('overlap.md'), ...options, severities: { 'no-overlap': 'off' } });
    expect(off.filter((v) => v.ruleId === 'no-overlap')).toEqual([]);
  }, 90_000);
});
