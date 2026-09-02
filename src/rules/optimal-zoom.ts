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
  /** Number of elements with an inline `zoom` style on the slide. */
  count: number;
  current: number;
  /** Lines of margin left above the bottom limit at the current zoom. */
  currentMargin: number;
  /** Whether the zoomed content stays within the slide width at the current zoom. */
  currentFitsWidth: boolean;
  /** Largest zoom keeping the required margin, or `undefined` if none does. */
  optimal: number | undefined;
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
  /** Painted pieces of one element: its text lines, and its boxes when it paints a background, border, or image. */
  const paintedRects = (element: Element): DOMRect[] => {
    if (!isChecked(element) || isSvgInternal(element)) return [];
    const rects = paints(element) ? fragments(element) : textFragments(element);
    return rects.filter((rect) => rect.width > 0 && rect.height > 0);
  };
  const isPositioned = (element: Element): boolean => {
    for (let current: Element | null = element; current && current !== layout; current = current.parentElement) {
      const position = getComputedStyle(current).position;
      if (position === 'absolute' || position === 'fixed') return true;
    }
    return false;
  };
  const resolvedZoom = (element: Element): number => {
    const zoom = Number.parseFloat(getComputedStyle(element).zoom);
    return Number.isFinite(zoom) ? zoom : 1;
  };
  /** Height of one text line at the element, measured with a probe so that it follows the zoom. */
  const lineHeightAt = (element: Element): number => {
    let host: Element | null = element;
    while (host && !(host instanceof HTMLElement && !isSvgInternal(host))) host = host.parentElement;
    if (!host) return Number.NaN;
    const probe = document.createElement('div');
    probe.textContent = 'X';
    probe.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap;';
    host.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  };

  const zoomed = [...layout.querySelectorAll('*')].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.style.zoom !== '' && isChecked(element)
  );

  const analyze = (targets: HTMLElement[], kind: ZoomAnalysis['kind'], index: number): ZoomAnalysis | undefined => {
    const inTargets = (element: Element): boolean => targets.some((target) => target.contains(element));
    const measure = (zoom: number): { measurable: boolean; lines: number; fitsWidth: boolean } => {
      for (const target of targets) target.style.zoom = String(zoom);
      // The targets scale with the zoom, and the rest of the flow moves with them; positioned
      // elements outside the targets stay where they are and bound the space instead.
      let bottom = Number.NEGATIVE_INFINITY;
      let lowest: Element | undefined;
      const scaled = { top: Number.POSITIVE_INFINITY, left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY };
      for (const element of layout.querySelectorAll('*')) {
        const inside = inTargets(element);
        if (!inside && isPositioned(element)) continue;
        for (const rect of paintedRects(element)) {
          if (rect.bottom > bottom) {
            bottom = rect.bottom;
            lowest = element;
          }
          if (!inside) continue;
          scaled.top = Math.min(scaled.top, rect.top);
          scaled.left = Math.min(scaled.left, rect.left);
          scaled.right = Math.max(scaled.right, rect.right);
        }
      }
      let limit = bounds.bottom;
      for (const element of container.querySelectorAll('*')) {
        if (inTargets(element) || (layout.contains(element) && !isPositioned(element))) continue;
        for (const rect of paintedRects(element)) {
          if (
            isBackground(rect, bounds) ||
            rect.top < scaled.top ||
            rect.right <= scaled.left ||
            rect.left >= scaled.right
          )
            continue;
          limit = Math.min(limit, rect.top);
        }
      }
      // The margin is counted in lines of the text right above it, whichever element that is,
      // so that wrappers with different text sizes agree on how much space is left.
      const line = lowest ? lineHeightAt(lowest) : Number.NaN;
      return {
        measurable: line > 0,
        lines: (limit - bottom) / line,
        fitsWidth: scaled.right <= bounds.right + 1,
      };
    };
    const fits = (hundredths: number): boolean => {
      const { measurable, lines, fitsWidth } = measure(hundredths * step);
      return measurable && fitsWidth && lines >= marginLines - 1e-6;
    };

    const originals = targets.map((target) => target.style.zoom);
    const current = resolvedZoom(targets[0] ?? layout);
    const at = measure(current);
    let optimal: number | undefined;
    if (at.measurable) {
      // Content height grows with the zoom (both the scale and the wrapping increase), so the
      // largest fitting zoom can be found by bisection over hundredths.
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
    }
    for (const [i, target] of targets.entries()) target.style.zoom = originals[i] ?? '';
    if (!at.measurable) return undefined;
    if (optimal !== undefined) optimal = Math.round(optimal / step) * step;
    return {
      kind,
      description: describe(targets[0] ?? layout),
      index,
      count: zoomed.length,
      current,
      currentMargin: at.lines,
      currentFitsWidth: at.fitsWidth,
      optimal,
    };
  };

  const wrappers = zoomed.filter((element) => !zoomed.some((other) => other !== element && other.contains(element)));
  if (wrappers.length > 0) {
    // Wrappers are optimized in document order, each with the earlier ones already at their
    // optimum, so that the suggested values are consistent with each other.
    const originals = wrappers.map((wrapper) => wrapper.style.zoom);
    const analyses: ZoomAnalysis[] = [];
    for (const wrapper of wrappers) {
      const analysis = analyze([wrapper], 'wrapper', zoomed.indexOf(wrapper));
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
  const analysis = analyze([wrapper], 'slide', -1);
  wrapper.replaceWith(...wrapper.childNodes);
  return analysis && (analysis.optimal === undefined || analysis.optimal < maxZoom) ? [analysis] : [];
}

/* oxlint-enable unicorn/consistent-function-scoping */

const formatZoom = (zoom: number): string => zoom.toFixed(2).replace(/\.?0+$/, '');

const lines = (n: number): string => `${n} line${n === 1 ? '' : 's'}`;

/** Why the current zoom is too large, from the actual measurement. */
function describeExcess(analysis: ZoomAnalysis, marginLines: number, maxZoom: number): string {
  const { current, currentMargin, currentFitsWidth } = analysis;
  if (current > maxZoom) return `exceeds the maximum zoom of ${formatZoom(maxZoom)}`;
  if (!currentFitsWidth) return 'is wider than the slide';
  if (currentMargin < 0) return 'overflows the slide bottom';
  return `leaves only ${currentMargin.toFixed(1)} lines of margin above the slide bottom (minimum ${marginLines})`;
}

/** Blanks out code and comments (keeping offsets) so that only real `zoom:` declarations are matched. */
const withoutCode = (source: string): string =>
  source.replaceAll(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|<!--[\s\S]*?-->/g, (match) =>
    match.replaceAll(/[^\n]/g, ' ')
  );

/** Locates the `zoom:` declaration of the wrapper in the slide's markdown so that it can be rewritten. */
function fixFor(analysis: ZoomAnalysis, source: string, firstLine: number): Fix | undefined {
  if (analysis.kind !== 'wrapper' || analysis.optimal === undefined) return undefined;
  const declarations = [...withoutCode(source).matchAll(/zoom:([ \t]*)(\d*\.?\d+)(%?)/g)];
  // The rewrite is only safe when every zoomed element comes from the markdown, in the same order.
  if (declarations.length !== analysis.count) return undefined;
  const declaration = declarations[analysis.index];
  if (!declaration) return undefined;
  const [from, spacing = '', value = '', percent = ''] = declaration;
  const declared = Number.parseFloat(value) / (percent ? 100 : 1);
  if (Math.abs(declared - analysis.current) > 1e-6) return undefined;
  const to = `zoom:${spacing}${percent ? `${Math.round(analysis.optimal * 100)}%` : formatZoom(analysis.optimal)}`;
  const before = source.slice(0, declaration.index);
  const lineStart = before.lastIndexOf('\n') + 1;
  return { line: firstLine + before.split('\n').length - 1, column: declaration.index - lineStart, from, to };
}

function toFinding(
  analysis: ZoomAnalysis,
  { marginLines, maxZoom }: { marginLines: number; maxZoom: number },
  source: string,
  firstLine: number
): RuleFinding | undefined {
  const { kind, description, current, optimal } = analysis;
  const split = 'Consider splitting the content into multiple slides.';
  const unfit = `does not fit within the slide width with a margin of ${lines(marginLines)} above the slide bottom at any zoom down to ${MIN_ZOOM}`;
  if (kind === 'slide') {
    if (optimal === undefined) return { message: `The slide content ${unfit}.`, help: split };
    const wrapper = `<div style="zoom: ${formatZoom(optimal)}">`;
    return {
      message: `The slide content ${describeExcess(analysis, marginLines, maxZoom)}; wrapping it in \`${wrapper}\` keeps the margin.`,
      help: `Consider wrapping the content below the heading in \`${wrapper}\`.`,
    };
  }
  const element = `Element \`${description}\` is zoomed to ${formatZoom(current)}`;
  if (optimal === undefined) return { message: `${element} and ${unfit}.`, help: split };
  if (Math.abs(optimal - current) < ZOOM_STEP / 2) return undefined;
  const suggestion = `zoom: ${formatZoom(optimal)}`;
  return {
    message:
      current < optimal
        ? `${element} but still keeps a margin of ${lines(marginLines)} above the slide bottom at ${suggestion}.`
        : `${element} and ${describeExcess(analysis, marginLines, maxZoom)}; ${suggestion} keeps the margin.`,
    help: `Consider setting \`${suggestion}\`.`,
    fix: fixFor(analysis, source, firstLine),
  };
}

export const optimalZoom: Rule = {
  id: 'optimal-zoom',
  description: 'A zoomed slide must use the largest zoom that keeps a margin above the slide bottom.',
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
      .map((analysis) => toFinding(analysis, settings, source, slide.line))
      .filter((finding) => finding !== undefined);
  },
};
