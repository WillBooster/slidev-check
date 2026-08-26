import { createServer, resolveOptions } from '@slidev/cli';
import { chromium, type Browser, type Page } from 'playwright-chromium';
import { installBrowserHelpers } from './browser.ts';
import type { SlideLocation } from './types.ts';

export interface RenderOptions {
  entry: string;
  theme?: string;
  /** Milliseconds to wait after the page settles before auditing. */
  wait: number;
  /** Navigation timeout in milliseconds. */
  timeout: number;
}

export interface RenderedDeck {
  page: Page;
  slides: SlideLocation[];
  width: number;
  height: number;
  close: () => Promise<void>;
}

/**
 * Starts Slidev's own dev server and opens its print page in Chromium, the same
 * way `slidev export` does, so the audited DOM is exactly what Slidev renders.
 */
const debug = process.env['SLIDEV_AUDIT_DEBUG']
  ? (m: string) => console.error(`[audit-debug] ${Date.now() % 100_000} ${m}`)
  : () => {};

export async function renderDeck(options: RenderOptions): Promise<RenderedDeck> {
  debug('resolveOptions');
  const resolved = await resolveOptions({ entry: options.entry, theme: options.theme }, 'export');
  debug('createServer');
  const server = await createServer(resolved, {
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'silent',
    clearScreen: false,
  });
  debug('listen');
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address !== 'object') throw new Error('Failed to start the Slidev server.');

  const width = resolved.data.config.canvasWidth;
  const height = Math.round(width / resolved.data.config.aspectRatio);
  const slides: SlideLocation[] = resolved.data.slides.map((slide, index) => ({
    no: index + 1,
    filepath: slide.source.filepath,
    line: slide.source.start + 1,
    title: slide.title,
  }));

  let browser: Browser | undefined;
  const close = async (): Promise<void> => {
    debug('closing browser');
    await withTimeout(browser?.close() ?? Promise.resolve(), 10_000);
    // Vite's close() waits for open keep-alive connections and can hang; drop them first.
    const httpServer = server.httpServer as { closeAllConnections?: () => void } | null;
    httpServer?.closeAllConnections?.();
    debug('closing server');
    await withTimeout(server.close(), 10_000);
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
    return { page, slides, width, height, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** A wedged dev server can make close calls hang; never let that block the caller. */
function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return Promise.race([promise.catch(() => {}), new Promise((resolve) => setTimeout(resolve, ms).unref())]);
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
