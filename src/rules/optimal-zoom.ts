// code-gauge-allow-file fileNcss 406 -- analyzeZoom is serialized into the page as one function, so its frontmatter analysis cannot move to another module.
import { perSlide, type SlideFinding } from '../perSlide.ts';
import type { Fix, Rule } from '../types.ts';

const DEFAULT_MARGIN_LINES = 1;
const DEFAULT_MAX_ZOOM = 1;
/** Zoom values are searched and compared at this granularity. */
const ZOOM_STEP = 0.01;
/** Zoom values below this are not suggested: the content should be split instead. */
const MIN_ZOOM = 0.1;

interface ZoomAnalysis {
  /**
   * `wrapper` for an element with an inline `zoom` style; `frontmatter` for the layout of a slide without one that
   * Slidev zooms (its page carries the applied zoom, or its frontmatter sets `zoom: 1`); `slide` for the body of a
   * slide with neither.
   */
  kind: 'wrapper' | 'frontmatter' | 'slide';
  description: string;
  /** Position of the wrapper among all elements with an inline `zoom` style on the slide, in DOM order. */
  index: number;
  /** Resolved zooms of all elements with an inline `zoom` style on the slide, in DOM order. */
  zooms: number[];
  current: number;
  /** Lines of margin left above the bottom limit at the current zoom. */
  currentMargin: number;
  /**
   * Whether the zoomed content stays within the left, right, and top edges of the slide at the current zoom, and its
   * positioned elements within the bottom edge too.
   */
  currentFitsBounds: boolean;
  /** What bounds the content from below at the current zoom: the slide bottom or a fixed element above it. */
  bottom: string;
  /** Largest zoom keeping the required margin, or `undefined` if none does. */
  optimal: number | undefined;
  /** What bounds the content from below at the optimal zoom. */
  optimalBottom: string;
  /** Content outside the target that already takes the margin at the smallest zoom, when nothing fits. */
  blockedBy: string | undefined;
  /** For the `slide` kind: whether a heading precedes the body that would be wrapped. */
  belowHeading?: boolean;
}

// Everything used by `analyzeZoom` must be defined inside it: the whole function is serialized
// and evaluated in the browser, where module-scope functions would not be available.
/* oxlint-disable unicorn/consistent-function-scoping */
function analyzeZoom({
  containerSelector,
  frontmatterZoom,
  marginLines,
  maxZoom,
  minZoom,
  step,
}: {
  containerSelector: string;
  /** The slide's `zoom` frontmatter, if it sets one. */
  frontmatterZoom: number | undefined;
  marginLines: number;
  maxZoom: number;
  minZoom: number;
  step: number;
}): ZoomAnalysis[] {
  const { describe, fragments, textFragments, isChecked, paints, isBackground } = globalThis.slidevCheck;
  const container = document.querySelector(containerSelector);
  const layout = container?.querySelector('.slidev-layout');
  // The cover/intro layouts center their content; a zoom only serves body slides.
  if (!container || !layout || layout.matches('.cover, .intro')) return [];
  const bounds = container.getBoundingClientRect();

  const isSvgInternal = (element: Element): boolean => element.tagName !== 'svg' && element.closest('svg') !== null;
  const isPositioned = (element: Element): boolean => {
    for (let current: Element | null = element; current && current !== layout; current = current.parentElement) {
      const position = getComputedStyle(current).position;
      if (position === 'absolute' || position === 'fixed') return true;
    }
    return false;
  };
  /**
   * Painted pieces of one element: its text lines, and its boxes when it paints a background,
   * border, or image. A positioned box covering the slide is a decoration, not content; a box in
   * the flow (a large image) is content whatever its size.
   */
  // When set, the decorations as classified at the current zoom, kept while candidate zooms grow or
  // shrink boxes past the background threshold.
  let decorations: Set<Element> | undefined;
  const paintedRects = (element: Element): DOMRect[] => {
    if (!isChecked(element) || isSvgInternal(element)) return [];
    const nonEmpty = (rect: DOMRect): boolean => rect.width > 0 && rect.height > 0;
    // A frozen decoration's own text is still content; only its box is left out.
    if (decorations?.has(element)) return textFragments(element).filter(nonEmpty);
    const decoration = !decorations && paints(element) && isPositioned(element);
    const rects = paints(element) ? fragments(element) : textFragments(element);
    return rects.filter((rect) => nonEmpty(rect) && !(decoration && isBackground(rect, bounds)));
  };
  /** Whether the element sits in a flex or grid item beside the target's, rather than above or below it. */
  const inOtherColumn = (element: Element, target: Element): boolean => {
    const itemOf = (descendant: Element, container: Element): Element | undefined => {
      let item: Element = descendant;
      while (item.parentElement && item.parentElement !== container) item = item.parentElement;
      return item.parentElement === container ? item : undefined;
    };
    let container: Element | null = element.parentElement;
    while (container && !container.contains(target)) container = container.parentElement;
    if (!container || container === target || !layout.contains(container)) return false;
    if (!/flex|grid/.test(getComputedStyle(container).display)) return false;
    const a = itemOf(element, container)?.getBoundingClientRect();
    const b = itemOf(target, container)?.getBoundingClientRect();
    if (!a || !b) return false;
    // Beside means on the same row: apart horizontally while sharing some height.
    const sameRow = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
    return sameRow && (a.right <= b.left + 1 || a.left >= b.right - 1);
  };
  /**
   * The containing block of an absolutely positioned or fixed element as the browser lays it out,
   * or `null` for the viewport, read from `offsetParent` with as little change to the page as
   * possible, since any change can alter which rules match; `undefined` for an SVG box, which has
   * no `offsetParent` and whose containing block cannot be read without changing the page.
   */
  const containingBlockOf = (element: Element): Element | null | undefined => {
    if (element instanceof HTMLElement) {
      if (getComputedStyle(element).zoom === '1') return element.offsetParent;
      // An element's own zoom stops `offsetParent` at its parent; the box is out of flow, so
      // resetting its zoom moves nothing else, and its inline style is restored verbatim.
      const attribute = element.getAttribute('style');
      element.style.setProperty('zoom', '1', 'important');
      const block = element.offsetParent;
      if (attribute === null) element.removeAttribute('style');
      else element.setAttribute('style', attribute);
      return block;
    }
    return undefined;
  };
  /**
   * Whether the element is laid out by an absolutely positioned or fixed ancestor-or-self whose
   * containing block lies outside the target, so that the target's flow does not move it. When the
   * target is the slide's layout (`layoutTarget`), a box anchored to the layout itself counts too.
   */
  const isPinnedIn = (element: Element, target: Element, layoutTarget = false): boolean => {
    for (let current: Element | null = element; current && current !== target; current = current.parentElement) {
      // SVG content is laid out by its `<svg>`, and `display: contents` generates no box, whatever their `position`.
      if (isSvgInternal(current)) continue;
      const { display, position } = getComputedStyle(current);
      if (display === 'contents' || (position !== 'absolute' && position !== 'fixed')) continue;
      const block = containingBlockOf(current);
      // An SVG box counts as content, as before pinned elements were recognized.
      if (block === undefined) continue;
      if (!block || !target.contains(block) || (layoutTarget && block === target)) return true;
    }
    return false;
  };
  const extentOf = (elements: Iterable<Element>): { top: number; left: number; right: number; bottom: number } => {
    const extent = {
      top: Number.POSITIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    };
    for (const element of elements) {
      for (const rect of paintedRects(element)) {
        extent.top = Math.min(extent.top, rect.top);
        extent.left = Math.min(extent.left, rect.left);
        extent.right = Math.max(extent.right, rect.right);
        extent.bottom = Math.max(extent.bottom, rect.bottom);
      }
    }
    return extent;
  };
  const resolvedZoom = (element: Element): number => {
    const zoom = Number.parseFloat(getComputedStyle(element).zoom);
    return Number.isFinite(zoom) ? zoom : 1;
  };
  /** Height of one text line at the element, measured with a probe so that it follows the zoom. */
  const lineHeightAt = (element: Element): number => {
    const probe = document.createElement('div');
    probe.textContent = 'X';
    probe.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap;';
    // Replaced elements (images, videos, ...) render no children, so the probe climbs to the
    // nearest ancestor where it gets a height.
    for (let host: Element | null = element; host; host = host.parentElement) {
      if (!(host instanceof HTMLElement) || isSvgInternal(host)) continue;
      host.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      if (height > 0) return height;
    }
    return Number.NaN;
  };

  const zoomed = [...layout.querySelectorAll('*')].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.style.zoom !== '' && isChecked(element)
  );
  const zooms = zoomed.map(resolvedZoom);

  interface Measurement {
    measurable: boolean;
    lines: number;
    fitsBounds: boolean;
    bottom: string;
    /** The lowest content, when it lies outside the target. */
    outside: string | undefined;
  }

  /** How a candidate zoom is applied: the target's own `zoom` unless a scaler says otherwise. */
  interface Scaler {
    current: number;
    original: string;
    apply: (zoom: string) => void;
  }
  const ownZoom = (target: HTMLElement): Scaler => ({
    current: resolvedZoom(target),
    original: target.style.zoom,
    apply: (zoom) => {
      target.style.zoom = zoom;
    },
  });
  const analyze = (
    target: HTMLElement,
    kind: ZoomAnalysis['kind'],
    index: number,
    scaler: Scaler = ownZoom(target)
  ): ZoomAnalysis | undefined => {
    // The slide's layout, measured for a frontmatter zoom, paints the whole slide: only its descendants are content.
    const layoutTarget = target === layout;
    const descendants = [...(layoutTarget ? [] : [target]), ...target.querySelectorAll('*')];
    // A frontmatter zoom also scales the layers Slidev renders beside the layout (slide-top.vue,
    // slide-bottom.vue), so they must stay on the slide too.
    const layers = layoutTarget
      ? [...(layout.closest('.slidev-page')?.querySelectorAll('*') ?? [])].filter(
          (element) => !layout.contains(element)
        )
      : [];
    // When the layout is the target, the layout can hold content at its own bottom edge (a bottom
    // slot, a footer pushed down by `margin-top: auto`): the zoom scales its distance to the slide
    // bottom while the flow content moves, so content whose distance divided by the zoom stays the
    // same at a candidate zoom and at a slightly smaller one is anchored to the bottom in that
    // candidate's layout and bounds the space like a pinned element.
    // The distances to the slide bottom of an element's box (whether it paints or not) and of its own
    // text, which can move apart (a card kept at the bottom around text that moves with the zoom).
    const gapsAt = (zoom: number): Map<Element, number[]> => {
      scaler.apply(String(zoom));
      const gaps = new Map<Element, number[]>();
      const gapOf = (rects: DOMRect[]): number[] =>
        rects.length > 0 ? [bounds.bottom - Math.max(...rects.map((rect) => rect.bottom))] : [];
      for (const element of descendants) {
        if (!isChecked(element) || isSvgInternal(element)) continue;
        const nonEmpty = (rect: DOMRect): boolean => rect.width > 0 && rect.height > 0;
        const box = fragments(element).filter(nonEmpty);
        const elementGaps = [...gapOf(box), ...gapOf(textFragments(element).filter(nonEmpty))];
        if (elementGaps.length > 0) gaps.set(element, elementGaps);
      }
      return gaps;
    };
    const bottomAnchoredAt = (zoom: number): Set<Element> => {
      const anchored = new Set<Element>();
      if (!layoutTarget) return anchored;
      const nearbyZoom = zoom * 0.9;
      const nearby = gapsAt(nearbyZoom);
      const at = gapsAt(zoom);
      // Anchored content keeps its distance divided by the zoom, or its distance itself when the theme
      // keeps it unscaled.
      const steady = (element: Element): boolean => {
        const a = at.get(element);
        const b = nearby.get(element);
        return (
          a !== undefined &&
          b?.length === a.length &&
          a.every((gap, i) => {
            const other = b[i] ?? Number.NaN;
            return Math.abs(gap - other) <= 2 || Math.abs(gap / zoom - other / nearbyZoom) <= 2;
          })
        );
      };
      // An element is anchored when it and every element laid out within it keep their distances.
      for (const element of at.keys()) {
        // A descendant positioned against another box moves on its own and is pinned separately.
        const insideMoves = (inner: Element): boolean => at.has(inner) && !steady(inner) && !isPinnedIn(inner, element);
        if (steady(element) && ![...element.querySelectorAll('*')].some(insideMoves)) {
          anchored.add(element);
          for (const inner of element.querySelectorAll('*')) anchored.add(inner);
        }
      }
      return anchored;
    };
    const measure = (zoom: number): Measurement => {
      const bottomAnchored = bottomAnchoredAt(zoom);
      scaler.apply(String(zoom));
      // Classified at each zoom: the zoom changes widths, and with them container queries may change positioning.
      const pinned = new Set(
        descendants.filter((element) => bottomAnchored.has(element) || isPinnedIn(element, target, layoutTarget))
      );
      const flow = descendants.filter((element) => !pinned.has(element));
      // The target's flow scales with the zoom, and the rest of the flow moves with it. Positioned
      // elements anchored outside the target do not move with the flow and bound the space
      // instead; those inside the target still scale with it and must stay on the slide.
      const scaled = extentOf(flow);
      // A box enclosing a pinned or anchored element (a card around its footer) spans that element,
      // so its own painting stays in the bounds but not in the margin, which keeps its text and the
      // rest of its flow content.
      const encloses = (element: Element): boolean =>
        [...pinned].some((inner) => inner !== element && element.contains(inner));
      const marginRects = (element: Element): DOMRect[] =>
        layoutTarget && encloses(element)
          ? isChecked(element)
            ? textFragments(element).filter((rect) => rect.width > 0 && rect.height > 0)
            : []
          : paintedRects(element);
      const marginFlow = flow.filter((element) => marginRects(element).length > 0);
      const margined = {
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      };
      for (const rect of marginFlow.flatMap(marginRects)) {
        margined.left = Math.min(margined.left, rect.left);
        margined.right = Math.max(margined.right, rect.right);
        margined.bottom = Math.max(margined.bottom, rect.bottom);
      }
      // A layout whose painted content is all pinned or anchored to its bottom has no flow to keep a
      // margin under; that content must still stay on the slide (the bounds below).
      const pinnedExtent = extentOf(pinned);
      const layersExtent = extentOf(layers);
      const noFlow =
        layoutTarget &&
        margined.right <= margined.left &&
        (pinnedExtent.right > pinnedExtent.left || layersExtent.right > layersExtent.left);
      const anchored = extentOf([...pinned, ...layers]);
      const beside = (rect: DOMRect): boolean => rect.right <= scaled.left || rect.left >= scaled.right;
      // Flow content moves with the target unless it sits in another column beside it.
      let bottom = margined.bottom;
      let lowest: Element | undefined;
      for (const element of layout.querySelectorAll('*')) {
        if (target.contains(element) || isPositioned(element)) continue;
        if (inOtherColumn(element, target)) continue;
        // An ancestor's box spans the target itself; only its own text is content of its own.
        const rects = element.contains(target) ? textFragments(element) : paintedRects(element);
        for (const rect of rects) {
          if (rect.width === 0 || rect.height === 0 || rect.bottom <= bottom) continue;
          bottom = rect.bottom;
          lowest = element;
        }
      }
      if (lowest === undefined) {
        // The target itself is the lowest: find which of its elements ends the content.
        for (const element of marginFlow) {
          if (marginRects(element).some((rect) => rect.bottom >= bottom - 0.5)) lowest ??= element;
        }
      }
      let limit = bounds.bottom;
      let limitedBy: Element | undefined;
      for (const element of container.querySelectorAll('*')) {
        if (target.contains(element) ? !pinned.has(element) : layout.contains(element) && !isPositioned(element)) {
          continue;
        }
        for (const rect of paintedRects(element)) {
          if (rect.top < scaled.top || beside(rect)) continue;
          if (rect.top < limit) {
            limit = rect.top;
            limitedBy = element;
          }
        }
      }
      // The margin is counted in lines of the text right above it, whichever element that is,
      // so that wrappers with different text sizes agree on how much space is left.
      const line = lowest ? lineHeightAt(lowest) : Number.NaN;
      return {
        measurable: (line > 0 && scaled.right > scaled.left) || noFlow,
        lines: line > 0 ? (limit - bottom) / line : marginLines,
        fitsBounds:
          Math.min(scaled.left, anchored.left) >= bounds.left - 1 &&
          Math.max(scaled.right, anchored.right) <= bounds.right + 1 &&
          Math.min(scaled.top, anchored.top) >= bounds.top - 1 &&
          anchored.bottom <= bounds.bottom + 1,
        bottom: limitedBy ? `\`${describe(limitedBy)}\`` : 'the slide bottom',
        outside: lowest && !target.contains(lowest) ? describe(lowest) : undefined,
      };
    };
    const fits = (measurement: Measurement): boolean =>
      measurement.measurable && measurement.fitsBounds && measurement.lines >= marginLines - 1e-6;

    const { current, original } = scaler;
    const at = measure(current);
    // The maximum only bounds suggestions: a deliberately larger zoom that still fits is left as it
    // is, so later wrappers are measured against it.
    if (current > maxZoom && fits(at)) {
      scaler.apply(original);
      return undefined;
    }
    let optimal: number | undefined;
    let best = at;
    let blockedBy: string | undefined;
    if (at.measurable) {
      // Content height grows with the zoom (both the scale and the wrapping increase), so the
      // largest fitting zoom of a wrapper can be found by bisection over hundredths.
      const hi = Math.floor(maxZoom / step + 1e-9);
      const lo = Math.round(minZoom / step);
      const atHigh = measure(hi * step);
      if (fits(atHigh)) {
        optimal = hi * step;
        best = atHigh;
      } else {
        const atLow = measure(lo * step);
        if (layoutTarget) {
          // The page's zoom changes the layout's width, so container queries can make the fit
          // non-monotonic in the zoom: the hundredths are tried from the top instead of bisected.
          for (let candidate = hi - 1; candidate >= lo; candidate--) {
            const measurement = candidate === lo ? atLow : measure(candidate * step);
            if (fits(measurement)) {
              optimal = candidate * step;
              best = measurement;
              break;
            }
          }
          if (optimal === undefined && atLow.measurable && atLow.fitsBounds) blockedBy = atLow.outside;
        } else if (fits(atLow)) {
          let good = lo;
          let bad = hi;
          best = atLow;
          while (bad - good > 1) {
            const mid = Math.floor((good + bad) / 2);
            const measurement = measure(mid * step);
            if (fits(measurement)) {
              good = mid;
              best = measurement;
            } else bad = mid;
          }
          optimal = good * step;
        } else if (atLow.measurable && atLow.fitsBounds) blockedBy = atLow.outside;
      }
    }
    scaler.apply(original);
    if (!at.measurable) return undefined;
    return {
      kind,
      description: describe(target),
      index,
      zooms,
      current,
      currentMargin: at.lines,
      currentFitsBounds: at.fitsBounds,
      bottom: at.bottom,
      optimal,
      optimalBottom: best.bottom,
      blockedBy,
    };
  };

  const wrappers = zoomed.filter((element) => !zoomed.some((other) => other !== element && other.contains(element)));
  if (wrappers.length > 0) {
    // Wrappers are optimized in document order, each with the earlier ones already at their
    // optimum, so that the suggested values are consistent with each other.
    const originals = wrappers.map((wrapper) => wrapper.style.zoom);
    const analyses: ZoomAnalysis[] = [];
    for (const wrapper of wrappers) {
      const analysis = analyze(wrapper, 'wrapper', zoomed.indexOf(wrapper));
      if (!analysis) continue;
      analyses.push(analysis);
      if (analysis.optimal !== undefined) wrapper.style.zoom = String(analysis.optimal);
    }
    for (const [i, wrapper] of wrappers.entries()) wrapper.style.zoom = originals[i] ?? '';
    return analyses;
  }

  // Slidev (52.10 and later) applies the slide's frontmatter `zoom` (also one set through the headmatter's
  // `defaults`) to its page as this custom property, which it omits for `zoom: 1`; the parsed frontmatter
  // tells that one apart. Changing the property measures the slide as the author would by editing the
  // frontmatter, including what a theme keeps unscaled, on the layout itself so that no selector matches
  // differently. Older Slidev, which scales the page otherwise, and a zoom not written as a number
  // (`70%`, which Slidev scales without widening the page) keep the analysis of a slide without a zoom.
  const property = '--slidev-slide-zoom-scale';
  const page = layout.closest<HTMLElement>('.slidev-page');
  const usesProperty = page !== null && getComputedStyle(page).getPropertyValue(property).trim() !== '';
  const inline = page?.style.getPropertyValue(property).trim() ?? '';
  const pageZoom = inline === '' ? frontmatterZoom : /^\d*\.?\d+$/.test(inline) ? Number(inline) : undefined;
  // The zoom also scales elements excluded with `data-slidev-check-ignore`, which are not measured,
  // so a slide that holds one keeps the analysis of a slide without a zoom.
  const unmeasured = page !== null && page.querySelector('[data-slidev-check-ignore]') !== null;
  if (usesProperty && !unmeasured && pageZoom !== undefined && pageZoom > 0 && page && layout instanceof HTMLElement) {
    const attribute = page.getAttribute('style');
    decorations = new Set(
      [...page.querySelectorAll('*')].filter(
        (element) =>
          paints(element) && isPositioned(element) && fragments(element).some((rect) => isBackground(rect, bounds))
      )
    );
    const analysis = analyze(layout, 'frontmatter', -1, {
      current: pageZoom,
      original: String(pageZoom),
      apply: (zoom) => page.style.setProperty(property, zoom === '1' ? '' : zoom),
    });
    decorations = undefined;
    if (attribute === null) page.removeAttribute('style');
    else page.setAttribute('style', attribute);
    if (!analysis || (analysis.optimal !== undefined && Math.abs(analysis.optimal - analysis.current) < step / 2)) {
      return [];
    }
    return [analysis];
  }

  // Without a wrapper, the body below the heading is what a wrapper would zoom: it is wrapped
  // for the measurement so that the suggestion describes exactly what was measured.
  const heading = layout.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && heading.parentElement !== layout) return [];
  const children = [...layout.children];
  const body = children.filter(
    (child, i) => child instanceof HTMLElement && (!heading || i > children.indexOf(heading))
  );
  // A body made only of positioned elements has no flow to wrap.
  if (!body.some((child) => !isPositioned(child))) return [];
  const wrapper = document.createElement('div');
  body[0]?.before(wrapper);
  wrapper.append(...body);
  wrapper.style.zoom = '1';
  const analysis = analyze(wrapper, 'slide', -1);
  wrapper.replaceWith(...wrapper.childNodes);
  if (!analysis || (analysis.optimal !== undefined && analysis.optimal > analysis.current - step / 2)) return [];
  return [{ ...analysis, belowHeading: heading !== null }];
}

/* oxlint-enable unicorn/consistent-function-scoping */

const formatZoom = (zoom: number): string => zoom.toFixed(2).replace(/\.?0+$/, '');

const lines = (n: number): string => `${n} line${n === 1 ? '' : 's'}`;

/** Why the current zoom is too large, from the actual measurement. */
function describeExcess(analysis: ZoomAnalysis, marginLines: number): string {
  const { currentMargin, currentFitsBounds, bottom } = analysis;
  if (!currentFitsBounds) return 'sticks out of the slide';
  if (currentMargin < 0) return bottom === 'the slide bottom' ? 'overflows the slide bottom' : `overlaps ${bottom}`;
  return `leaves only ${currentMargin.toFixed(1)} lines of margin above ${bottom} (minimum ${marginLines})`;
}

/** Blanks out (keeping offsets) everything that is not markup: frontmatter, code, comments, and style sheets. */
const blank = (match: string): string => match.replaceAll(/[^\n]/g, ' ');
const markupOnly = (source: string): string =>
  source
    .replace(/^---\n[\s\S]*?\n---(?=\n|$)/, blank)
    // Fenced code (closed by a fence at least as long), indented code, code spans, comments, and sheets.
    .replaceAll(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n {0,3}\1[`~]*[ \t]*$/gm, blank)
    .replaceAll(/(?<=\n\n)(?:(?: {4}|\t)[^\n]*\n?)+/g, blank)
    .replaceAll(/(`+)(?:(?!\1)[^\n])+\1/g, blank)
    .replaceAll(/<!--[\s\S]*?-->|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, blank);

interface Declaration {
  /** Offset of `from` in the source. */
  index: number;
  from: string;
  /** Whether `from` is the plain declaration (no comment inside) that a one-line fix can replace. */
  fixable: boolean;
  property: string;
  value: number;
  percent: boolean;
}

/**
 * Splits a style value on `;` outside quoted strings, with comments blanked to spaces, keeping
 * every character so that offsets add up.
 */
function splitDeclarations(style: string): string[] {
  const parts: string[] = [];
  let quote: string | undefined;
  let start = 0;
  let text = '';
  for (let i = 0; i < style.length; i++) {
    const char = style[i] ?? '';
    if (quote) {
      text += char;
      if (char === '\\') text += style[++i] ?? '';
      else if (char === quote) quote = undefined;
    } else if (style.startsWith('/*', i)) {
      const end = style.indexOf('*/', i + 2);
      const stop = end === -1 ? style.length : end + 2;
      text += ' '.repeat(stop - i);
      i = stop - 1;
    } else if (char === '"' || char === "'") {
      quote = char;
      text += char;
    } else if (char === ';') {
      parts.push(text.slice(start, i));
      start = i + 1;
      text += char;
    } else text += char;
  }
  parts.push(text.slice(start));
  return parts;
}

/** The attributes of one HTML start tag, with the offset of each value in the source. */
function* attributesOf(tag: string, tagIndex: number): Generator<{ name: string; value: string; index: number }> {
  const base = tag.search(/[\s/>]/);
  for (const match of tag.slice(base).matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const [whole, name = '', double, single, bare] = match;
    const value = double ?? single ?? bare ?? '';
    const quoted = double !== undefined || single !== undefined;
    yield { name, value, index: tagIndex + base + match.index + whole.length - value.length - (quoted ? 1 : 0) };
  }
}

/** Whether the tag declares a Vue slot (`<template #name>` or `v-slot`). */
const isSlotTemplate = (tag: RegExpExecArray): boolean =>
  [...attributesOf(tag[0], tag.index)].some(({ name }) => name.startsWith('#') || /^v-slot\b/i.test(name));

/** An HTML start tag with its attributes (quoted values may contain `>`). */
const TAG = /<[a-zA-Z][^\s/>]*(?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;

/** The `zoom` declarations in the `style` attributes of the slide's markup, in source order. */
function zoomDeclarations(markup: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const tag of markup.matchAll(TAG)) {
    const attributes = [...attributesOf(tag[0], tag.index)];
    // An ignored element is not among the zoomed elements the rule analyzed.
    if (attributes.some((a) => a.name === 'data-slidev-check-ignore')) continue;
    for (const style of attributes.filter((a) => a.name.toLowerCase() === 'style')) {
      let offset = 0;
      for (const part of splitDeclarations(style.value)) {
        const declaration = /^(\s*zoom\s*:\s*)(\d*\.?\d+)(%?)\s*$/i.exec(part);
        if (declaration) {
          const [, property = '', value = '', percent = ''] = declaration;
          const leading = declaration[0].length - declaration[0].trimStart().length;
          const from = `${property.trimStart()}${value}${percent}`;
          declarations.push({
            index: style.index + offset + leading,
            // The text to replace is taken from the source; a comment inside the declaration
            // makes it differ from the match, and such a declaration is left to the author.
            from: style.value.slice(offset + leading, offset + leading + from.length),
            fixable: style.value.startsWith(from, offset + leading),
            property: property.trimStart(),
            value: Number.parseFloat(value) / (percent ? 100 : 1),
            percent: percent !== '',
          });
        }
        offset += part.length + 1;
      }
    }
  }
  return declarations;
}

/** Locates the `zoom` declaration of the wrapper in the slide's markdown so that it can be rewritten. */
function fixFor(analysis: ZoomAnalysis, source: string, firstLine: number): Fix | undefined {
  if (analysis.kind !== 'wrapper' || analysis.optimal === undefined) return undefined;
  // Slots (`::right::` blocks or `<template #right>`) render in the layout's template order, not
  // source order, so the declarations cannot be mapped to elements by position.
  const markup = markupOnly(source);
  if (/^::\s*[\w.\-:]+\s*::\s*$/m.test(markup) || [...markup.matchAll(TAG)].some(isSlotTemplate)) return undefined;
  const declarations = zoomDeclarations(markup);
  // The rewrite is only safe when the zoomed elements and the declarations line up one to one
  // with the same values; a bound style or a hidden element breaks that and gets no fix.
  if (
    declarations.length !== analysis.zooms.length ||
    declarations.some((declaration, i) => Math.abs(declaration.value - (analysis.zooms[i] ?? Number.NaN)) > 1e-6)
  )
    return undefined;
  const declaration = declarations[analysis.index];
  // A fix replaces text on one line; a declaration wrapped across lines is left to the author.
  if (!declaration || !declaration.fixable || declaration.from.includes('\n')) return undefined;
  const value = declaration.percent ? `${Math.round(analysis.optimal * 100)}%` : formatZoom(analysis.optimal);
  const before = source.slice(0, declaration.index);
  return {
    line: firstLine + before.split('\n').length - 1,
    column: declaration.index - (before.lastIndexOf('\n') + 1),
    from: declaration.from,
    to: `${declaration.property}${value}`,
  };
}

function toFinding(
  analysis: ZoomAnalysis,
  marginLines: number,
  source: string,
  firstLine: number
): SlideFinding | undefined {
  const { kind, description, current, optimal, bottom, optimalBottom, blockedBy } = analysis;
  const split = 'Consider splitting the content into multiple slides.';
  const unfit = blockedBy
    ? `cannot keep a margin of ${lines(marginLines)} above ${bottom} at any zoom down to ${MIN_ZOOM}, because \`${blockedBy}\` outside it already reaches that far`
    : `does not fit on the slide with a margin of ${lines(marginLines)} above ${bottom} at any zoom down to ${MIN_ZOOM}`;
  if (kind === 'frontmatter') {
    const zoomed = `The slide content with the frontmatter \`zoom: ${formatZoom(current)}\``;
    if (optimal === undefined) return { message: `${zoomed} ${unfit}.`, help: split };
    const suggestion = `zoom: ${formatZoom(optimal)}`;
    return {
      message:
        current < optimal
          ? `${zoomed} still keeps a margin of ${lines(marginLines)} above ${optimalBottom} at \`${suggestion}\`.`
          : `${zoomed} ${describeExcess(analysis, marginLines)}; \`${suggestion}\` keeps the margin above ${optimalBottom}.`,
      help: `Consider setting \`${suggestion}\` in the slide's frontmatter.`,
    };
  }
  if (kind === 'slide') {
    if (optimal === undefined) return { message: `The slide content ${unfit}.`, help: split };
    const wrapper = `<div style="zoom: ${formatZoom(optimal)}">`;
    return {
      message: `The slide content ${describeExcess(analysis, marginLines)}; wrapping it in \`${wrapper}\` keeps the margin.`,
      help: `Consider wrapping the ${analysis.belowHeading ? 'content below the heading' : 'slide content'} in \`${wrapper}\`.`,
    };
  }
  const element = `Element \`${description}\` is zoomed to ${formatZoom(current)}`;
  if (optimal === undefined) return { message: `${element} and ${unfit}.`, help: split };
  if (Math.abs(optimal - current) < ZOOM_STEP / 2) return undefined;
  const suggestion = `zoom: ${formatZoom(optimal)}`;
  return {
    message:
      current < optimal
        ? `${element} but still keeps a margin of ${lines(marginLines)} above ${optimalBottom} at ${suggestion}.`
        : `${element} and ${describeExcess(analysis, marginLines)}; ${suggestion} keeps the margin above ${optimalBottom}.`,
    help: `Consider setting \`${suggestion}\`.`,
    fix: fixFor(analysis, source, firstLine),
  };
}

export const optimalZoom: Rule = {
  id: 'optimal-zoom',
  defaultSetting: ['warn', { marginLines: DEFAULT_MARGIN_LINES, maxZoom: DEFAULT_MAX_ZOOM }],
  description:
    'A zoomed slide must use the largest zoom up to the maximum that keeps a margin above the slide bottom, unless a larger zoom still keeps it.',
  check: perSlide(async ({ page, containerSelector, options, source, slide, zoom }) => {
    const settings = {
      marginLines: Number(options?.['marginLines'] ?? DEFAULT_MARGIN_LINES),
      maxZoom: Number(options?.['maxZoom'] ?? DEFAULT_MAX_ZOOM),
    };
    const analyses = await page.evaluate(analyzeZoom, {
      containerSelector,
      frontmatterZoom: zoom,
      ...settings,
      minZoom: MIN_ZOOM,
      step: ZOOM_STEP,
    });
    return analyses
      .map((analysis) => toFinding(analysis, settings.marginLines, source, slide.line))
      .filter((finding) => finding !== undefined);
  }),
};
