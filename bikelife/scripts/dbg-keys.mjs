import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.setDefaultTimeout(90000);
await page.addInitScript(() => localStorage.setItem('bikelife-street-kings-v1', JSON.stringify({ settings: { quality: 'low' } })));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.click('text=ROULER EN VILLE');
await page.waitForTimeout(500);
await page.keyboard.down('KeyW');
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(400);
  console.log(JSON.stringify(await page.evaluate(() => { const g = window.__game; const p = g.player.phys; return { keys: [...g.input.keys], kb: g.input.kbThrottle.toFixed(2), thrEff: p.engine.throttleEff.toFixed(2), rpm: p.rpm.toFixed(0), eng: p.engine.engagement.toFixed(2), kmh: p.kmh.toFixed(1), frozen: g.frozen, wreck: !!g.player.wreck, mode: g.mode.id, touch: g.input.touch.active, lastDevice: g.input.lastDevice }; })));
}
await browser.close();
