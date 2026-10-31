// Captures de visite : garage, nuit, spots, mobile. node scripts/tour.mjs <url> <outdir>
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [url, out] = process.argv.slice(2);
const W = Number(process.env.W || 1100), H = Number(process.env.H || 620);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
async function session(opts, fn) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.setDefaultTimeout(150000);
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  await page.addInitScript(() => { try { const k = 'bikelife-street-kings-v1'; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ money: 60000, level: 9, settings: { quality: 'medium' } })); } catch {} });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 150000 });
  await fn(page);
  await ctx.close();
}
const ev = (page, s) => page.evaluate(s);
const settle = (page, n = 6) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await session({ viewport: { width: W, height: H } }, async (page) => {
  await page.click('text=Garage & personnalisation');
  await settle(page, 4);
  await page.screenshot({ path: `${out}/g1-garage.png` });
  await page.click('text=Concession');
  await page.click('text=Kronos 690 SMR');
  await settle(page, 4);
  await page.screenshot({ path: `${out}/g2-shop.png` });
  await page.click('text=Mes véhicules');
  await page.click('text=Sina Orbiter 50');
  await page.click('text=Peinture & déco');
  await page.click('text=Camouflage urbain');
  await settle(page, 4);
  await page.screenshot({ path: `${out}/g3-paint.png` });
  await page.click('text=Pilote');
  await page.click('text=Hoodie');
  await settle(page, 4);
  await page.screenshot({ path: `${out}/g4-rider.png` });
  await page.click('text=Annuler').catch(() => {});
  await page.click('text=Retour');
  // nuit au stunt park
  await ev(page, `(() => { const g = window.__game; g.setTime(22.5); g.startRide('stunt'); })()`);
  await settle(page, 10);
  await page.screenshot({ path: `${out}/n1-night-stunt.png` });
  await ev(page, `(() => { const g = window.__game; g.setTime(13); g.teleport('mx'); g.rig.mode='chase'; })()`);
  await settle(page, 10);
  await page.screenshot({ path: `${out}/d1-mx.png` });
  await ev(page, `(() => { const g = window.__game; g.setTime(18.6); g.teleport('downtown'); })()`);
  await settle(page, 10);
  await page.screenshot({ path: `${out}/d2-downtown.png` });
  await ev(page, `(() => { const g = window.__game; g.setWeather('rain'); g.setTime(15); g.atmo.wetness=1; g.teleport('cite'); })()`);
  await settle(page, 10);
  await page.screenshot({ path: `${out}/d3-rain-cite.png` });
  await ev(page, `(() => { const g = window.__game; g.setWeather('clear'); g.teleport('parking'); })()`);
  await settle(page, 10);
  await page.screenshot({ path: `${out}/d4-parking.png` });
  await ev(page, `(() => { const g = window.__game; g.teleport('underground'); })()`);
  await settle(page, 6);
  await page.screenshot({ path: `${out}/d5-underground-entry.png` });
});
await session({ ...devices['iPhone 13 landscape'] }, async (page) => {
  await page.screenshot({ path: `${out}/m0-menu.png` });
  await page.tap('text=ROULER EN VILLE');
  await settle(page, 8);
  await page.screenshot({ path: `${out}/m1-ride.png` });
});
console.log(logs.slice(0, 20).join('\n') || 'no errors');
await browser.close();
