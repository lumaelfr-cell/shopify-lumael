// Vérification rapide de l'éclairage : jour, pluie, nuit. node scripts/light.mjs <url> <outdir>
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 880, height: 495 } });
page.setDefaultTimeout(200000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript({ content: `try { localStorage.setItem('bikelife-street-kings-v1', JSON.stringify({ settings: { quality: '${process.env.Q || 'medium'}' } })); } catch (e) {}` });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 200000 });
const settle = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shots = (process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [['l1-day', 13, 'clear', 'downtown'], ['l2-rain', 15, 'rain', 'cite'], ['l3-night', 22.5, 'clear', 'stunt'], ['l4-dusk', 19.3, 'clear', 'boulevard']]);
for (const [name, t, w, spot] of shots) {
  await page.evaluate(([t, w, spot]) => { const g = window.__game; g.setWeather(w); g.atmo.wetness = w === 'rain' ? 1 : 0; g.setTime(t); g.startRide(spot); }, [t, w, spot]);
  await settle(8);
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(errs.join('\n') || 'no errors');
await browser.close();
