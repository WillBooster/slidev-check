import type { Rule, RuleFinding } from '../types.ts';

type Metric = 'characters' | 'lines' | 'listDepth' | 'tableRows';

export const maxBodyCharacters = contentLimit('max-body-characters', 'characters', 200, 'Body text', 'characters');
export const maxBodyLines = contentLimit('max-body-lines', 'lines', 10, 'Body text', 'lines');
export const maxListDepth = contentLimit('max-list-depth', 'listDepth', 2, 'List', 'levels');
export const maxTableRows = contentLimit('max-table-rows', 'tableRows', 7, 'Table', 'rows');

function contentLimit(id: string, metric: Metric, max: number, subject: string, unit: string): Rule {
  return {
    id,
    description: `${subject} should not exceed ${max} ${unit} per slide.`,
    check: ({ page, containerSelector, options }) =>
      page.evaluate(findContentLimit, {
        containerSelector,
        metric,
        max: Number(options?.['max'] ?? max),
        subject,
        unit,
      }),
  };
}

function findContentLimit({
  containerSelector,
  metric,
  max,
  subject,
  unit,
}: {
  containerSelector: string;
  metric: Metric;
  max: number;
  subject: string;
  unit: string;
}): RuleFinding[] {
  const { isChecked } = globalThis.__slidevCheck;
  const layout = document.querySelector(`${containerSelector} .slidev-layout`);
  if (!layout) return [];

  let count = 0;
  if (metric === 'listDepth') {
    for (const item of layout.querySelectorAll('li')) {
      if (!isChecked(item)) continue;
      let depth = 0;
      for (let parent = item.parentElement; parent && layout.contains(parent); parent = parent.parentElement) {
        if (parent.matches('ul, ol')) depth++;
      }
      count = Math.max(count, depth);
    }
  } else if (metric === 'tableRows') {
    for (const table of layout.querySelectorAll('table')) {
      if (!isChecked(table)) continue;
      const rows = [...table.querySelectorAll('tr')].filter((row) => row.closest('table') === table && isChecked(row));
      count = Math.max(count, rows.length);
    }
  } else {
    const text: string[] = [];
    const blocks = new Map<Element, DOMRect[]>();
    const walker = document.createTreeWalker(layout, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !isChecked(element) || element.closest('h1, h2, h3, h4, h5, h6, script, style')) continue;
      const content = node.textContent ?? '';
      if (!content.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) continue;
      text.push(content);
      if (metric !== 'lines') continue;
      // Inline markup shares a line with its block; separate columns have separate blocks.
      let block = element;
      while (block !== layout && getComputedStyle(block).display.startsWith('inline') && block.parentElement) {
        block = block.parentElement;
      }
      block = block.closest('tr') ?? block;
      const rows = blocks.get(block) ?? [];
      for (const rect of rects) {
        if (!rows.some((row) => Math.abs(row.top - rect.top) < Math.min(row.height, rect.height) / 2)) rows.push(rect);
      }
      blocks.set(block, rows);
    }
    if (metric === 'characters') {
      // Count user-perceived characters, including emoji and combining sequences, without whitespace.
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      count = [...segmenter.segment(text.join('').replaceAll(/\s+/gu, ''))].length;
    } else {
      for (const rows of blocks.values()) count += rows.length;
    }
  }
  return count > max
    ? [
        {
          message: `${subject} has ${count} ${unit}, exceeding the maximum of ${max}.`,
          help: 'Consider shortening or splitting the content into multiple slides.',
        },
      ]
    : [];
}
