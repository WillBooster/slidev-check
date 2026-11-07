import { perSlide, type SlideFinding } from '../perSlide.ts';
import type { Rule } from '../types.ts';

const DEFAULT_MAX = 1;

function findWrappedHeading({ containerSelector, max }: { containerSelector: string; max: number }): SlideFinding[] {
  const { describe, isChecked } = globalThis.slidevCheck;
  // The slide heading is a heading opening a title region: the root of `default` (image-*/iframe-*
  // render their text column as one), the left column of `two-cols`, or the header of `two-cols-header`. Other
  // layouts (e.g., cover, section, center) center their heading as the whole content, where wrapping takes no space
  // from a body, and headings nested in columns or wrappers belong to the body.
  const heading = document
    .querySelector(containerSelector)
    ?.querySelector(
      ':is(.slidev-layout.default, .slidev-layout.two-columns > .col-left, .slidev-layout.two-cols-header > .col-header) > :is(h1, h2, h3, h4, h5, h6):first-child'
    );
  if (!heading || !isChecked(heading)) return [];
  // Count rendered lines as the number of distinct line-box rows.
  const range = document.createRange();
  range.selectNodeContents(heading);
  const rowTops: number[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.width === 0 || rect.height === 0) continue;
    if (!rowTops.some((top) => Math.abs(top - rect.top) < rect.height / 2)) rowTops.push(rect.top);
  }
  return rowTops.length > max
    ? [
        {
          message: `Heading \`${describe(heading)}\` spans ${rowTops.length} lines, exceeding the maximum of ${max}.`,
          help: 'Consider shortening the heading.',
        },
      ]
    : [];
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
