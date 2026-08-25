import type { Rule, RuleFinding } from '../types.ts';

/** Sub-pixel rendering noise below this value is not reported. */
const TOLERANCE_PX = 1;

type Side = 'top' | 'right' | 'bottom' | 'left';

function findOverflowingElements({ containerSelector, tolerance }: { containerSelector: string; tolerance: number }) {
  const { describe, measure, isAudited } = window.__slidevAudit;
  const container = document.querySelector(containerSelector);
  const slideRoot = container?.querySelector('[data-slidev-no]');
  if (!container || !slideRoot) return [];
  const bounds = container.getBoundingClientRect();

  const candidates: { element: Element; overflow: Record<Side, number> }[] = [];
  for (const element of slideRoot.querySelectorAll('*')) {
    if (!isAudited(element)) continue;
    const rect = measure(element);
    if (!rect) continue;
    const overflow: Record<Side, number> = {
      top: bounds.top - rect.top,
      right: rect.right - bounds.right,
      bottom: rect.bottom - bounds.bottom,
      left: bounds.left - rect.left,
    };
    if (Object.values(overflow).some((v) => v > tolerance)) candidates.push({ element, overflow });
  }

  // Report only the innermost offenders: an ancestor that overflows solely because a
  // descendant overflows on the same side adds no information.
  const findings: RuleFinding[] = [];
  for (const candidate of candidates) {
    const sides = (Object.keys(candidate.overflow) as Side[]).filter((s) => candidate.overflow[s] > tolerance);
    const explainedByDescendant = sides.every((side) =>
      candidates.some(
        (other) =>
          other !== candidate && candidate.element.contains(other.element) && other.overflow[side] > tolerance,
      ),
    );
    if (explainedByDescendant) continue;
    const detail = sides.map((side) => `${Math.round(candidate.overflow[side])}px beyond the ${side} edge`).join(', ');
    findings.push({
      element: describe(candidate.element),
      message: `Element extends outside the slide (${detail}).`,
      hint: 'The content does not fit in the slide. Split it across multiple slides first; otherwise shorten the content, reduce margins, or constrain the element with `max-w-full`/`max-h-full`. Reducing the font size should be the last resort.',
    });
  }
  return findings;
}

export const noOverflow: Rule = {
  id: 'no-overflow',
  description: 'Elements must stay within the slide bounds.',
  check: ({ page, containerSelector }) =>
    page.evaluate(findOverflowingElements, { containerSelector, tolerance: TOLERANCE_PX }),
};
