import type { Rule, RuleFinding } from '../types.ts';

// Absorbs floating-point error, e.g. `font-size: 0.6em` must not fall below a minimum of 0.6.
const EPSILON = 0.001;

export const minFontScale: Rule = {
  id: 'min-font-scale',
  description: "Text must not be scaled below the minimum ratio of the theme's default size.",
  check: ({ page, containerSelector, options }) =>
    page.evaluate(findShrunkText, { containerSelector, min: Number(options?.['min'] ?? 0.6) }),
};

export const minHeadingScale: Rule = {
  id: 'min-heading-scale',
  description: "The slide heading must not be scaled below the minimum ratio of the theme's default size.",
  check: ({ page, containerSelector, options }) =>
    page.evaluate(findShrunkHeading, { containerSelector, min: Number(options?.['min'] ?? 1) }),
};

function findShrunkText({ containerSelector, min }: { containerSelector: string; min: number }): RuleFinding[] {
  const { describe, fontScales, isChecked, measureText } = globalThis.__slidevCheck;
  const container = document.querySelector(containerSelector);
  const layout = container?.querySelector('.slidev-layout');
  if (!container || !layout) return [];

  const elements = [layout, ...layout.querySelectorAll('*')].filter((element) => isChecked(element));
  const scales = fontScales(container, elements);
  const shrunk = new Set(elements.filter((_, i) => (scales[i] ?? 1) < min - EPSILON));
  // Report each shrunk region once, at its outermost shrunk element (typically a zoom wrapper).
  const regions = new Map<Element, number>();
  for (const [i, element] of elements.entries()) {
    if (!shrunk.has(element) || !measureText(element)) continue;
    let root = element;
    while (root.parentElement && shrunk.has(root.parentElement)) root = root.parentElement;
    regions.set(root, Math.min(regions.get(root) ?? Infinity, scales[i] ?? 1));
  }
  return [...regions].map(([root, scale]) => ({
    message: `${root === layout ? 'The slide' : `Element \`${describe(root)}\``} scales text down to ${scale.toFixed(2)}× the theme's default size, below the minimum of ${min}×.`,
    help: 'Consider shortening or splitting the content into multiple slides instead of shrinking the text.',
  }));
}

function findShrunkHeading({ containerSelector, min }: { containerSelector: string; min: number }): RuleFinding[] {
  const { describe, fontScales, isChecked } = globalThis.__slidevCheck;
  const container = document.querySelector(containerSelector);
  // The first heading is the slide heading, as in `optimal-zoom`; the deck title on cover/intro layouts is not one.
  const heading = container?.querySelector('.slidev-layout:not(.cover, .intro) :is(h1, h2, h3, h4, h5, h6)');
  if (!container || !heading || !isChecked(heading)) return [];
  const [scale = 1] = fontScales(container, [heading]);
  return scale < min - EPSILON
    ? [
        {
          message: `Heading \`${describe(heading)}\` is rendered at ${scale.toFixed(2)}× the theme's default size, below the minimum of ${min}×.`,
          help: 'Consider shortening the heading instead of shrinking it.',
        },
      ]
    : [];
}
