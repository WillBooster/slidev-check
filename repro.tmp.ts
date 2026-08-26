import { createServer, resolveOptions } from '@slidev/cli';
import { chromium } from 'playwright-chromium';
const entry = `${process.cwd()}/test/fixtures/clean.md`;
for (let i = 1; i <= 12; i++) {
  const t = performance.now();
  const step = (m: string) => console.log(`run ${i} ${m}: ${Math.round(performance.now() - t)}ms`);
  const resolved = await resolveOptions({ entry }, 'export');
  const server = await createServer(resolved, { server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent', clearScreen: false });
  await server.listen();
  step('listen');
  const address = server.httpServer!.address() as { port: number };
  const browser = await chromium.launch();
  step('launch');
  const page = await browser.newPage({ viewport: { width: 980, height: 552 * 2 } });
  step('newPage');
  const pending = new Set<string>();
  page.on('request', (r) => pending.add(r.url()));
  page.on('requestfinished', (r) => pending.delete(r.url()));
  page.on('requestfailed', (r) => { pending.delete(r.url()); console.log(`run ${i} REQFAIL ${r.url()} ${r.failure()?.errorText}`); });
  try {
    await page.goto(`http://127.0.0.1:${address.port}/print?print=true`, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    console.log(`run ${i} GOTO TIMEOUT; pending requests:`);
    for (const u of pending) console.log('  ', u);
    await browser.close(); server.httpServer?.closeAllConnections(); await server.close();
    continue;
  }
  step('goto');
  await page.emulateMedia({ media: 'screen' });
  await page.locator('.print-slide-container').first().waitFor({ timeout: 15000 });
  step('wait containers');
  await page.locator('.slidev-slide-loading').waitFor({ state: 'detached', timeout: 15000 }).catch(() => undefined);
  step('wait loading');
  for (const element of await page.locator('[data-waitfor]').all()) {
    const selector = await element.getAttribute('data-waitfor');
    if (selector) await element.locator(selector).waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
  }
  step('waitfor attrs');
  await Promise.all(page.frames().map((frame) => frame.waitForLoadState(undefined, { timeout: 15000 })));
  step('frames');
  const mermaid = page.locator('#mermaid-rendering-container');
  console.log(`run ${i} mermaid count: ${await mermaid.count()}`);
  step('mermaid');
  await page.evaluate(() => 1 + 1);
  step('evaluate');
  await browser.close();
  server.httpServer?.closeAllConnections();
  await server.close();
  step('closed');
}
process.exit(0);
