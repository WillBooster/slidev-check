import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { check } from '../../src/check.ts';
import { applyFixes } from '../../src/fix.ts';
import { perSlide } from '../../src/perSlide.ts';
import type { Fix, Rule, Violation } from '../../src/types.ts';

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

  test('warns on rendered content limits without counting hidden text, ruby annotations, or inline markup twice', async () => {
    const { exitCode, violations } = await runCliJson(fixture('contentLimits.md'));
    expect(exitCode).toBe(0);
    const content = violations.filter((v) =>
      ['max-body-characters', 'max-list-depth', 'max-table-rows'].includes(v.ruleId)
    );
    expect(content.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['max-body-characters', 'warn', 2],
      ['max-list-depth', 'warn', 4],
      ['max-table-rows', 'warn', 6],
      ['max-body-characters', 'warn', 7],
      ['max-table-rows', 'warn', 8],
      ['max-table-rows', 'warn', 9],
      ['max-body-characters', 'warn', 11],
      ['max-list-depth', 'warn', 12],
      ['max-body-characters', 'warn', 14],
      ['max-list-depth', 'warn', 15],
      ['max-table-rows', 'warn', 16],
      ['max-table-rows', 'warn', 16],
      ['max-body-characters', 'warn', 21],
      ['max-body-characters', 'warn', 22],
      ['max-body-characters', 'warn', 27],
      ['max-list-depth', 'warn', 29],
      ['max-body-characters', 'warn', 31],
      ['max-body-characters', 'warn', 32],
      ['max-table-rows', 'warn', 33],
      ['max-table-rows', 'warn', 35],
      ['max-body-characters', 'warn', 37],
    ]);
    expect(
      content.filter((v) => v.ruleId === 'max-body-characters').every((v) => v.message.includes('351 characters'))
    ).toBe(true);
    expect(content.filter((v) => v.ruleId === 'max-list-depth').every((v) => v.message.includes('3 levels'))).toBe(
      true
    );
    expect(content.filter((v) => v.ruleId === 'max-table-rows').map((v) => v.message)).toEqual([
      expect.stringContaining('has 9 rows'),
      expect.stringContaining('has 9 rows'),
      expect.stringContaining('has 9 rows'),
      expect.stringContaining('First'),
      expect.stringContaining('Second'),
      expect.stringContaining('has 9 rows'),
      expect.stringContaining('has 9 rows'),
    ]);
    expect(content.filter((v) => v.ruleId === 'max-table-rows' && v.slide.no === 16).map((v) => v.message)).toEqual([
      expect.stringContaining('has 9 rows'),
      expect.stringContaining('has 10 rows'),
    ]);
  }, 90_000);

  test('exits with 1 only when the warnings exceed --max-warnings', async () => {
    const { violations } = await runCliJson(fixture('contentLimits.md'));
    const warnings = violations.filter((v) => v.severity === 'warn').length;
    const atLimit = await runCli(fixture('contentLimits.md'), '--max-warnings', String(warnings));
    const overLimit = await runCli(fixture('contentLimits.md'), '--max-warnings', String(warnings - 1));
    expect([violations.length, atLimit.exitCode, overLimit.exitCode]).toEqual([warnings, 0, 1]);
  }, 90_000);

  test('takes the body character limit from the headmatter and does not count code by default', async () => {
    const { violations } = await runCliJson(fixture('bodyCharacterSettings.md'));
    const content = violations.filter((v) => v.ruleId === 'max-body-characters');
    expect(content.map((v) => [v.slide.no, v.message])).toEqual([
      [2, expect.stringContaining('has 401 characters, exceeding the maximum of 400')],
      [5, expect.stringContaining('has 404 characters, exceeding the maximum of 400')],
    ]);
  }, 90_000);

  test('counts code at the codeWeight set in the headmatter', async () => {
    const { violations } = await runCliJson(fixture('codeWeight.md'));
    const content = violations.filter((v) => v.ruleId === 'max-body-characters');
    expect(content.map((v) => [v.slide.no, v.message])).toEqual([
      [2, expect.stringContaining('has 101 characters, exceeding the maximum of 100')],
    ]);
  }, 90_000);

  test('does not report a weighted count equal to the limit despite floating-point error', async () => {
    const { violations } = await runCliJson(fixture('fractionalCodeWeight.md'));
    const content = violations.filter((v) => v.ruleId === 'max-body-characters');
    expect(content.map((v) => [v.slide.no, v.message])).toEqual([
      [2, expect.stringContaining('has 3.1 characters, exceeding the maximum of 3')],
    ]);
  }, 90_000);

  test('counts direct SVG text while excluding SVG resource definitions', async () => {
    const { violations } = await runCliJson(fixture('svgText.md'));
    const content = violations.filter((v) => v.ruleId === 'max-body-characters');
    expect(content.map((v) => [v.severity, v.slide.no])).toEqual([['warn', 3]]);
    expect(content[0]?.message).toContain('351 characters');
  }, 90_000);

  test('reports elements that overflow the slide', async () => {
    const { exitCode, violations } = await runCliJson(fixture('overflow.md'));
    expect(exitCode).toBe(1);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['no-overflow', 'error', 2],
      ['optimal-zoom', 'warn', 2],
      ['max-body-characters', 'warn', 2],
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

  test('warns on slide headings wrapping beyond the allowed lines only in the title bar', async () => {
    const { exitCode, violations } = await runCliJson(fixture('heading.md'));
    expect(exitCode).toBe(0); // warnings do not fail the check
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['max-heading-lines', 'warn', 3],
      ['max-heading-lines', 'warn', 8],
      ['max-heading-lines', 'warn', 9],
      ['max-heading-lines', 'warn', 10],
      ['max-heading-lines', 'warn', 12],
      ['max-heading-lines', 'warn', 13],
      ['max-heading-lines', 'warn', 15],
      ['max-heading-lines', 'warn', 17],
    ]);
    expect(violations[0]?.message).toMatch(/spans 2 lines, exceeding the maximum of 1/);
    expect(violations[0]?.help).toBe('Consider shortening the heading.');
  }, 90_000);

  test('warns on text below the minimum font size, reporting only the outermost element', async () => {
    const { exitCode, violations } = await runCliJson(fixture('font-size.md'));
    expect(exitCode).toBe(0);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no])).toEqual([
      ['min-font-size', 'warn', 2],
      ['min-font-size', 'warn', 3],
    ]);
    expect(violations[0]?.message).toMatch(/has a font size of 12px, smaller than the minimum of 14px/);
    expect(violations[1]?.message).toMatch(/^Element `<ruby\.text-xs>漢字/);
    expect(violations[0]?.help).toBe('Consider increasing the font size.');
  }, 90_000);

  test('warns on headings and text scaled below the theme default, once per shrunk region', async () => {
    const { exitCode, violations } = await runCliJson(fixture('fontScale.md'));
    expect(exitCode).toBe(0);
    const scales = violations.filter((v) => ['min-heading-scale', 'min-font-scale'].includes(v.ruleId));
    expect(scales.map((v) => [v.ruleId, v.severity, v.slide.no, v.message.match(/[\d.]+×/)?.[0]])).toEqual([
      ['min-heading-scale', 'warn', 3, '0.73×'],
      ['min-font-scale', 'warn', 4, '0.50×'],
      ['min-heading-scale', 'warn', 5, '0.50×'],
      ['min-font-scale', 'warn', 5, '0.50×'],
      ['min-font-scale', 'warn', 6, '0.50×'],
      ['min-heading-scale', 'warn', 7, '0.80×'],
    ]);
    expect(scales[1]?.message).toContain('`<div>First item');
    expect(scales[3]?.message).toMatch(/^The slide /);
  }, 90_000);

  test('warns on single-item lists, including nested ones, but not in table cells or parts of a split numbered list', async () => {
    const { exitCode, violations } = await runCliJson(fixture('listItems.md'));
    expect(exitCode).toBe(0);
    expect(violations.map((v) => [v.ruleId, v.severity, v.slide.no, v.message])).toEqual([
      ['min-list-items', 'warn', 1, 'List `<ul>Only child` has 1 item, fewer than the minimum of 2.'],
      ['min-list-items', 'warn', 2, 'List `<ul>Only item` has 1 item, fewer than the minimum of 2.'],
      ['min-list-items', 'warn', 3, 'List `<ol>Only step` has 1 item, fewer than the minimum of 2.'],
    ]);
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
    // Positioned content inside the wrapper scales with it, bounds the space from below, and must stay on the slide.
    expect(positioned?.message).toMatch(/keeps a margin of 1 line above `<div>Tall box` at zoom: 0\.\d+\.$/);
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

  test('measures the flow content against an element pinned to the slide bottom instead of counting it as content', async () => {
    const { violations } = await runCliJson(fixture('pinnedZoom.md'));
    // Slides 5 and 8 anchor their badges to boxes inside the body, so the badges are content; the size query
    // containers of slide 6 and the boxless wrapper of slide 7 anchor nothing, so their notes stay pinned to the
    // slide. All of them stay silent.
    expect(zoomViolations(violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        3,
        expect.stringMatching(
          /^The slide content overlaps `<div>Pinned note`; wrapping it in `<div style="zoom: 0\.\d+">`/
        ),
      ],
      [
        4,
        expect.stringMatching(
          /^Element `<div>onetwoPinned[^`]*` is zoomed to 0\.5 but still keeps a margin of 1 line above `<div>Pinned note` at zoom: 1\.$/
        ),
      ],
      // The note is positioned only while the zoom keeps its container wide, so zoom 1 measures it as flow.
      [9, expect.stringMatching(/still keeps a margin of 1 line above the slide bottom at zoom: 1\.$/)],
      // A `display: contents` wrapper generates no box, so its positioning leaves its children in the flow.
      [
        10,
        expect.stringMatching(
          /^Element `<div>Line 1[^`]*` is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.9\d\.$/
        ),
      ],
      [
        11,
        expect.stringMatching(
          /^Element `<div>Line 1[^`]*` is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.9\d\.$/
        ),
      ],
      // A note with a zoom of its own stays pinned to the slide.
      [12, expect.stringMatching(/still keeps a margin of 1 line above `<div\.zoomed-note>Pinned note` at zoom: 1\.$/)],
      // Measuring keeps the wrapper's important margin in effect: zoom 0.9 or more would overflow.
      [
        13,
        expect.stringMatching(
          /is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.8\d\.$/
        ),
      ],
      // An important stylesheet margin does not keep the measurement from telling the pinned note apart.
      [14, expect.stringMatching(/still keeps a margin of 1 line above `<div>Pinned note` at zoom: 1\.$/)],
      // Measuring keeps the order of the wrapper's inline margins, so the later logical margin still wins.
      [
        15,
        expect.stringMatching(
          /is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.8\d\.$/
        ),
      ],
      // A footer aligned to the bottom of a flexible card or below text beside a float is content.
      ...[16, 17, 18].map((no) => [
        no,
        expect.stringMatching(
          /is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.\d+\.$/
        ),
      ]),
      // Classifying the badge does not change which structural selectors position its card; an SVG badge is content.
      ...[19, 20, 21, 22].map((no) => [
        no,
        expect.stringMatching(
          /is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 1\.$/
        ),
      ]),
    ]);
  }, 90_000);

  test("suggests the largest frontmatter zoom that keeps the margin, whether the slide's zoom is too small or too large", async () => {
    const { violations } = await runCliJson(fixture('frontmatterZoom.md'));
    expect(zoomViolations(violations).map((v) => [v.slide.no, v.message, v.help])).toEqual([
      [
        2,
        'The slide content with the frontmatter `zoom: 0.7` still keeps a margin of 1 line above the slide bottom at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      [
        3,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.9` overflows the slide bottom; `zoom: 0\.(\d+)` keeps the margin above the slide bottom\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.\d+` in the slide's frontmatter\.$/),
      ],
      [
        4,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.\d+`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.\d+` in the slide's frontmatter\.$/),
      ],
      // Slide 5 holds an ignored element the zoom would also scale, so it gets no suggestion. Slide 6
      // is measured on its own layout, so its direct-child selector still applies (zoom 1 would overflow).
      [
        6,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.[5-9]\d?`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.\d+` in the slide's frontmatter\.$/),
      ],
      // Slidev sets no page property for `zoom: 1`, but the frontmatter value is still the one to change.
      [
        7,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 1` overflows the slide bottom; `zoom: 0\.\d+` keeps the margin above the slide bottom\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.\d+` in the slide's frontmatter\.$/),
      ],
      // A slide holding an ignored element, which the zoom would also scale, keeps the analysis of a slide without a zoom.
      [
        8,
        expect.stringMatching(
          /^The slide content overflows the slide bottom; wrapping it in `<div style="zoom: 0\.\d+">` keeps the margin\.$/
        ),
        expect.stringMatching(/^Consider wrapping the content below the heading in `<div style="zoom: 0\.\d+">`\.$/),
      ],
      // The frontmatter zoom scales the heading too, so it must stay on the slide.
      [
        9,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` sticks out of the slide; `zoom: 0\.\d+` keeps the margin above the slide bottom\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.\d+` in the slide's frontmatter\.$/),
      ],
      // A layout whose headings sit in its columns is measured as a whole.
      [
        10,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above the slide bottom at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // Content the layout keeps at its bottom edge (a bottom slot, a footer pushed down) bounds the space.
      [
        11,
        'The slide content with the frontmatter `zoom: 0.7` still keeps a margin of 1 line above `<p>A footnote at th…` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      [
        12,
        'The slide content with the frontmatter `zoom: 0.7` still keeps a margin of 1 line above `<div.footer>Footer` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // The smallest zoom is still compared with a different one to find content anchored to the bottom.
      [
        14,
        'The slide content with the frontmatter `zoom: 0.1` does not fit on the slide with a margin of 1 line above the slide bottom at any zoom down to 0.1.',
        'Consider splitting the content into multiple slides.',
      ],
      // Content that is all anchored to the bottom still gets a value that keeps it on the slide.
      [
        15,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above the slide bottom at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // A footer anchored to the bottom only in a wide container is flow at the larger zooms that narrow it.
      [
        16,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.9\d`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.9\d` in the slide's frontmatter\.$/),
      ],
      // Content that is all positioned is measured by its bounds. Slides 13 (`zoom: 70%`, which Slidev scales
      // without widening the page) and 18 (whose box covers the slide and so counts as a decoration) get no report, as before.
      [
        17,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above the slide bottom at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // A breakpoint between the current and the best zoom that does not fit does not hide the best one.
      [
        19,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.9\d`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.9\d` in the slide's frontmatter\.$/),
      ],
      // Nor does a breakpoint that makes the smallest zoom fail.
      [
        20,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.9\d`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.9\d` in the slide's frontmatter\.$/),
      ],
      // A painted card around a footer kept at its bottom does not count against the margin above the footer.
      [
        21,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above `<div.footer>Footer` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // Text directly inside such a card moves with the zoom, so the card is not anchored with its footer.
      [
        22,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above `<div\.footer>Footer` at `zoom: 0\.9\d`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.9\d` in the slide's frontmatter\.$/),
      ],
      // Hidden text inside a footer kept at the bottom does not keep the footer from bounding the space.
      [
        23,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above `<div.footer>FooterHidden hov…` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // A footer whose background appears only in a narrow layout stays anchored to the bottom.
      [
        24,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above `<div.footer>Footer` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
      // A box that is content at the current zoom stays content at the candidates that enlarge it.
      [
        25,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.[5-6]\d`\.$/
        ),
        expect.stringMatching(/^Consider setting `zoom: 0\.[5-6]\d` in the slide's frontmatter\.$/),
      ],
      // A badge inside the footer but positioned against the layout does not keep the footer from being anchored.
      [
        26,
        'The slide content with the frontmatter `zoom: 0.5` still keeps a margin of 1 line above `<span>Visible badge` at `zoom: 1`.',
        "Consider setting `zoom: 1` in the slide's frontmatter.",
      ],
    ]);
    // A zoom set for every slide through the headmatter's `defaults` is the slide's zoom too, even 1.
    const defaultsOne = await runCliJson(fixture('frontmatterZoomDefaultsOne.md'));
    expect(zoomViolations(defaultsOne.violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        2,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 1` sticks out of the slide; `zoom: 0\.\d+` keeps the margin above the slide bottom\.$/
        ),
      ],
    ]);
    const defaults = await runCliJson(fixture('frontmatterZoomDefaults.md'));
    expect(zoomViolations(defaults.violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        2,
        'The slide content with the frontmatter `zoom: 0.7` still keeps a margin of 1 line above the slide bottom at `zoom: 1`.',
      ],
    ]);
  }, 90_000);

  test('keeps the layers beside the layout on the slide when suggesting a frontmatter zoom', async () => {
    const { violations } = await runCliJson(fixture('slideLayer/slides.md'));
    // The 1200px banner of slide-top.vue also scales with the frontmatter zoom: zoom 1 would push it off the slide.
    expect(zoomViolations(violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        2,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above the slide bottom at `zoom: 0\.[5-8]\d?`\.$/
        ),
      ],
      // A slide whose only painted content is the banner gets the value that keeps the banner on the slide.
      [
        3,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 1` sticks out of the slide; `zoom: 0\.[5-8]\d?` keeps the margin above the slide bottom\.$/
        ),
      ],
    ]);
    // The same banner excluded with data-slidev-check-ignore is not measured, so no larger value is suggested.
    const ignored = await runCliJson(fixture('slideLayerIgnored/slides.md'));
    expect(zoomViolations(ignored.violations)).toEqual([]);
  }, 90_000);

  test('measures a wrapper holding a positioned badge by its own box and text, and a footer a theme keeps unscaled as a bound', async () => {
    const wrapper = await runCliJson(fixture('wrapperBadge.md'));
    expect(zoomViolations(wrapper.violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        2,
        expect.stringMatching(
          /^Element `<div>Line 1 of direct…` is zoomed to 0\.5 but still keeps a margin of 1 line above the slide bottom at zoom: 0\.[78]\d\.$/
        ),
      ],
    ]);
    const unscaled = await runCliJson(fixture('unscaledFooter/slides.md'));
    expect(zoomViolations(unscaled.violations).map((v) => [v.slide.no, v.message])).toEqual([
      [
        2,
        expect.stringMatching(
          /^The slide content with the frontmatter `zoom: 0\.5` still keeps a margin of 1 line above `<div\.footer>A footer the the…` at `zoom: (1|0\.\d+)`\.$/
        ),
      ],
    ]);
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

const themeViolations = (violations: Violation[]): [string, string, number, string][] =>
  violations.filter((v) => v.ruleId.startsWith('fixture-')).map((v) => [v.ruleId, v.severity, v.slide.no, v.message]);

describe('theme rules', () => {
  test("runs the rules exported by the theme's package, which skip ignored elements", async () => {
    const { exitCode, violations } = await runCliJson(fixture('themeRules/slides.md'));
    expect(exitCode).toBe(1);
    expect(themeViolations(violations)).toEqual([
      ['fixture-no-marker', 'warn', 2, 'The slide contains `TODO`.'],
      ['fixture-unique-titles', 'error', 3, 'The heading `Plan` repeats.'],
      ['fixture-no-marker', 'warn', 4, 'The slide contains `TODO`.'],
    ]);
  }, 90_000);

  test('drops the findings of the rules a slide ignores, and only those', async () => {
    const { violations } = await runCliJson(fixture('themeRules/ignores.md'));
    expect(themeViolations(violations)).toEqual([
      ['fixture-unique-titles', 'error', 3, 'The heading `Quoted marker` repeats.'],
      ['fixture-no-marker', 'warn', 4, 'The slide contains `TODO`.'],
    ]);
  }, 90_000);

  test('applies setting overrides, keeping or merging default options, and runs additional rules', async () => {
    const extra: Rule = {
      id: 'extra',
      description: '',
      defaultSetting: ['warn', { kept: 1, replaced: 1 }],
      check: perSlide(async ({ options }) => [{ message: JSON.stringify(options), help: '' }]),
    };
    const violations = await check({
      entry: fixture('themeRules/slides.md'),
      ...options,
      rules: [extra],
      settings: {
        extra: ['error', { replaced: 2 }],
        'fixture-no-marker': 'error',
        'fixture-unique-titles': 'off',
      },
    });
    expect(themeViolations(violations)).toEqual([
      ['fixture-no-marker', 'error', 2, 'The slide contains `TODO`.'],
      ['fixture-no-marker', 'error', 4, 'The slide contains `TODO`.'],
    ]);
    expect(violations.filter((v) => v.ruleId === 'extra').map((v) => [v.severity, v.slide.no, v.message])).toEqual(
      [1, 2, 3, 4].map((no) => ['error', no, '{"kept":1,"replaced":2}'])
    );
  }, 90_000);
});

describe('check API', () => {
  test('fails before rendering on a duplicate rule id or a setting of an unknown rule', async () => {
    const duplicate: Rule = { id: 'no-overflow', description: '', defaultSetting: 'error', check: async () => [] };
    const entry = fixture('clean.md');
    await expect(check({ entry, ...options, rules: [duplicate] })).rejects.toThrow(
      'More than one rule has the id "no-overflow".'
    );
    await expect(check({ entry, ...options, settings: { unknown: 'warn' } })).rejects.toThrow(
      'No rule has the id "unknown"'
    );
  }, 90_000);

  test('fails before rendering when a slide ignores a rule that is not suppressible or gives no reason', async () => {
    await expect(check({ entry: fixture('themeRules/ignoreUnsuppressible.md'), ...options })).rejects.toThrow(
      'Slide 2 cannot ignore "fixture-unique-titles", which is not suppressible'
    );
    await expect(check({ entry: fixture('themeRules/ignoreWithoutReason.md'), ...options })).rejects.toThrow(
      'slidevCheckIgnore of slide 2 must map rule ids to the reasons'
    );
  }, 90_000);
});
