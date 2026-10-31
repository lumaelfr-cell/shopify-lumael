// Test de bout en bout dans Chromium (rendu logiciel lent : on attend des conditions de jeu)
// node scripts/play.mjs <url> <outdir> [scenario]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [url, out, scen = 'ride'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 540) } });
page.setDefaultTimeout(120000);
const q = process.env.Q || 'low';
await page.addInitScript((q) => { try { const k = 'bikelife-street-kings-v1'; if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ settings: { quality: q, showHelp: true } })); } catch {} }, q);
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
logs.push(`ready after ${Date.now() - t0} ms`);
await page.waitForTimeout(1000);
const shot = async (n) => page.screenshot({ path: `${out}/${n}.png` });
const info = async () => page.evaluate(() => { const g = window.__game; const p = g.player.phys; return { state: g.state, x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1), kmh: +p.kmh.toFixed(1), st: p.state, pitch: +(p.pitch * 57.3).toFixed(1), crashed: p.crashed, reason: p.crashReason, gear: p.engine.gear, rpm: Math.round(p.rpm), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
const waitFor = (fn, arg, t = 120000) => page.waitForFunction(fn, arg, { timeout: t, polling: 100 }).catch(() => logs.push('timeout: ' + fn.toString().slice(0, 80)));
await shot('01-menu');
if (scen === 'menu') { console.log(logs.join('\n')); await browser.close(); process.exit(0); }
await page.click('text=ROULER EN VILLE');
await page.waitForTimeout(500);
await shot('02-ride');
if (scen === 'ride' || scen === 'wheelie') {
  await page.keyboard.down('KeyW');
  await waitFor(() => window.__game.player.phys.kmh > 25);
  logs.push('accel: ' + JSON.stringify(await info()));
  await shot('03-accel');
  if (scen === 'wheelie') {
    await page.keyboard.up('KeyW');
    await waitFor(() => window.__game.player.phys.kmh < 18);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await waitFor(() => window.__game.player.phys.rpm > 9000);
    await page.keyboard.up('ShiftLeft');
    await waitFor(() => window.__game.player.phys.pitch > 0.4 || window.__game.player.phys.crashed);
    logs.push('wheelie: ' + JSON.stringify(await info()));
    await shot('04-wheelie');
    await page.waitForTimeout(2500);
    logs.push('wheelie+: ' + JSON.stringify(await info()));
    await shot('05-wheelie2');
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS');
  await waitFor(() => window.__game.player.phys.kmh < 3);
  await page.keyboard.up('KeyS');
  logs.push('stop: ' + JSON.stringify(await info()));
  await shot('06-stop');
}
console.log(logs.join('\n'));
await browser.close();
