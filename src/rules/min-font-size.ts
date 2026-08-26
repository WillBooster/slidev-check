import type { Rule, RuleFinding } from '../types.ts';

const DEFAULT_MIN_PX = 14;

function findTooSmallText({ containerSelector, min }: { containerSelector: string; min: number }) {
  const { describe, isAudited, measureText } = window.__slidevAudit;
  const container = document.querySelector(containerSelector);
  if (!container) return [];

  const findings: RuleFinding[] = [];
  for (const element of container.querySelectorAll('*')) {
    if (!isAudited(element)) continue;
    if (!measureText(element)) continue; // only elements that render text themselves
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    if (!(fontSize < min)) continue;
    // Report only the outermost offender: children inheriting the same problem add no information.
    const parent = element.parentElement;
    if (parent && container.contains(parent) && Number.parseFloat(getComputedStyle(parent).fontSize) < min) continue;
    const size = Math.round(fontSize * 10) / 10;
    findings.push({
      message: `Element \`${describe(element)}\` has a font size of ${size}px, smaller than the minimum of ${min}px.`,
      help: 'Consider increasing the font size.',
    });
  }
  return findings;
}

export const minFontSize: Rule = {
  id: 'min-font-size',
  description: 'Text must not be rendered smaller than the minimum font size.',
  check: ({ page, containerSelector, options }) =>
    page.evaluate(findTooSmallText, {
      containerSelector,
      min: Number(options?.['min'] ?? DEFAULT_MIN_PX),
    }),
};
