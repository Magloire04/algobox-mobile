'use strict';

// Tests de bout en bout des parcours critiques, dans un vrai navigateur (Playwright).
// Lancement : npm run test:e2e (Playwright et Chromium doivent être installés).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticServer } = require('../../tools/staticServer.js');

const ROOT_DIRECTORY = path.resolve(__dirname, '..', '..');

test.describe('parcours critiques', () => {
  let server;
  let browser;
  let baseUrl;

  test.before(async () => {
    ({ server, url: baseUrl } = await startStaticServer(ROOT_DIRECTORY));
    browser = await chromium.launch();
  });

  test.after(async () => {
    await browser.close();
    server.close();
  });

  async function openApplication() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(baseUrl);
    return { context, page, pageErrors };
  }

  test('écrire un algorithme puis le tester avec une valeur saisie', async () => {
    const { context, page, pageErrors } = await openApplication();
    const confirm = () => page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('button', { name: 'Déclarer nouvelle variable' }).click();
    await page.locator('.modal input[type=text]').fill('n');
    await confirm();
    await page.locator('.tree-row', { hasText: 'DEBUT_ALGORITHME' }).click();
    await page.getByRole('button', { name: 'Ajouter LIRE variable' }).click();
    await confirm();
    await page.getByRole('button', { name: 'Ajouter AFFICHER Calcul' }).click();
    await page.locator('.modal input.mono').first().fill('n*2');
    await confirm();
    await page.locator('#testButton').click();
    await page.locator('#runButton').click();
    await page.locator('.console__input').fill('21');
    await page.locator('.console__input').press('Enter');
    await page.waitForFunction(() => document.getElementById('console').textContent.includes('terminé'));
    assert.match(await page.locator('#console').innerText(), /Entrer n : 21\s+42/);
    assert.deepEqual(pageErrors, []);
    await context.close();
  });

  test("l'application s'ouvre sans réseau après une première visite", async () => {
    const { context, page } = await openApplication();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('.tree-row', { hasText: 'DEBUT_ALGORITHME' }).count(), 1);
    await context.close();
  });
});
