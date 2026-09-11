import type { Rule, RuleFinding } from '../types.ts';

type Metric = 'characters' | 'listDepth' | 'tableRows';

export const maxBodyCharacters = contentLimit('max-body-characters', 'characters', 350, 'Body text', 'characters');
export const maxListDepth = contentLimit('max-list-depth', 'listDepth', 2, 'List', 'levels');
export const maxTableRows = contentLimit('max-table-rows', 'tableRows', 8, 'Table', 'rows');

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
  const { describe, isChecked, measureText } = globalThis.__slidevCheck;
  const svgResources = new Set(['defs', 'symbol', 'clipPath', 'mask', 'pattern', 'marker']);
  const layout = document.querySelector(`${containerSelector} .slidev-layout`);
  if (!layout) return [];
  if (metric === 'tableRows') return findTables(layout);
  const count = metric === 'characters' ? countCharacters(layout) : countListDepth(layout);
  return count > max
    ? [
        {
          message: `${subject} has ${count} ${unit}, exceeding the maximum of ${max}.`,
          help: 'Consider shortening or splitting the content into multiple slides.',
        },
      ]
    : [];

  function findTables(root: Element): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const table of root.querySelectorAll('table')) {
      const rows = [...table.querySelectorAll('tr')].filter(
        (row) => row.closest('table') === table && hasVisibleContent(row)
      );
      if (rows.length > max)
        findings.push({
          message: `Table \`${describe(table)}\` has ${rows.length} rows, exceeding the maximum of ${max}.`,
          help: 'Consider shortening or splitting the table into multiple slides.',
        });
    }
    return findings;
  }

  function countCharacters(root: Element): number {
    const text: string[] = [];
    const included: { start: number; end: number }[] = [];
    let offset = 0;
    let previousBlock: Element | undefined;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
      acceptNode: (node) =>
        node instanceof SVGElement && svgResources.has(node.localName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element) {
        if (
          node.checkVisibility({ contentVisibilityAuto: true }) &&
          (node.matches(
            'br, wbr, hr, img, svg, math, canvas, iframe, video, audio, object, embed, input, select, textarea'
          ) ||
            node instanceof SVGUseElement ||
            !['inline', 'contents', 'ruby', 'ruby-text'].includes(getComputedStyle(node).display))
        )
          append('\n', false);
        continue;
      }
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const element = node.parentNode;
      if (!(element instanceof HTMLElement || element instanceof SVGElement) || isSvgResource(element)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()];
      if (rects.length === 0) continue;
      const content = node.textContent ?? '';
      if (!content.trim()) {
        append(content, false);
        continue;
      }
      let block = element.closest('.katex') ?? element.closest('ruby') ?? element;
      while (
        block !== root &&
        ['inline', 'ruby', 'contents'].includes(getComputedStyle(block).display) &&
        block.parentElement
      )
        block = block.parentElement;
      if (previousBlock !== block) append('\n', false);
      // Excluded but laid-out text still separates surrounding grapheme clusters.
      append(
        content,
        isContentChecked(element) &&
          !element.closest('h1, h2, h3, h4, h5, h6, script, style') &&
          rects.some((rect) => rect.width > 0 || rect.height > 0)
      );
      previousBlock = block;
    }
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    let run = 0;
    for (const { index, segment } of segmenter.segment(text.join(''))) {
      while ((included[run]?.end ?? Infinity) <= index) run++;
      const current = included[run];
      if (current && current.start < index + segment.length) count++;
    }
    return count;

    function append(value: string, countable: boolean): void {
      text.push(value);
      if (countable) {
        for (const match of value.matchAll(/[^\s\p{Default_Ignorable_Code_Point}\p{Cc}]+/gu)) {
          included.push({ start: offset + match.index, end: offset + match.index + match[0].length });
        }
      }
      offset += value.length;
    }
  }

  function countListDepth(root: Element): number {
    let depth = 0;
    for (const item of root.querySelectorAll('li')) {
      if (!hasVisibleContent(item)) continue;
      let itemDepth = 0;
      for (let parent = item.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
        if (parent.matches('ul, ol')) itemDepth++;
      }
      depth = Math.max(depth, itemDepth);
    }
    return depth;
  }

  function hasVisibleContent(element: Element): boolean {
    if (isSvgResource(element)) return false;
    if (isChecked(element)) return true;
    return [element, ...element.querySelectorAll('*')].some(
      (candidate) => isContentChecked(candidate) && measureText(candidate) !== undefined
    );
  }

  function isContentChecked(element: Element): boolean {
    if (
      !(element instanceof HTMLElement || element instanceof SVGElement) ||
      element.closest('[data-slidev-check-ignore]') ||
      isSvgResource(element) ||
      getComputedStyle(element).visibility !== 'visible'
    )
      return false;
    let box: Element | null = element;
    while (box && getComputedStyle(box).display === 'contents') box = box.parentElement;
    if (!box?.checkVisibility({ opacityProperty: true, contentVisibilityAuto: true })) return false;
    // The property is ineffective on some boxes; innerText distinguishes skipped contents.
    return !(
      box instanceof HTMLElement &&
      getComputedStyle(box).contentVisibility === 'hidden' &&
      // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- innerText excludes skipped contents; textContent does not.
      box.innerText === ''
    );
  }

  function isSvgResource(element: Element): boolean {
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      if (parent instanceof SVGElement && svgResources.has(parent.localName)) return true;
    }
    return false;
  }
}
