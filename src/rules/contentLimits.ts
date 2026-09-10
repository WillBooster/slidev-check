import type { Rule, RuleFinding } from '../types.ts';

type Metric = 'characters' | 'listDepth' | 'tableRows';

export const maxBodyCharacters = contentLimit('max-body-characters', 'characters', 200, 'Body text', 'characters');
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
  const { describe, isChecked, measure, measureText, paints } = globalThis.__slidevCheck;
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
          isChecked(node) &&
          (node.matches('br, hr, img, svg, canvas, iframe, video, audio, object, embed, input, select, textarea') ||
            node instanceof SVGUseElement ||
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
      if (![...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0)) continue;
      let block = element.closest('.katex') ?? element.closest('ruby') ?? element;
      while (
        block !== root &&
        ['inline', 'ruby', 'contents'].includes(getComputedStyle(block).display) &&
        block.parentElement
      ) {
        block = block.parentElement;
      }
      if (previousBlock !== block) text.push('\n');
      text.push(content);
      previousBlock = block;
    }
    // Segment before dropping whitespace so separated Unicode characters cannot combine.
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(text.join(''))].filter(({ segment }) => segment.trim()).length;
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
    // A visibility override must expose content, not merely create an empty box.
    for (const candidate of [element, ...element.querySelectorAll('*')]) {
      if (isSvgResource(candidate)) continue;
      if (isTextChecked(candidate) && measureText(candidate) !== undefined) return true;
      if (!isChecked(candidate) || !paints(candidate)) continue;
      const rect = measure(candidate);
      if (rect && rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  function isTextChecked(element: Element): boolean {
    if (isSvgResource(element)) return false;
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

  function isSvgResource(element: Element): boolean {
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      if (parent instanceof SVGElement && svgResources.has(parent.localName)) return true;
    }
    return false;
  }
}
