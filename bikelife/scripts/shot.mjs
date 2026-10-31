// Capture d'écran Playwright : node scripts/shot.mjs <url> <out.png> [w] [h]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, w = '1280', h = '720', wait = '1500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
const ready = await page.evaluate(() => (window).__ready ?? null);
await page.screenshot({ path: out });
console.log(JSON.stringify({ ready, logs: logs.slice(0, 30) }, null, 1));
await browser.close();
