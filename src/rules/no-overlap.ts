import type { Rule, RuleFinding } from '../types.ts';

/** Overlaps narrower than this in either direction are treated as touching, not overlapping. */
const TOLERANCE_PX = 2;
/** Painted boxes covering at least this share of the slide are treated as backgrounds and ignored. */
const BACKGROUND_AREA_RATIO = 0.8;

function findOverlappingElements({ containerSelector, tolerance, backgroundRatio }: {
  containerSelector: string;
  tolerance: number;
  backgroundRatio: number;
}) {
  const { describe, measure, measureText, isAudited } = window.__slidevAudit;
  const container = document.querySelector(containerSelector);
  const slideRoot = container?.querySelector('[data-slidev-no]');
  if (!container || !slideRoot) return [];
  const bounds = container.getBoundingClientRect();

  // Only elements that paint something themselves can visually collide:
  // text (measured by its own text nodes, so nested inline elements are not double-counted),
  // replaced content, and boxes with a visible background or border.
  const REPLACED = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'IFRAME', 'svg']);
  const paints = (element: Element, style: CSSStyleDeclaration): boolean =>
    REPLACED.has(element.tagName) ||
    (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
    style.backgroundImage !== 'none' ||
    ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) =>
        Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
        style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
    );

  interface Painted {
    element: Element;
    rect: DOMRect;
    kind: 'text' | 'box';
  }
  const painted: Painted[] = [];
  for (const element of slideRoot.querySelectorAll('*')) {
    if (!isAudited(element) || element.tagName === 'svg' && element.parentElement?.closest('svg')) continue;
    if (element.closest('svg') && element.tagName !== 'svg') continue; // SVG internals are one picture
    const text = measureText(element);
    if (text) painted.push({ element, rect: text, kind: 'text' });
    const style = getComputedStyle(element);
    if (!paints(element, style)) continue;
    const rect = measure(element);
    if (!rect) continue;
    const coverage = (rect.width * rect.height) / (bounds.width * bounds.height);
    if (coverage >= backgroundRatio) continue;
    painted.push({ element, rect, kind: 'box' });
  }

  // One finding per element pair (an element may be painted both as text and as a box):
  // keep the largest overlap.
  interface Overlap {
    a: Painted;
    b: Painted;
    width: number;
    height: number;
  }
  const overlaps = new Map<Element, Map<Element, Overlap>>();
  for (let i = 0; i < painted.length; i++) {
    for (let j = i + 1; j < painted.length; j++) {
      const a = painted[i]!;
      const b = painted[j]!;
      // Nested content is expected to sit on top of its container.
      if (a.element === b.element || a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (width <= tolerance || height <= tolerance) continue;
      const byPartner = overlaps.get(a.element) ?? new Map<Element, Overlap>();
      overlaps.set(a.element, byPartner);
      const previous = byPartner.get(b.element);
      if (!previous || previous.width * previous.height < width * height) byPartner.set(b.element, { a, b, width, height });
    }
  }

  const findings: RuleFinding[] = [];
  for (const byPartner of overlaps.values()) {
    for (const { a, b, width, height } of byPartner.values()) {
      findings.push({
        element: describe(a.element),
        message: `Element overlaps ${describe(b.element)} by ${Math.round(width)}×${Math.round(height)}px.`,
        hint:
          a.kind === 'text' && b.kind === 'text'
            ? 'Text is drawn over other text. Split the content across slides first; otherwise shorten it, widen the columns, or move one of the elements. Reducing the font size should be the last resort.'
            : 'Elements are drawn on top of each other. Check absolute positions, negative margins, and fixed sizes; if the overlap is intentional, add `data-slidev-audit-ignore` to one of them.',
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
      backgroundRatio: BACKGROUND_AREA_RATIO,
    }),
};
