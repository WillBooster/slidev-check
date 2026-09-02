import type { Rule, RuleFinding } from '../types.ts';

/** Overlaps narrower than this in either direction are treated as touching, not overlapping. */
const TOLERANCE_PX = 2;

function findOverlappingElements({
  containerSelector,
  tolerance,
}: {
  containerSelector: string;
  tolerance: number;
}): RuleFinding[] {
  const { describe, fragments, textFragments, isChecked, paints, isBackground, union } = globalThis.__slidevCheck;
  // Scan the whole slide container, not just the `[data-slidev-no]` wrapper:
  // global layers (e.g. a theme's decorative band) are rendered outside the wrapper.
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  const bounds = container.getBoundingClientRect();

  // Only elements that paint something themselves can visually collide:
  // text (measured by its own text nodes, so nested inline elements are not double-counted),
  // replaced content, and boxes with a visible background or border.
  // An element wrapped over several lines paints only its line fragments, so collisions are
  // checked fragment by fragment; the bounding box only serves as a cheap pre-filter.
  interface Painted {
    element: Element;
    bounds: DOMRect;
    fragments: DOMRect[];
    kind: 'text' | 'box';
  }
  const painted: Painted[] = [];
  const add = (element: Element, kind: Painted['kind'], rects: DOMRect[]): void => {
    const rect = union(rects);
    if (rect) painted.push({ element, bounds: rect, fragments: rects, kind });
  };
  for (const element of container.querySelectorAll('*')) {
    if (!isChecked(element) || (element.tagName === 'svg' && element.parentElement?.closest('svg'))) continue;
    if (element.closest('svg') && element.tagName !== 'svg') continue; // SVG internals are one picture
    add(element, 'text', textFragments(element));
    if (!paints(element)) continue;
    const rects = fragments(element);
    const rect = union(rects);
    if (!rect || isBackground(rect, bounds)) continue;
    add(element, 'box', rects);
  }

  interface Overlap {
    a: Painted;
    b: Painted;
    width: number;
    height: number;
  }
  const intersects = (ra: DOMRect, rb: DOMRect): Pick<Overlap, 'width' | 'height'> | undefined => {
    const width = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const height = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    return width > tolerance && height > tolerance ? { width, height } : undefined;
  };
  const largestOverlap = (a: Painted, b: Painted): Overlap | undefined => {
    if (!intersects(a.bounds, b.bounds)) return undefined;
    let largest: Overlap | undefined;
    for (const ra of a.fragments) {
      for (const rb of b.fragments) {
        const size = intersects(ra, rb);
        if (size && (!largest || largest.width * largest.height < size.width * size.height))
          largest = { a, b, ...size };
      }
    }
    return largest;
  };

  // One finding per element pair (an element may be painted both as text and as a box):
  // keep the largest overlap.
  const overlaps = new Map<Element, Map<Element, Overlap>>();
  for (let i = 0; i < painted.length; i++) {
    for (let j = i + 1; j < painted.length; j++) {
      const a = painted[i]!;
      const b = painted[j]!;
      // Nested content is expected to sit on top of its container.
      if (a.element === b.element || a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const overlap = largestOverlap(a, b);
      if (!overlap) continue;
      const byPartner = overlaps.get(a.element) ?? new Map<Element, Overlap>();
      overlaps.set(a.element, byPartner);
      const previous = byPartner.get(b.element);
      if (!previous || previous.width * previous.height < overlap.width * overlap.height)
        byPartner.set(b.element, overlap);
    }
  }

  const findings: RuleFinding[] = [];
  for (const byPartner of overlaps.values()) {
    for (const { a, b, width, height } of byPartner.values()) {
      findings.push({
        message: `Element \`${describe(a.element)}\` overlaps \`${describe(b.element)}\` by ${Math.round(width)}×${Math.round(height)}px.`,
        help:
          a.kind === 'text' && b.kind === 'text'
            ? 'Consider splitting the content into multiple slides.'
            : 'Consider adjusting the position or size of the elements.',
      });
    }
  }
  return findings;
}

export const noOverlap: Rule = {
  id: 'no-overlap',
  description: 'Visible elements must not overlap each other.',
  check: ({ page, containerSelector }) =>
    page.evaluate(findOverlappingElements, {
      containerSelector,
      tolerance: TOLERANCE_PX,
    }),
};
