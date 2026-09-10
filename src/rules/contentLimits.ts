import type { Rule, RuleFinding } from '../types.ts';

type Metric = 'characters' | 'lines' | 'listDepth' | 'tableRows';

export const maxBodyCharacters = contentLimit('max-body-characters', 'characters', 200, 'Body text', 'characters');
export const maxBodyLines = contentLimit('max-body-lines', 'lines', 10, 'Body text', 'lines');
export const maxListDepth = contentLimit('max-list-depth', 'listDepth', 2, 'List', 'levels');
export const maxTableRows = contentLimit('max-table-rows', 'tableRows', 7, 'Table', 'rows');

function contentLimit(id: string, metric: Metric, max: number, subject: string, unit: string): Rule {
  return {
    id,
    description: `${subject} should not exceed ${max} ${unit} ${metric === 'tableRows' ? 'per table' : 'per slide'}.`,
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
    let previousBlock: Element | undefined;
    const blocks = new Map<Element, { rect: DOMRect; column: string }[]>();
    const walker = document.createTreeWalker(layout, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !isChecked(element) || element.closest('h1, h2, h3, h4, h5, h6, script, style')) continue;
      const content = node.textContent ?? '';
      if (!content.trim()) {
        text.push(content);
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) continue;
      // Inline markup shares a line with its block; separate columns have separate blocks.
      let block = element;
      while (block !== layout && getComputedStyle(block).display.startsWith('inline') && block.parentElement) {
        block = block.parentElement;
      }
      if (metric === 'characters') {
        if (previousBlock !== block) text.push('\n');
        text.push(content);
        previousBlock = block;
        continue;
      }
      block = block.closest('tr') ?? block;
      const rows = blocks.get(block) ?? [];
      for (const rect of rects) {
        const column = columnOf(element, rect);
        if (
          !rows.some(
            (row) =>
              row.column === column &&
              Math.min(row.rect.bottom, rect.bottom) - Math.max(row.rect.top, rect.top) >
                Math.min(row.rect.height, rect.height) / 2
          )
        )
          rows.push({ rect, column });
      }
      blocks.set(block, rows);
    }
    if (metric === 'characters') {
      // Count user-perceived characters, including emoji and combining sequences, without whitespace.
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      count = [...segmenter.segment(text.join(''))].filter(({ segment }) => segment.trim()).length;
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

  function columnOf(element: Element, rect: DOMRect): string {
    const columns: number[] = [];
    for (let parent: Element | null = element; parent && layout?.contains(parent); parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.columnSpan === 'all') break;
      if (!(parent instanceof HTMLElement) || (style.columnCount === 'auto' && style.columnWidth === 'auto')) continue;
      const bounds = parent.getBoundingClientRect();
      const scale = bounds.width / parent.offsetWidth;
      const padding = Number.parseFloat(style.paddingLeft);
      const width = parent.clientWidth - padding - Number.parseFloat(style.paddingRight);
      const gap =
        style.columnGap === 'normal'
          ? Number.parseFloat(style.fontSize)
          : Number.parseFloat(style.columnGap) * (style.columnGap.endsWith('%') ? width / 100 : 1);
      const requestedCount = Number.parseInt(style.columnCount, 10);
      const columnWidth = Number.parseFloat(style.columnWidth);
      const fittingCount = Number.isNaN(columnWidth)
        ? Infinity
        : Math.max(1, Math.floor((width + gap) / (columnWidth + gap)));
      const count = Math.min(Number.isNaN(requestedCount) ? Infinity : requestedCount, fittingCount);
      const stride = (width + gap) / count;
      const offset = (rect.left - bounds.left) / scale - parent.clientLeft - padding;
      columns.push(Math.floor((offset + 0.5) / stride));
    }
    return columns.join('/');
  }
}
