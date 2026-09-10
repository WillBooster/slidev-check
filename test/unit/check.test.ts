import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { check } from '../../src/check.ts';
import { applyFixes } from '../../src/fix.ts';
import { allRules } from '../../src/rules/index.ts';
import type { Fix, Violation } from '../../src/types.ts';

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
    const fix = await runCli(fixture('clean.md'), '--fix');
    expect(fix.stdout).toBe('');
    expect(fix.exitCode).toBe(0);
    const json = await runCli(fixture('clean.md'), '--json');
    expect(json.stdout).toBe('');
  }, 180_000);

  test('warns on rendered content limits without counting hidden text or inline markup twice', async () => {
    const { exitCode, violations } = await runCliJson(fixture('contentLimits.md'));
    expect(exitCode).toBe(0);
    const content = violations.filter((v) =>
      ['max-body-characters', 'max-body-lines', 'max-list-depth', 'max-table-rows'].includes(v.ruleId)
    );
    expect(content.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['max-body-characters', 'warn', 2],
      ['max-body-lines', 'warn', 4],
      ['max-list-depth', 'warn', 6],
      ['max-table-rows', 'warn', 8],
      ['max-body-lines', 'warn', 9],
      ['max-body-lines', 'warn', 10],
      ['max-body-characters', 'warn', 12],
      ['max-table-rows', 'warn', 14],
      ['max-table-rows', 'warn', 15],
      ['max-body-lines', 'warn', 17],
    ]);
    expect(content.map((v) => v.message)).toEqual([
      'Body text has 201 characters, exceeding the maximum of 200.',
      'Body text has 11 lines, exceeding the maximum of 10.',
      'List has 3 levels, exceeding the maximum of 2.',
      'Table has 8 rows, exceeding the maximum of 7.',
      'Body text has 11 lines, exceeding the maximum of 10.',
      'Body text has 12 lines, exceeding the maximum of 10.',
      'Body text has 201 characters, exceeding the maximum of 200.',
      'Table has 8 rows, exceeding the maximum of 7.',
      'Table has 8 rows, exceeding the maximum of 7.',
      'Body text has 12 lines, exceeding the maximum of 10.',
    ]);
  }, 90_000);

  test('reports elements that overflow the slide', async () => {
    const { exitCode, violations } = await runCliJson(fixture('overflow.md'));
    expect(exitCode).toBe(1);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['no-overflow', 'error', 2],
      ['optimal-zoom', 'warn', 2],
      ['max-body-characters', 'warn', 2],
      ['max-body-lines', 'warn', 2],
      ['no-overflow', 'error', 3],
    ]);
    const [text, zoom] = violations;
    const box = violations.at(-1);
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
    // Slide 5 sits at its optimum on the reference machine; a one-step shift elsewhere is tolerated.
    // Slide 25's zoom above the maximum fits with room to spare and is left alone (absent below).
    const zoom = zoomViolations(violations).filter((v) => !(v.slide.no === 5 && /zoom: 0\.5[57]\b/.test(v.message)));
    expect(zoom.map((v) => [v.severity, v.slide.no])).toEqual([
      ['warn', 2],
      ['warn', 3],
      ['warn', 4],
      ['warn', 6],
      ['warn', 7],
      ['warn', 9],
      ['warn', 9],
      ['warn', 10],
      ['warn', 10],
      ['warn', 11],
      ['warn', 12],
      ['warn', 13],
      ['warn', 14],
      ['warn', 15],
      ['warn', 16],
      ['warn', 17],
      ['warn', 18],
      ['warn', 19],
      ['warn', 20],
      ['warn', 21],
      ['warn', 22],
      ['warn', 23],
      ['warn', 24],
    ]);
    const [
      tooSmall,
      tooLarge,
      noWrapper,
      percent,
      cannotFit,
      top,
      bottom,
      left,
      right,
      code,
      positioned,
      bottomBox,
      overhang,
      spaced,
      quoted,
      lookAlike,
      blocked,
      column,
      upward,
      image,
      narrow,
      stacked,
      wrapped,
    ] = zoom;
    expect(tooSmall?.message).toMatch(
      /^Element `<div>A short list[^`]*` is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 1\.$/
    );
    expect(tooSmall?.help).toBe('Consider setting `zoom: 1`.');
    expect(tooSmall?.fix).toEqual({ line: 13, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Values bound by the geometry may shift by a step with the font metrics of the machine.
    expect(tooLarge?.message).toMatch(
      /is zoomed to 1 and overflows the slide bottom; zoom: 0\.(?:79|8|81) keeps the margin above the slide bottom\.$/
    );
    expect(tooLarge?.fix).toMatchObject({ line: 25, column: 12, from: 'zoom: 1' });
    expect(noWrapper?.message).toMatch(
      /^The slide content overflows the slide bottom; wrapping it in `<div style="zoom: 0\.9[2-4]">` keeps the margin\.$/
    );
    expect(noWrapper?.help).toMatch(
      /^Consider wrapping the content below the heading in `<div style="zoom: 0\.9[2-4]">`\.$/
    );
    expect(noWrapper?.fix).toBeUndefined();
    // Only the outermost wrapper is checked, and a percent value is rewritten as a percent.
    expect(percent?.message).toMatch(/^Element `<div>Outer wrapper[^`]*` is zoomed to 0\.6 but still keeps/);
    expect(percent?.fix).toEqual({ line: 47, column: 12, from: 'zoom: 60%', to: 'zoom: 100%' });
    expect(cannotFit?.message).toMatch(
      /is zoomed to 0\.5 and does not fit on the slide with a margin of 1 line above the slide bottom at any zoom down to 0\.1\.$/
    );
    expect(cannotFit?.help).toBe('Consider splitting the content into multiple slides.');
    expect(cannotFit?.fix).toBeUndefined();
    // Sibling wrappers are optimized in document order: the second one gets the space left by the first.
    expect(top?.fix).toEqual({ line: 77, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    expect(bottom?.fix).toMatchObject({ line: 81, column: 12, from: 'zoom: 0.5' });
    expect(Number.parseFloat(bottom?.fix?.to.replace('zoom: ', '') ?? '')).toBeLessThan(1);
    // Two declarations on one line are told apart by their column.
    expect(left?.fix).toEqual({ line: 89, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    expect(right?.fix).toEqual({ line: 89, column: 45, from: 'zoom: 0.5', to: 'zoom: 1' });
    // `zoom:` inside code does not disturb the mapping to the wrapper's declaration.
    expect(code?.fix).toEqual({ line: 95, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Positioned content inside the wrapper scales with it and bounds the zoom.
    expect(positioned?.fix).toMatchObject({ line: 109, column: 12, from: 'zoom: 0.5' });
    expect(Number.parseFloat(positioned?.fix?.to.replace('zoom: ', '') ?? '')).toBeLessThan(1);
    // A box at the bottom hosts no text, so the line height is taken from its ancestor.
    expect(bottomBox?.fix).toEqual({ line: 121, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Content hanging off the left edge bounds the zoom too.
    expect(overhang?.message).toMatch(
      /is zoomed to 0\.5 and sticks out of the slide; zoom: 0\.\d+ keeps the margin above the slide bottom\.$/
    );
    expect(Number.parseFloat(overhang?.fix?.to.replace('zoom: ', '') ?? '')).toBeLessThan(0.5);
    // The frontmatter `zoom:` and the prose are not declarations; spaces around the colon are kept.
    expect(spaced?.fix).toEqual({ line: 147, column: 12, from: 'zoom : 0.5', to: 'zoom : 1' });
    // An escaped quote, a quoted `;`, a comment, and a `--zoom` custom property in the same attribute do not hide the declaration.
    expect(quoted?.fix).toEqual({ line: 157, column: 58, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Neither an ignored zoomed element nor a `data-style` attribute counts as a declaration.
    expect(lookAlike?.fix).toEqual({ line: 169, column: 35, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Content outside the wrapper that takes the space is named instead of blaming the wrapper.
    expect(blocked?.message).toMatch(
      /^Element `<div>a tiny wrapper[^`]*` is zoomed to 0\.5 and cannot keep a margin of 1 line above the slide bottom at any zoom down to 0\.1, because `<p>Unwrapped line[^`]*` outside it already reaches that far\.$/
    );
    expect(blocked?.fix).toBeUndefined();
    // A taller sibling column does not take the space below the wrapper.
    expect(column?.fix).toEqual({ line: 193, column: 12, from: 'zoom: 0.5', to: 'zoom: 1' });
    // Content hanging off the top edge bounds the zoom too.
    expect(upward?.fix).toMatchObject({ line: 211, column: 12, from: 'zoom: 0.4' });
    expect(Number.parseFloat(upward?.fix?.to.replace('zoom: ', '') ?? '')).toBeLessThan(0.6);
    // Flow content below the wrapper counts whatever its size or horizontal position.
    expect(image?.message).toMatch(/because `<canvas>` outside it already reaches that far\.$/);
    expect(narrow?.message).toMatch(/because `<p>Narrow 13` outside it already reaches that far\.$/);
    // Items stacked in a flex column are below the wrapper, not beside it.
    expect(stacked?.message).toMatch(/because `<p>Below line 13[^`]*` outside it already reaches that far\.$/);
    // A flex item wrapped onto the next row is below the wrapper even when it starts to its right.
    expect(wrapped?.message).toMatch(/because `<p>Wrapped line 13` outside it already reaches that far\.$/);
  }, 90_000);

  test('--fix rewrites the zoom declarations to the optimal values in one pass', async () => {
    const copy = fixture(`zoom-fixed-${randomUUID()}.md`);
    fs.copyFileSync(fixture('zoom.md'), copy);
    try {
      const { stdout } = await runCli(copy, '--fix');
      expect(stripVTControlCharacters(stdout)).toMatch(/Fixed 1[67] problems\./);
      const lines = fs.readFileSync(copy, 'utf8').split('\n');
      expect(lines[12]).toBe('<div style="zoom: 1">');
      expect(lines[24]).toMatch(/^<div style="zoom: 0\.(?:79|8|81)">$/);
      expect(lines[46]).toBe('<div style="zoom: 100%">');
      expect(lines[88]).toBe('<div style="zoom: 1">left</div><div style="zoom: 1">right</div>');
      expect(lines[146]).toBe('<div style="zoom : 1; color: gray">');
      expect(lines[156]).toBe(String.raw`<div style="font-family: 'a\'b;c'; --zoom: 0.5; /* ' ; */ zoom: 1">`);
      expect(lines[168]).toBe('<div data-style="zoom: 0.5" style="zoom: 1">');
      const { violations } = await runCliJson(copy);
      expect(zoomViolations(violations).map((v) => v.slide.no)).toEqual([4, 7, 18, 21, 22, 23, 24]);
      // The rewritten wrappers keep their content on the slide.
      expect(
        violations.filter((v) => v.ruleId === 'no-overflow' && ![7, 18, 21, 22, 23, 24].includes(v.slide.no))
      ).toEqual([]);
    } finally {
      fs.rmSync(copy, { force: true });
    }
  }, 180_000);
});

describe('--fix --json', () => {
  test('reports the number of fixes together with the remaining violations', async () => {
    const copy = fixture(`zoom-fixed-json-${randomUUID()}.md`);
    fs.copyFileSync(fixture('zoom.md'), copy);
    try {
      const { stdout } = await runCli(copy, '--fix', '--json');
      const result = JSON.parse(stdout) as { fixed: number; violations: Violation[] };
      expect(result.fixed).toBeGreaterThanOrEqual(16);
      expect(zoomViolations(result.violations).map((v) => v.slide.no)).toEqual([4, 7, 18, 21, 22, 23, 24]);
    } finally {
      fs.rmSync(copy, { force: true });
    }
  }, 180_000);
});

describe('applyFixes', () => {
  test('applies fixes by position, so several on one line do not disturb each other', () => {
    const file = fixture(`fixes-${randomUUID()}.tmp.md`);
    fs.writeFileSync(file, 'a\n<div style="zoom: 0.5">x</div><div style="zoom: 0.5">y</div>\nzoom: 0.5\n');
    try {
      const slide = { no: 1, filepath: file, line: 1, title: undefined };
      const violation = (fix: Fix): Violation => ({
        ruleId: 'optimal-zoom',
        severity: 'warn',
        slide,
        message: '',
        help: '',
        fix,
      });
      const applied = applyFixes([
        violation({ line: 2, column: 12, from: 'zoom: 0.5', to: 'zoom: 0.55' }),
        violation({ line: 2, column: 12, from: 'zoom: 0.5', to: 'zoom: 0.55' }), // the same slide imported twice
        violation({ line: 2, column: 42, from: 'zoom: 0.5', to: 'zoom: 0.9' }),
        violation({ line: 3, column: 3, from: 'zoom: 0.5', to: 'zoom: 1' }), // stale: the text moved
      ]);
      expect(applied).toBe(2);
      expect(fs.readFileSync(file, 'utf8')).toBe(
        'a\n<div style="zoom: 0.55">x</div><div style="zoom: 0.9">y</div>\nzoom: 0.5\n'
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
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
