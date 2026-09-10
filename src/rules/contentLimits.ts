import type { Rule, RuleFinding } from '../types.ts';

type Metric = 'characters' | 'lines' | 'listDepth' | 'tableRows';
interface TextLine {
  rect: DOMRect;
  column: string;
  vertical: boolean;
}

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

/* oxlint-disable unicorn/consistent-function-scoping -- Helpers must remain inside the serialized page.evaluate callback. */
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
  const { isChecked, measureText } = globalThis.__slidevCheck;
  const layout = document.querySelector(`${containerSelector} .slidev-layout`);
  if (!layout) return [];

  let count = 0;
  if (metric === 'listDepth') {
    for (const item of layout.querySelectorAll('li')) {
      if (!hasVisibleContent(item)) continue;
      let depth = 0;
      for (let parent = item.parentElement; parent && layout.contains(parent); parent = parent.parentElement) {
        if (parent.matches('ul, ol')) depth++;
      }
      count = Math.max(count, depth);
    }
  } else if (metric === 'tableRows') {
    for (const table of layout.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')].filter(
        (row) => row.closest('table') === table && hasVisibleContent(row)
      );
      count = Math.max(count, rows.length);
    }
  } else {
    const text: string[] = [];
    let previousBlock: Element | undefined;
    const blocks = new Map<Element, TextLine[]>();
    const walker = document.createTreeWalker(layout, NodeFilter.SHOW_ALL);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element) {
        if (
          metric === 'characters' &&
          isChecked(node) &&
          (node.matches('br, hr, img, svg, canvas, iframe, video, audio, object, embed, input, select, textarea') ||
            !['inline', 'contents', 'ruby', 'ruby-text'].includes(getComputedStyle(node).display))
        )
          text.push('\n');
        continue;
      }
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const element = node.parentElement;
      if (!element || !isTextChecked(element) || element.closest('h1, h2, h3, h4, h5, h6, script, style')) continue;
      const content = node.textContent ?? '';
      if (!content.trim()) {
        text.push(content);
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const ruby = element.closest('ruby');
      const katex = element.closest('.katex');
      const lineBox = metric === 'lines' ? (ruby ?? (katex ? stackedMathBox(element, katex) : undefined)) : undefined;
      const rects = [...(lineBox ?? range).getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) continue;
      const style = getComputedStyle(element);
      // KaTeX uses internal blocks to position scripts; those are not separate body lines.
      let block = katex ?? ruby ?? element;
      while (
        block !== layout &&
        ['inline', 'ruby', 'contents'].includes(getComputedStyle(block).display) &&
        block.parentElement
      ) {
        block = block.parentElement;
      }
      if (metric === 'characters') {
        if (previousBlock !== block) text.push('\n');
        text.push(content);
        previousBlock = block;
        continue;
      }
      const leading = Math.max(
        Number.parseFloat(style.lineHeight),
        Number.parseFloat(getComputedStyle(block).lineHeight)
      );
      if (!katex && !ruby && leading < Number.parseFloat(style.fontSize)) {
        return [
          {
            message: `Body line count cannot be determined reliably: text has effective line-height ${leading}px below font size ${style.fontSize}.`,
            help: 'Consider increasing line-height to at least the font size, then checking again.',
          },
        ];
      }
      block = block.closest('tr') ?? block;
      const rows = blocks.get(block) ?? [];
      for (const rect of rects) {
        const line = {
          rect,
          column: columnOf(element, rect),
          vertical: style.writingMode !== 'horizontal-tb',
        };
        if (!rows.some((row) => sameLine(row, line))) rows.push(line);
      }
      blocks.set(block, rows);
    }
    if (metric === 'characters') {
      // Count user-perceived characters, including emoji and combining sequences, without whitespace.
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      count = [...segmenter.segment(text.join(''))].filter(({ segment }) => segment.trim()).length;
    } else {
      const entries = [...blocks];
      for (const [block, rows] of entries) {
        for (const row of rows) {
          // A badge shares its surrounding prose line; independent cards have no such parent text.
          if (
            !entries.some(
              ([parent, parentRows]) =>
                parent !== block && parent.contains(block) && parentRows.some((parentRow) => sameLine(parentRow, row))
            )
          )
            count++;
        }
      }
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

  function stackedMathBox(element: Element, katex: Element): Element | undefined {
    let stack: Element | undefined;
    for (let parent: Element | null = element; parent && parent !== katex; parent = parent.parentElement) {
      // Matrix/aligned columns contain genuine equation rows; fractions and limits inside each row are atomic.
      if (parent.matches('.mtable')) break;
      if (
        parent.matches('.vlist-t') &&
        ![...(parent.parentElement?.classList ?? [])].some((name) => name.startsWith('col-align-'))
      )
        stack = parent;
    }
    return stack;
  }

  function sameLine(a: TextLine, b: TextLine): boolean {
    const start = a.vertical ? 'left' : 'top';
    const end = a.vertical ? 'right' : 'bottom';
    const size = a.vertical ? 'width' : 'height';
    return (
      a.vertical === b.vertical &&
      a.column === b.column &&
      Math.min(a.rect[end], b.rect[end]) - Math.max(a.rect[start], b.rect[start]) >
        Math.min(a.rect[size], b.rect[size]) / 2
    );
  }

  function hasVisibleContent(element: Element): boolean {
    return [element, ...element.querySelectorAll('*')].some(
      (candidate) => isChecked(candidate) || (isTextChecked(candidate) && measureText(candidate) !== undefined)
    );
  }

  function isTextChecked(element: Element): boolean {
    const style = getComputedStyle(element);
    if (style.display !== 'contents') return isChecked(element);
    if (
      !(element instanceof HTMLElement || element instanceof SVGElement) ||
      element.closest('[data-slidev-check-ignore]') ||
      style.visibility !== 'visible'
    )
      return false;
    let box = element.parentElement;
    while (box && getComputedStyle(box).display === 'contents') box = box.parentElement;
    // Boxless elements have no visibility-testable box, but their direct text can still render.
    return box?.checkVisibility({ opacityProperty: true, contentVisibilityAuto: true }) ?? false;
  }

  function columnOf(element: Element, rect: DOMRect): string {
    const columns: number[] = [];
    for (let parent: Element | null = element; parent && layout?.contains(parent); parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.columnSpan === 'all') break;
      if (!(parent instanceof HTMLElement) || (style.columnCount === 'auto' && style.columnWidth === 'auto')) continue;
      const bounds = parent.getBoundingClientRect();
      const vertical = style.writingMode !== 'horizontal-tb';
      const scale = vertical ? bounds.height / parent.offsetHeight : bounds.width / parent.offsetWidth;
      const padding = Number.parseFloat(vertical ? style.paddingTop : style.paddingLeft);
      const extent =
        (vertical ? parent.clientHeight : parent.clientWidth) -
        padding -
        Number.parseFloat(vertical ? style.paddingBottom : style.paddingRight);
      const gap =
        style.columnGap === 'normal'
          ? Number.parseFloat(style.fontSize)
          : Number.parseFloat(style.columnGap) * (style.columnGap.endsWith('%') ? extent / 100 : 1);
      const requestedCount = Number.parseInt(style.columnCount, 10);
      const columnWidth = Number.parseFloat(style.columnWidth);
      const fittingCount = Number.isNaN(columnWidth)
        ? Infinity
        : Math.max(1, Math.floor((extent + gap) / (columnWidth + gap)));
      const count = Math.min(Number.isNaN(requestedCount) ? Infinity : requestedCount, fittingCount);
      const stride = (extent + gap) / count;
      const offset =
        (vertical ? rect.top - bounds.top : rect.left - bounds.left) / scale -
        (vertical ? parent.clientTop : parent.clientLeft) -
        padding;
      columns.push(Math.floor((offset + 0.5) / stride));
    }
    return columns.join('/');
  }
}

/* oxlint-enable unicorn/consistent-function-scoping */
