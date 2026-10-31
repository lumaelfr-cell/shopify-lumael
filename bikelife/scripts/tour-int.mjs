// Captures des intérieurs (à pied). node scripts/tour-int.mjs <url> <outdir>
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(180000);
await page.addInitScript((q) => localStorage.setItem('bikelife-street-kings-v1', JSON.stringify({ money: 9000, level: 5, settings: { quality: q, showHelp: false, tutorialDone: true } })), process.env.Q || 'medium');
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[err] ${m.text()}`); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
await page.click('text=ROULER EN VILLE');
const frames = (n = 8) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { const g = window.__game; g.setTime(Number(new URLSearchParams(location.search).get('h') ?? 14)); g.teleport('garage'); });
await frames(10);
await page.keyboard.down('KeyF'); await frames(3); await page.keyboard.up('KeyF');
await frames(30);
const spots = (process.env.SPOTS ? JSON.parse(process.env.SPOTS) : [
  ['garage', -64, 0.2, 18.5, 0.1],
  ['garage2', -58, 0.2, 24, -0.9],
  ['atelier', -31, 0.2, 18.5, -0.15],
  ['concession', -61, 0.2, 51.5, 0.05],
  ['equipement', -17, 0.2, 63, -Math.PI / 2],
  ['superette', -237, 0.2, -47.5, Math.PI],
  ['fastfood', -203, 0.2, -32, Math.PI],
  ['hall', -321, 0.2, 26.2, 0.05],
  ['appart', -324.5, 3.6, 28.2, -Math.PI / 2],
  ['entrepot', 315, 0.2, -33, Math.PI],
  ['local', 305, 0.2, 25, 0.1],
]);
for (const [name, x, y, z, yaw] of spots) {
  await page.evaluate(([x, y, z, yaw]) => { const g = window.__game; g.walker.place(x, y, z, yaw); g.rig.snapFoot(yaw); }, [x, y, z, yaw]);
  await frames(14);
  await page.screenshot({ path: `${out}/int-${name}.png` });
}
console.log(logs.join('\n') || 'aucune erreur');
await browser.close();
