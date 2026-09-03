import type { Fix, Rule, RuleFinding } from '../types.ts';

const DEFAULT_MARGIN_LINES = 1;
const DEFAULT_MAX_ZOOM = 1;
/** Zoom values are searched and compared at this granularity. */
const ZOOM_STEP = 0.01;
/** Zoom values below this are not suggested: the content should be split instead. */
const MIN_ZOOM = 0.1;

interface ZoomAnalysis {
  /** `wrapper` for an element with an inline `zoom` style; `slide` for the body of a slide without one. */
  kind: 'wrapper' | 'slide';
  description: string;
  /** Position of the wrapper among all elements with an inline `zoom` style on the slide, in DOM order. */
  index: number;
  /** Resolved zooms of all elements with an inline `zoom` style on the slide, in DOM order. */
  zooms: number[];
  current: number;
  /** Lines of margin left above the bottom limit at the current zoom. */
  currentMargin: number;
  /** Whether the zoomed content stays within the left, right, and top edges of the slide at the current zoom. */
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
  marginLines,
  maxZoom,
  minZoom,
  step,
}: {
  containerSelector: string;
  marginLines: number;
  maxZoom: number;
  minZoom: number;
  step: number;
}): ZoomAnalysis[] {
  const { describe, fragments, textFragments, isChecked, paints, isBackground } = globalThis.__slidevCheck;
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
  const paintedRects = (element: Element): DOMRect[] => {
    if (!isChecked(element) || isSvgInternal(element)) return [];
    const decoration = paints(element) && isPositioned(element);
    const rects = paints(element) ? fragments(element) : textFragments(element);
    return rects.filter((rect) => rect.width > 0 && rect.height > 0 && !(decoration && isBackground(rect, bounds)));
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

  const analyze = (target: HTMLElement, kind: ZoomAnalysis['kind'], index: number): ZoomAnalysis | undefined => {
    const measure = (zoom: number): Measurement => {
      target.style.zoom = String(zoom);
      // The target scales with the zoom, and the rest of the flow moves with it; positioned
      // elements outside the target stay where they are and bound the space instead.
      const scaled = {
        top: Number.POSITIVE_INFINITY,
        left: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      };
      for (const element of [target, ...target.querySelectorAll('*')]) {
        for (const rect of paintedRects(element)) {
          scaled.top = Math.min(scaled.top, rect.top);
          scaled.left = Math.min(scaled.left, rect.left);
          scaled.right = Math.max(scaled.right, rect.right);
          scaled.bottom = Math.max(scaled.bottom, rect.bottom);
        }
      }
      const beside = (rect: DOMRect): boolean => rect.right <= scaled.left || rect.left >= scaled.right;
      // Flow content moves with the target unless it sits in another column beside it.
      let bottom = scaled.bottom;
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
        for (const element of [target, ...target.querySelectorAll('*')]) {
          if (paintedRects(element).some((rect) => rect.bottom >= bottom - 0.5)) lowest ??= element;
        }
      }
      let limit = bounds.bottom;
      let limitedBy: Element | undefined;
      for (const element of container.querySelectorAll('*')) {
        if (target.contains(element) || (layout.contains(element) && !isPositioned(element))) continue;
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
        measurable: line > 0 && scaled.right > scaled.left,
        lines: (limit - bottom) / line,
        fitsBounds: scaled.left >= bounds.left - 1 && scaled.right <= bounds.right + 1 && scaled.top >= bounds.top - 1,
        bottom: limitedBy ? `\`${describe(limitedBy)}\`` : 'the slide bottom',
        outside: lowest && !target.contains(lowest) ? describe(lowest) : undefined,
      };
    };
    const fits = (measurement: Measurement): boolean =>
      measurement.measurable && measurement.fitsBounds && measurement.lines >= marginLines - 1e-6;

    const original = target.style.zoom;
    const current = resolvedZoom(target);
    const at = measure(current);
    // The maximum only bounds suggestions: a deliberately larger zoom that still fits is left as it
    // is, so later wrappers are measured against it.
    if (current > maxZoom && fits(at)) {
      target.style.zoom = original;
      return undefined;
    }
    let optimal: number | undefined;
    let best = at;
    let blockedBy: string | undefined;
    if (at.measurable) {
      // Content height grows with the zoom (both the scale and the wrapping increase), so the
      // largest fitting zoom can be found by bisection over hundredths.
      const hi = Math.floor(maxZoom / step + 1e-9);
      const lo = Math.round(minZoom / step);
      const atHigh = measure(hi * step);
      if (fits(atHigh)) {
        optimal = hi * step;
        best = atHigh;
      } else {
        const atLow = measure(lo * step);
        if (fits(atLow)) {
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
    target.style.zoom = original;
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
): RuleFinding | undefined {
  const { kind, description, current, optimal, bottom, optimalBottom, blockedBy } = analysis;
  const split = 'Consider splitting the content into multiple slides.';
  const unfit = blockedBy
    ? `cannot keep a margin of ${lines(marginLines)} above ${bottom} at any zoom down to ${MIN_ZOOM}, because \`${blockedBy}\` outside it already reaches that far`
    : `does not fit on the slide with a margin of ${lines(marginLines)} above ${bottom} at any zoom down to ${MIN_ZOOM}`;
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
  description:
    'A zoomed slide must use the largest zoom up to the maximum that keeps a margin above the slide bottom, unless a larger zoom still keeps it.',
  check: async ({ page, containerSelector, options, source, slide }) => {
    const settings = {
      marginLines: Number(options?.['marginLines'] ?? DEFAULT_MARGIN_LINES),
      maxZoom: Number(options?.['maxZoom'] ?? DEFAULT_MAX_ZOOM),
    };
    const analyses = await page.evaluate(analyzeZoom, {
      containerSelector,
      ...settings,
      minZoom: MIN_ZOOM,
      step: ZOOM_STEP,
    });
    return analyses
      .map((analysis) => toFinding(analysis, settings.marginLines, source, slide.line))
      .filter((finding) => finding !== undefined);
  },
};
