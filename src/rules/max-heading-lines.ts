import { perSlide, type SlideFinding } from '../perSlide.ts';
import type { Rule } from '../types.ts';

const DEFAULT_MAX = 1;

// code-gauge-allow functionCognitiveComplexity 27 -- page.evaluate serializes this function alone, so its DOM helpers must nest inside it.
function findWrappedHeading({ containerSelector, max }: { containerSelector: string; max: number }): SlideFinding[] {
  const { describe, isChecked } = globalThis.slidevCheck;
  // The slide heading is the first visible heading directly in a title region: the root of `default` (image-*/iframe-*
  // render their text column as one), the left column of `two-cols`, or the header of `two-cols-header`. Other layouts
  // (e.g., cover, section, center) center their heading as the whole content, where wrapping takes no space from a
  // body. Rendered positions are deliberately not used to tell a title from a body heading: transforms, zoom, and
  // floats make them unreliable, and slides without a title are outside the slide guidelines.
  const region = document
    .querySelector(containerSelector)
    ?.querySelector(
      ':is(.slidev-layout.default, .slidev-layout.two-columns > .col-left, .slidev-layout.two-cols-header > .col-header)'
    );
  const heading = [...(region?.children ?? [])].find(
    (child) =>
      child.matches('h1, h2, h3, h4, h5, h6') &&
      child.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
  );
  // An ignored title stays the title, so that it does not promote a body heading to one.
  if (!heading || !isChecked(heading)) return [];
  const rowTops = countRowTops(heading);
  return rowTops.length > max
    ? [
        {
          message: `Heading \`${describe(heading)}\` spans ${rowTops.length} lines, exceeding the maximum of ${max}.`,
          help: 'Consider shortening the heading.',
        },
      ]
    : [];

  // Count rendered lines as the number of distinct line-box rows of the heading's text and atomic content (images,
  // icons, empty inline blocks). Ruby text (`<rt>`) sits above its base on the same line, so it is skipped.
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- page.evaluate serializes only findWrappedHeading.
  function countRowTops(heading: Element): number[] {
    const atomicSelector = 'img, svg, video, canvas, iframe, object, embed, input, select, textarea';
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // The box of an atomic element already covers its inner nodes.
        if (node.parentElement?.matches(atomicSelector) || (node instanceof Element && node.matches('rt, rp')))
          return NodeFilter.FILTER_REJECT;
        return node instanceof Element && node.hasChildNodes() && !node.matches(atomicSelector)
          ? NodeFilter.FILTER_SKIP
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    const range = document.createRange();
    const rowTops: number[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      range.selectNode(node);
      for (const rect of range.getClientRects()) {
        if (rect.width === 0 || rect.height === 0) continue;
        if (!rowTops.some((top) => Math.abs(top - rect.top) < rect.height / 2)) rowTops.push(rect.top);
      }
    }
    return rowTops;
  }
}

export const maxHeadingLines: Rule = {
  id: 'max-heading-lines',
  defaultSetting: ['warn', { max: DEFAULT_MAX }],
  description: 'The slide heading in the title bar must not wrap into more lines than allowed.',
  check: perSlide(({ page, containerSelector, options }) =>
    page.evaluate(findWrappedHeading, {
      containerSelector,
      max: Number(options?.['max'] ?? DEFAULT_MAX),
    })
  ),
};
