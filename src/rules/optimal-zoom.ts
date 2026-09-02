import type { Fix, Rule, RuleFinding } from '../types.ts';

const DEFAULT_MARGIN_LINES = 1;
const DEFAULT_MAX_ZOOM = 1;
/** Zoom values are searched and compared at this granularity. */
const ZOOM_STEP = 0.01;
/** Zoom values below this are not suggested: the content should be split instead. */
const MIN_ZOOM = 0.1;
/** Painted boxes covering at least this share of the slide are treated as backgrounds and ignored. */
const BACKGROUND_AREA_RATIO = 0.8;

interface ZoomAnalysis {
  /** `wrapper` for an element with an inline `zoom` style; `slide` for the content of a slide without one. */
  kind: 'wrapper' | 'slide';
  description: string;
  /** Position of the wrapper among all elements with an inline `zoom` style on the slide, in DOM order. */
  index: number;
  /** Number of elements with an inline `zoom` style on the slide. */
  count: number;
  current: number;
  /** Lines of margin left above the bottom limit at the current zoom. */
  currentMargin: number;
  /** Largest zoom keeping the required margin, or `undefined` if none does. */
  optimal: number | undefined;
}

function analyzeZoom({
  containerSelector,
  marginLines,
  maxZoom,
  minZoom,
  step,
  backgroundRatio,
}: {
  containerSelector: string;
  marginLines: number;
  maxZoom: number;
  minZoom: number;
  step: number;
  backgroundRatio: number;
}): ZoomAnalysis[] {
  const { describe, fragments, textFragments, isChecked } = globalThis.__slidevCheck;
  const container = document.querySelector(containerSelector);
  const layout = container?.querySelector('.slidev-layout');
  // The cover/intro layouts center their content; a zoom only serves body slides.
  if (!container || !layout || layout.matches('.cover, .intro')) return [];
  const bounds = container.getBoundingClientRect();

  const REPLACED = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'IFRAME', 'svg']);
  const paints = (element: Element, style: CSSStyleDeclaration): boolean =>
    REPLACED.has(element.tagName) ||
    (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
    style.backgroundImage !== 'none' ||
    ['top', 'right', 'bottom', 'left'].some(
      (side) =>
        Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
        style.getPropertyValue(`border-${side}-style`) !== 'none'
    );
  /** Painted pieces of one element: its text lines, and its boxes when it paints a background, border, or image. */
  const paintedRects = (element: Element): DOMRect[] => {
    if (!isChecked(element) || (element.closest('svg') && element.tagName !== 'svg')) return [];
    const rects = paints(element, getComputedStyle(element)) ? fragments(element) : textFragments(element);
    return rects.filter((rect) => rect.width > 0 && rect.height > 0);
  };
  const isPositioned = (element: Element): boolean => {
    for (let current: Element | null = element; current && current !== layout; current = current.parentElement) {
      const position = getComputedStyle(current).position;
      if (position === 'absolute' || position === 'fixed') return true;
    }
    return false;
  };

  const zoomed = [...layout.querySelectorAll('*')].filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element.style.zoom !== ''
  );
  const wrappers = zoomed.filter((element) => !zoomed.some((other) => other !== element && other.contains(element)));

  /** Fixed things below the content (a theme's footer or brand bar) bound the usable height. */
  const bottomLimit = (targets: Element[]): number => {
    let top = Number.POSITIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
    let limit = bounds.bottom;
    for (const element of container.querySelectorAll('*')) {
      const inContent = layout.contains(element) && !isPositioned(element);
      if (inContent || targets.some((target) => target.contains(element))) continue;
      for (const rect of paintedRects(element)) {
        if ((rect.width * rect.height) / (bounds.width * bounds.height) >= backgroundRatio) continue;
        if (rect.top < top || rect.right <= left || rect.left >= right) continue;
        limit = Math.min(limit, rect.top);
      }
    }
    return limit;
  };

  /** Height of one text line inside the targets, measured with a probe so that it follows the zoom. */
  const lineHeight = (targets: Element[]): number => {
    const host =
      targets.flatMap((target) => [target, ...target.querySelectorAll('*')]).find((e) => textFragments(e).length > 0) ??
      targets[0];
    if (!host) return Number.NaN;
    const probe = document.createElement('div');
    probe.textContent = 'X';
    probe.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap;';
    host.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  };

  const analyze = (targets: HTMLElement[], kind: ZoomAnalysis['kind'], index: number): ZoomAnalysis | undefined => {
    const others = zoomed.filter((element) => !targets.some((target) => target.contains(element)));
    /** Content that moves with the zoom: the targets and the rest of the flow outside other zoomed elements. */
    const content = [...layout.querySelectorAll('*')].filter(
      (element) =>
        !isPositioned(element) &&
        (targets.some((target) => target.contains(element)) || !others.some((other) => other.contains(element)))
    );
    const limit = bottomLimit(targets);
    const originals = targets.map((target) => target.style.zoom);
    const margin = (zoom: number): { lines: number; fitsWidth: boolean } => {
      for (const target of targets) target.style.zoom = String(zoom);
      let bottom = Number.NEGATIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      for (const element of content) {
        for (const rect of paintedRects(element)) {
          bottom = Math.max(bottom, rect.bottom);
          right = Math.max(right, rect.right);
        }
      }
      return { lines: (limit - bottom) / lineHeight(targets), fitsWidth: right <= bounds.right + 1 };
    };
    const fits = (hundredths: number): boolean => {
      const { lines, fitsWidth } = margin(hundredths / 100);
      return fitsWidth && lines >= marginLines - 1e-6;
    };
    const restore = (): void => {
      for (const [i, target] of targets.entries()) target.style.zoom = originals[i] ?? '';
    };

    const current =
      originals[0] === '' ? 1 : Number.parseFloat(originals[0] ?? '1') / (originals[0]?.endsWith('%') ? 100 : 1);
    const currentMargin = margin(current).lines;
    // Content height grows with the zoom (both the scale and the wrapping increase), so the
    // largest fitting zoom can be found by bisection over hundredths.
    let optimal: number | undefined;
    const hi = Math.round(maxZoom / step);
    const lo = Math.round(minZoom / step);
    if (fits(hi)) optimal = hi * step;
    else if (fits(lo)) {
      let good = lo;
      let bad = hi;
      while (bad - good > 1) {
        const mid = Math.floor((good + bad) / 2);
        if (fits(mid)) good = mid;
        else bad = mid;
      }
      optimal = good * step;
    }
    restore();
    if (optimal !== undefined) optimal = Math.round(optimal / step) * step;
    if (kind === 'slide' && optimal !== undefined && optimal >= maxZoom) return undefined;
    return {
      kind,
      description: describe(targets[0] ?? layout),
      index,
      count: zoomed.length,
      current,
      currentMargin,
      optimal,
    };
  };

  if (wrappers.length > 0) {
    return wrappers
      .map((wrapper) => analyze([wrapper], 'wrapper', zoomed.indexOf(wrapper)))
      .filter((analysis) => analysis !== undefined);
  }
  // Without a wrapper, the body below the heading is what a wrapper would zoom.
  const children = [...layout.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  const heading = children.findIndex((child) => /^H[1-6]$/.test(child.tagName));
  const body = children.slice(heading + 1).filter((child) => !isPositioned(child));
  if (body.length === 0) return [];
  const analysis = analyze(body, 'slide', -1);
  return analysis ? [analysis] : [];
}

const formatZoom = (zoom: number): string => zoom.toFixed(2).replace(/\.?0+$/, '');

const lines = (n: number): string => `${n} line${n === 1 ? '' : 's'}`;

const describeMargin = (margin: number, minimum: number): string =>
  margin < 0
    ? 'overflows the slide bottom'
    : `leaves only ${margin.toFixed(1)} lines of margin above the slide bottom (minimum ${minimum})`;

/** Locates the `zoom:` declaration of the wrapper in the slide's markdown so that it can be rewritten. */
function fixFor(analysis: ZoomAnalysis, source: string, firstLine: number): Fix | undefined {
  if (analysis.kind !== 'wrapper' || analysis.optimal === undefined) return undefined;
  const declarations = [...source.matchAll(/zoom:(\s*)(\d*\.?\d+)(%?)/g)];
  // The rewrite is only safe when every zoomed element comes from the markdown, in the same order.
  if (declarations.length !== analysis.count) return undefined;
  const declaration = declarations[analysis.index];
  if (!declaration) return undefined;
  const [from, spacing = '', value = '', percent = ''] = declaration;
  const declared = Number.parseFloat(value) / (percent ? 100 : 1);
  if (Math.abs(declared - analysis.current) > 1e-6) return undefined;
  const to = `zoom:${spacing}${percent ? `${Math.round(analysis.optimal * 100)}%` : formatZoom(analysis.optimal)}`;
  const line = firstLine + source.slice(0, declaration.index).split('\n').length - 1;
  return { line, from, to };
}

function toFinding(
  analysis: ZoomAnalysis,
  marginLines: number,
  source: string,
  firstLine: number
): RuleFinding | undefined {
  const { kind, description, current, currentMargin, optimal } = analysis;
  const split = 'Consider splitting the content into multiple slides.';
  if (kind === 'slide') {
    if (optimal === undefined) {
      return {
        message: `The slide content ${describeMargin(currentMargin, marginLines)} and does not fit with that margin at any zoom down to ${MIN_ZOOM}.`,
        help: split,
      };
    }
    const wrapper = `<div style="zoom: ${formatZoom(optimal)}">`;
    return {
      message: `The slide content ${describeMargin(currentMargin, marginLines)}; wrapping it in \`${wrapper}\` keeps the margin.`,
      help: `Consider wrapping the content below the heading in \`${wrapper}\`.`,
    };
  }
  const element = `Element \`${description}\` is zoomed to ${formatZoom(current)}`;
  if (optimal === undefined) {
    return {
      message: `${element} and does not fit with a margin of ${lines(marginLines)} above the slide bottom at any zoom down to ${MIN_ZOOM}.`,
      help: split,
    };
  }
  if (Math.abs(optimal - current) < ZOOM_STEP / 2) return undefined;
  const suggestion = `zoom: ${formatZoom(optimal)}`;
  return {
    message:
      current < optimal
        ? `${element} but still keeps a margin of ${lines(marginLines)} above the slide bottom at ${suggestion}.`
        : `${element} and ${describeMargin(currentMargin, marginLines)}; ${suggestion} keeps the margin.`,
    help: `Consider setting \`${suggestion}\`.`,
    fix: fixFor(analysis, source, firstLine),
  };
}

export const optimalZoom: Rule = {
  id: 'optimal-zoom',
  description: 'A zoomed slide must use the largest zoom that keeps a margin above the slide bottom.',
  check: async ({ page, containerSelector, options, source, slide }) => {
    const marginLines = Number(options?.['marginLines'] ?? DEFAULT_MARGIN_LINES);
    const analyses = await page.evaluate(analyzeZoom, {
      containerSelector,
      marginLines,
      maxZoom: Number(options?.['maxZoom'] ?? DEFAULT_MAX_ZOOM),
      minZoom: MIN_ZOOM,
      step: ZOOM_STEP,
      backgroundRatio: BACKGROUND_AREA_RATIO,
    });
    return analyses
      .map((analysis) => toFinding(analysis, marginLines, source, slide.line))
      .filter((finding) => finding !== undefined);
  },
};
