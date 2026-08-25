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
export async function renderDeck(options: RenderOptions): Promise<RenderedDeck> {
  const resolved = await resolveOptions({ entry: options.entry, theme: options.theme }, 'export');
  const server = await createServer(resolved, {
    server: { port: 0, host: '127.0.0.1' },
    logLevel: 'silent',
    clearScreen: false,
  });
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
  const close = async () => {
    await browser?.close();
    await server.close();
  };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width, height: height * Math.max(slides.length, 1) } });
    await page.goto(`http://127.0.0.1:${address.port}/print?print=true`, {
      waitUntil: 'networkidle',
      timeout: options.timeout,
    });
    await page.emulateMedia({ media: 'screen' });
    await waitForSlides(page, options.timeout);
    if (options.wait > 0) await page.waitForTimeout(options.wait);
    await installBrowserHelpers(page);
    return { page, slides, width, height, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/** Mirrors the waiting logic of `slidev export` so async content (Mermaid, Monaco, iframes) is settled. */
async function waitForSlides(page: Page, timeout: number): Promise<void> {
  await page.locator('.print-slide-container').first().waitFor({ timeout });
  await page.locator('.slidev-slide-loading').waitFor({ state: 'detached', timeout }).catch(() => undefined);
  for (const element of await page.locator('[data-waitfor]').all()) {
    const selector = await element.getAttribute('data-waitfor');
    if (selector) await element.locator(selector).waitFor({ state: 'visible', timeout }).catch(() => undefined);
  }
  await Promise.all(page.frames().map((frame) => frame.waitForLoadState(undefined, { timeout })));
  const mermaid = page.locator('#mermaid-rendering-container');
  if ((await mermaid.count()) > 0) {
    await mermaid.locator('div').first().waitFor({ state: 'detached', timeout }).catch(() => undefined);
    await mermaid.evaluate((node) => ((node as HTMLElement).style.display = 'none'));
  }
}
