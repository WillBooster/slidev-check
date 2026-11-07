import { perSlide, type SlideFinding } from '../perSlide.ts';
import type { Rule } from '../types.ts';

const DEFAULT_MAX = 1;

function findWrappedHeading({ containerSelector, max }: { containerSelector: string; max: number }): SlideFinding[] {
  const { describe, isChecked } = globalThis.slidevCheck;
  // The first heading is the slide heading, as in `optimal-zoom`. Only these Slidev layouts put it in a title bar
  // above the body (image-*/iframe-* render their text column as `default`); the others center their heading as
  // the whole content (e.g., cover, section, center), where wrapping takes no space from a body.
  const heading = document
    .querySelector(containerSelector)
    ?.querySelector('.slidev-layout:is(.default, .two-columns, .two-cols-header) :is(h1, h2, h3, h4, h5, h6)');
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
