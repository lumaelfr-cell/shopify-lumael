// Test de bout en bout du tunnel d'achat Ulvéo, sans paiement.
//
// Parcours : fiche produit → sélecteur d'édition → ajout au panier → panier →
// bouton « Paiement » → page de paiement Shopify. Le script s'arrête AVANT
// toute saisie bancaire : il ne remplit jamais de carte et ne clique jamais
// sur « Payer ».
//
// Usage :
//   node tests/checkout-e2e.mjs                 # iPhone + ordinateur
//   node tests/checkout-e2e.mjs --fill-address  # + adresse de test pour voir
//                                               #   les frais de port et les
//                                               #   moyens de paiement proposés
//   BASE_URL=https://ulveo.fr OUT_DIR=./e2e-out node tests/checkout-e2e.mjs
//
// --fill-address crée un « panier abandonné » de test (e-mail @example.com)
// dans l'admin Shopify : c'est attendu, il peut être ignoré.

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'https://ulveo.fr';
const PRODUCT_PATH = '/products/scelleuse-de-sachets-magnetique-ulveo';
const OUT_DIR = process.env.OUT_DIR || 'e2e-out';
const FILL_ADDRESS = process.argv.includes('--fill-address');
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

// Messages connus de la page de paiement Shopify qui signalent un blocage côté
// boutique ou prestataire (et non côté client).
const BLOCKING_MESSAGES = [
  /ne peut pas accepter de paiements/i,
  /can.t accept payments/i,
  /n'accepte pas les paiements/i,
  /aucun moyen de paiement/i,
  /no payment methods/i,
  /mode test/i,
  /test mode/i,
  /aucune option de livraison|aucun mode de livraison|no shipping (methods|options)/i,
  /cette boutique n'est pas disponible|store (is )?unavailable/i,
];

const PROFILES = [
  { name: 'iphone', options: devices['iPhone 13'] },
  { name: 'desktop', options: { viewport: { width: 1366, height: 900 }, locale: 'fr-FR' } },
];

async function run(profile) {
  const dir = join(OUT_DIR, profile.name);
  mkdirSync(dir, { recursive: true });
  const log = { profile: profile.name, steps: [], consoleErrors: [], failedRequests: [], blockingMessages: [] };
  const step = (name, ok, detail = '') => {
    log.steps.push({ name, ok, detail });
    console.log(`[${profile.name}] ${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`);
  };

  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const context = await browser.newContext({ ...profile.options, locale: 'fr-FR' });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') log.consoleErrors.push(`${page.url()} :: ${msg.text()}`); });
  page.on('pageerror', (err) => log.consoleErrors.push(`${page.url()} :: ${err.message}`));
  page.on('requestfailed', (req) => log.failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.status() >= 400 && /\/cart|\/checkouts?|\/products\//.test(res.url())) {
      log.failedRequests.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    // 1-2. Fiche produit.
    const res = await page.goto(BASE_URL + PRODUCT_PATH, { waitUntil: 'domcontentloaded', timeout: 45000 });
    step('Fiche produit chargée', res?.ok() ?? false, `HTTP ${res?.status()}`);
    await page.screenshot({ path: join(dir, '1-produit.png'), fullPage: false });

    // Ferme la pop-up si elle est déjà ouverte (elle apparaît après 25 s).
    const closePopup = async () => {
      const close = page.locator('[data-ulveo-popup-close]').first();
      if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    };
    await closePopup();

    // 3. Sélecteur d'édition : la carte présélectionnée est utilisée telle quelle.
    const atc = page.locator('[data-bp-atc]').first();
    await atc.waitFor({ state: 'visible', timeout: 15000 });
    const label = (await atc.textContent())?.trim();
    const disabled = await atc.isDisabled();
    step('Bouton d\'ajout au panier visible et actif', !disabled, `« ${label} »`);

    // 4. Ajout au panier.
    const addResponse = page.waitForResponse((r) => r.url().includes('/cart/add'), { timeout: 15000 });
    await atc.click();
    const added = await addResponse.catch(() => null);
    step('Requête d\'ajout au panier', !!added && added.ok(), added ? `HTTP ${added.status()}` : 'aucune réponse');
    const bpError = (await page.locator('[data-bp-error]').first().textContent().catch(() => ''))?.trim();
    if (bpError) step('Message d\'erreur du sélecteur', false, bpError);

    // 5. Panier (le sélecteur redirige vers /cart si le tiroir n'est pas trouvé).
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    if (!/\/cart/.test(page.url())) {
      await page.goto(BASE_URL + '/cart', { waitUntil: 'domcontentloaded' });
    }
    await closePopup();
    const cart = await page.evaluate(() => fetch('/cart.js').then((r) => r.json()));
    step('Panier non vide', cart.item_count > 0, `${cart.item_count} article(s), ${(cart.total_price / 100).toFixed(2)} €`);
    await page.screenshot({ path: join(dir, '2-panier.png'), fullPage: true });

    const checkoutBtn = page.locator('button[name="checkout"]:visible').first();
    step('Bouton « Paiement » visible', await checkoutBtn.isVisible().catch(() => false));

    // 6. Page de paiement Shopify.
    await Promise.all([
      page.waitForURL(/\/checkouts?\//, { timeout: 30000 }),
      checkoutBtn.click(),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    step('Page de paiement ouverte', /\/checkouts?\//.test(page.url()), page.url().replace(/\?.*$/, ''));
    await page.screenshot({ path: join(dir, '3-paiement.png'), fullPage: true });

    const emailField = page.locator('input[type="email"], input[name="email"], #email').first();
    step('Champ e-mail présent', await emailField.isVisible().catch(() => false));

    if (FILL_ADDRESS) {
      await emailField.fill('test-tunnel@example.com');
      const fill = async (sel, value) => {
        const f = page.locator(sel).first();
        if (await f.isVisible().catch(() => false)) await f.fill(value);
      };
      await fill('input[name="lastName"]', 'Test');
      await fill('input[name="firstName"]', 'Tunnel');
      await fill('input[name="address1"]', '1 Rue de Rivoli');
      await fill('input[name="postalCode"]', '75001');
      await fill('input[name="city"]', 'Paris');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: join(dir, '4-paiement-adresse.png'), fullPage: true });
    }

    // 7-8. Livraison et moyens de paiement : on lit la page, sans rien payer.
    const text = await page.locator('body').innerText();
    for (const re of BLOCKING_MESSAGES) {
      const m = text.match(re);
      if (m) log.blockingMessages.push(m[0]);
    }
    step('Aucun message bloquant sur la page de paiement', log.blockingMessages.length === 0, log.blockingMessages.join(' | '));
    writeFileSync(join(dir, 'paiement.txt'), text);
  } catch (err) {
    step('Exception', false, err.message.split('\n')[0]);
    await page.screenshot({ path: join(dir, 'erreur.png'), fullPage: true }).catch(() => {});
  } finally {
    writeFileSync(join(dir, 'rapport.json'), JSON.stringify(log, null, 2));
    await browser.close();
  }
  return log;
}

const results = [];
for (const profile of PROFILES) results.push(await run(profile));
const failed = results.some((r) => r.steps.some((s) => !s.ok));
console.log(`\nRapports et captures : ${OUT_DIR}/`);
process.exit(failed ? 1 : 0);
