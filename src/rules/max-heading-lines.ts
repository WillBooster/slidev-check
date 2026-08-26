import type { Rule, RuleFinding } from '../types.ts';

const DEFAULT_MAX = 1;

function findWrappedHeadings({ containerSelector, max }: { containerSelector: string; max: number }) {
  const { describe, isAudited } = window.__slidevAudit;
  const container = document.querySelector(containerSelector);
  if (!container) return [];

  const findings: RuleFinding[] = [];
  for (const heading of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!isAudited(heading)) continue;
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
  description: 'Slide headings must not wrap into more lines than allowed.',
  check: ({ page, containerSelector, options }) =>
    page.evaluate(findWrappedHeadings, {
      containerSelector,
      max: Number(options?.['max'] ?? DEFAULT_MAX),
    }),
};
