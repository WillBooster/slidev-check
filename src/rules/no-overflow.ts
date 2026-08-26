import type { Rule, RuleFinding } from '../types.ts';

/** Sub-pixel rendering noise below this value is not reported. */
const TOLERANCE_PX = 1;

type Side = 'top' | 'right' | 'bottom' | 'left';

function findOverflowingElements({
  containerSelector,
  tolerance,
}: {
  containerSelector: string;
  tolerance: number;
}): RuleFinding[] {
  const { describe, measure, isAudited } = globalThis.__slidevAudit;
  // Scan the whole slide container, not just the `[data-slidev-no]` wrapper:
  // global layers (e.g. a theme's decorative band) are rendered outside the wrapper.
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  const bounds = container.getBoundingClientRect();

  const candidates: { element: Element; overflow: Record<Side, number> }[] = [];
  for (const element of container.querySelectorAll('*')) {
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
        (other) => other !== candidate && candidate.element.contains(other.element) && other.overflow[side] > tolerance
      )
    );
    if (explainedByDescendant) continue;
    const detail = sides.map((side) => `${Math.round(candidate.overflow[side])}px at the ${side}`).join(', ');
    findings.push({
      message: `Element \`${describe(candidate.element)}\` overflows the slide by ${detail}.`,
      help: 'Consider splitting the content into multiple slides.',
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
