import { createServer, resolveOptions } from '@slidev/cli';
import { raceWithTimeout } from '@willbooster/shared-lib';
import { type Browser, chromium, type Page } from 'playwright-chromium';
import { z } from 'zod';

import { installBrowserHelpers } from './browser.ts';
import { debug } from './debug.ts';
import { loadThemeRules } from './themeRules.ts';
import type { Rule, RuleSetting, SlideLocation } from './types.ts';

export interface RenderOptions {
  entry: string;
  theme?: string;
  /** Milliseconds to wait after the page settles before checking. */
  wait: number;
  /** Navigation timeout in milliseconds. */
  timeout: number;
}

export interface RenderedSlide extends SlideLocation {
  /** Markdown source of the slide, starting at `line`. */
  source: string;
  /** Reasons by rule id from the `slidevCheckIgnore` key of the slide's frontmatter. */
  ignores: Record<string, string>;
  /** The slide's `zoom` frontmatter, when it sets a positive number. */
  zoom: number | undefined;
}

export interface ResolvedDeck {
  options: Awaited<ReturnType<typeof resolveOptions>>;
  slides: RenderedSlide[];
  width: number;
  height: number;
  /** Rules shipped by the deck's theme. */
  themeRules: readonly Rule[];
  /** Rule settings from the `slidevCheck` key of the deck's headmatter. */
  settings: Partial<Record<string, RuleSetting>>;
}

export interface RenderedDeck {
  page: Page;
  close: () => Promise<void>;
}

const severitySchema = z.enum(['error', 'warn', 'off']);
const headmatterSettingsSchema = z.record(
  z.string(),
  z.union([severitySchema, z.tuple([severitySchema, z.record(z.string(), z.unknown())]).readonly()])
);
const ignoresSchema = z.record(z.string(), z.string().trim().min(1, 'Give the reason for ignoring the rule.'));

/** Parses the deck and loads its theme's rules without starting anything. */
export async function resolveDeck(options: RenderOptions): Promise<ResolvedDeck> {
  debug('resolveOptions');
  const resolved = await resolveOptions({ entry: options.entry, theme: options.theme }, 'export');
  const width = resolved.data.config.canvasWidth;
  return {
    options: resolved,
    slides: resolved.data.slides.map((slide, index) => ({
      no: index + 1,
      filepath: slide.source.filepath,
      line: slide.source.start + 1,
      title: slide.title,
      source: slide.source.raw,
      ignores: parseIgnores(slide.frontmatter['slidevCheckIgnore'], index + 1),
      zoom: parseZoom(slide.frontmatter['zoom']),
    })),
    width,
    height: Math.round(width / resolved.data.config.aspectRatio),
    themeRules: await loadThemeRules(resolved.themeRoots[0]),
    settings: headmatterSettingsSchema.parse(resolved.data.headmatter['slidevCheck'] ?? {}),
  };
}

function parseZoom(value: unknown): number | undefined {
  const zoom = Number(value);
  return value !== undefined && value !== null && Number.isFinite(zoom) && zoom > 0 ? zoom : undefined;
}

function parseIgnores(value: unknown, no: number): Record<string, string> {
  const result = ignoresSchema.safeParse(value ?? {});
  if (!result.success)
    throw new Error(
      `slidevCheckIgnore of slide ${no} must map rule ids to the reasons: ${z.prettifyError(result.error)}`
    );
  return result.data;
}

/**
 * Starts Slidev's own dev server and opens its print page in Chromium, the same
 * way `slidev export` does, so the checked DOM is exactly what Slidev renders.
 */
// code-gauge-allow functionNcss 36 -- the startup steps are sequential and share the server and browser handles.
export async function renderDeck(deck: ResolvedDeck, options: RenderOptions): Promise<RenderedDeck> {
  debug('createServer');
  const server = await createServer(deck.options, {
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'silent',
    clearScreen: false,
  });
  debug('listen');
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address !== 'object') throw new Error('Failed to start the Slidev server.');
  const { width, height, slides } = deck;

  let browser: Browser | undefined;
  const close = async (): Promise<void> => {
    debug('closing browser');
    // A wedged dev server can make close calls hang; never let that block the caller.
    await raceWithTimeout(browser?.close().catch(() => {}) ?? Promise.resolve(), 10_000);
    // Vite's close() waits for open keep-alive connections and can hang; drop them first.
    const httpServer = server.httpServer as { closeAllConnections?: () => void } | null;
    httpServer?.closeAllConnections?.();
    debug('closing server');
    await raceWithTimeout(
      server.close().catch(() => {}),
      10_000
    );
    debug('closed');
  };
  try {
    debug('launch');
    browser = await chromium.launch();
    debug('newPage');
    const page = await browser.newPage({ viewport: { width, height: height * Math.max(slides.length, 1) } });
    // 'networkidle' is flaky with Vite's dev server; navigate fast and wait for
    // concrete readiness signals in waitForSlides instead.
    debug('goto');
    await page.goto(`http://127.0.0.1:${address.port}/print?print=true`, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout,
    });
    await page.emulateMedia({ media: 'screen' });
    debug('waitForSlides');
    await waitForSlides(page, options.timeout);
    if (options.wait > 0) await page.waitForTimeout(options.wait);
    debug('installHelpers');
    await installBrowserHelpers(page);
    debug('ready');
    return { page, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Mirrors the waiting logic of `slidev export` so async content (Mermaid, Monaco, iframes) is settled. */
async function waitForSlides(page: Page, timeout: number): Promise<void> {
  await page.locator('.print-slide-container').first().waitFor({ timeout });
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  // Fonts and images change element geometry, so wait until they are settled.
  await page
    .waitForFunction(
      () => document.fonts.status !== 'loading' && [...document.images].every((image) => image.complete),
      undefined,
      { timeout }
    )
    .catch(() => {});
  await page
    .locator('.slidev-slide-loading')
    .waitFor({ state: 'detached', timeout })
    .catch(() => {});
  for (const element of await page.locator('[data-waitfor]').all()) {
    const selector = await element.getAttribute('data-waitfor');
    if (selector)
      await element
        .locator(selector)
        .waitFor({ state: 'visible', timeout })
        .catch(() => {});
  }
  await Promise.all(page.frames().map((frame) => frame.waitForLoadState(undefined, { timeout })));
  const mermaid = page.locator('#mermaid-rendering-container');
  if ((await mermaid.count()) > 0) {
    await mermaid
      .locator('div')
      .first()
      .waitFor({ state: 'detached', timeout })
      .catch(() => {});
    await mermaid.evaluate((node) => ((node as HTMLElement).style.display = 'none'));
  }
}
