import { perSlide, type SlideFinding } from '../perSlide.ts';
import type { Rule } from '../types.ts';

const DEFAULT_MAX = 1;

// code-gauge-allow functionCognitiveComplexity 17 -- the page function must stay self-contained to be serialized by `page.evaluate`.
function findWrappedHeadings({ containerSelector, max }: { containerSelector: string; max: number }): SlideFinding[] {
  const { describe, isChecked } = globalThis.slidevCheck;
  const container = document.querySelector(containerSelector);
  if (!container) return [];

  const findings: SlideFinding[] = [];
  for (const heading of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!isChecked(heading)) continue;
    // The deck title on cover/intro layouts is not a slide heading.
    if (heading.closest('.slidev-layout.cover, .slidev-layout.intro')) continue;
    // Count rendered lines as the number of distinct line-box rows.
    const range = document.createRange();
    range.selectNodeContents(heading);
    const rowTops: number[] = [];
    for (const rect of range.getClientRects()) {
      if (rect.width === 0 || rect.height === 0) continue;
      if (!rowTops.some((top) => Math.abs(top - rect.top) < rect.height / 2)) rowTops.push(rect.top);
    }
    if (rowTops.length > max) {
      findings.push({
        message: `Heading \`${describe(heading)}\` spans ${rowTops.length} lines, exceeding the maximum of ${max}.`,
        help: 'Consider shortening the heading.',
      });
    }
  }
  return findings;
}

export const maxHeadingLines: Rule = {
  id: 'max-heading-lines',
  defaultSetting: ['warn', { max: DEFAULT_MAX }],
  description: 'Slide headings must not wrap into more lines than allowed.',
  check: perSlide(({ page, containerSelector, options }) =>
    page.evaluate(findWrappedHeadings, {
      containerSelector,
      max: Number(options?.['max'] ?? DEFAULT_MAX),
    })
  ),
};
