import type { Page } from 'playwright-chromium';

/**
 * Helpers shared by rules. They are installed into the checked page once
 * (see `installBrowserHelpers`) because `page.evaluate` functions cannot
 * close over Node-side values.
 */
export interface BrowserHelpers {
  /** Short human-readable description of an element, e.g. `<img.logo>`. */
  describe: (element: Element) => string;
  /** Union of all client rects of the element and of its direct text nodes; `undefined` if nothing is rendered. */
  measure: (element: Element) => DOMRect | undefined;
  /** Union of the client rects of the element's direct text nodes only. */
  measureText: (element: Element) => DOMRect | undefined;
  /** Whether the element is rendered and neither hidden nor excluded with `data-slidev-check-ignore`. */
  isChecked: (element: Element) => element is HTMLElement | SVGElement;
  /** Bounding box union of a list of rects; `undefined` when every rect is empty. */
  union: (rects: Iterable<DOMRect>) => DOMRect | undefined;
}

declare global {
  // eslint-disable-next-line no-var -- `var` is required for a `globalThis` property declaration.
  var __slidevCheck: BrowserHelpers;
}

// The helpers must be defined inside `defineHelpers` because the whole function is serialized
// and evaluated in the browser; module-scope functions would not be available there.
/* oxlint-disable unicorn/consistent-function-scoping */
function defineHelpers(): void {
  const union = (rects: Iterable<DOMRect>): DOMRect | undefined => {
    let result: DOMRect | undefined;
    for (const rect of rects) {
      if (rect.width === 0 && rect.height === 0) continue;
      if (!result) {
        result = DOMRect.fromRect(rect);
        continue;
      }
      const left = Math.min(result.left, rect.left);
      const top = Math.min(result.top, rect.top);
      const right = Math.max(result.right, rect.right);
      const bottom = Math.max(result.bottom, rect.bottom);
      result = new DOMRect(left, top, right - left, bottom - top);
    }
    return result;
  };

  const measureText = (element: Element): DOMRect | undefined => {
    // Range rects follow the font's ascent/descent, which exceed the line box when
    // line-height is tight, so each rect is clamped to the line height. Otherwise
    // consecutive lines of normal text would be reported as overlapping.
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    const rects: DOMRect[] = [];
    for (const child of element.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(child);
      for (const rect of range.getClientRects()) {
        if (Number.isNaN(lineHeight) || rect.height <= lineHeight) rects.push(rect);
        else rects.push(new DOMRect(rect.left, rect.top + (rect.height - lineHeight) / 2, rect.width, lineHeight));
      }
    }
    return union(rects);
  };

  const measure = (element: Element): DOMRect | undefined => {
    // Text nodes can stick out of their block parent (e.g. a long unbreakable word),
    // so they are measured explicitly in addition to the element box.
    const rects = [...element.getClientRects()];
    const text = measureText(element);
    if (text) rects.push(text);
    return union(rects);
  };

  const isChecked = (element: Element): element is HTMLElement | SVGElement =>
    (element instanceof HTMLElement || element instanceof SVGElement) &&
    !element.closest('[data-slidev-check-ignore]') &&
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });

  const describe = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = [...element.classList]
      .filter((c) => !c.startsWith('slidev-'))
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join('');
    const text = (element.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
    const snippet = text.length > 16 ? `${text.slice(0, 16)}…` : text;
    return `<${tag}${id}${classes}>${snippet}`;
  };

  globalThis.__slidevCheck = { describe, measure, measureText, isChecked, union };
}
/* oxlint-enable unicorn/consistent-function-scoping */

export async function installBrowserHelpers(page: Page): Promise<void> {
  await page.evaluate(defineHelpers);
}
