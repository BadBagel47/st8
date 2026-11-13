// Browser smoke test of the built site (dist/): loads the page, opens a test
// ROM, checks that frames are drawn, that the keyboard reaches the game, and
// that the licences page lists the engine source. Run after "npm run build".
//
// Uses Playwright's Chromium. Set PW_CHROMIUM_PATH to use another Chromium binary.
// Set SCREENSHOT_DIR to save screenshots.

import { chromium } from 'playwright';
import { preview } from 'vite';
import { nesTestRom, snesTestRom } from '../../src/selftest/roms.ts';

const server = await preview({ preview: { port: 4174, strictPort: true }, logLevel: 'warn' });
const base = 'http://localhost:4174/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const errors: string[] = [];
let failed = false;

function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
}

try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(base);
  await page.waitForSelector('#open:not([disabled])', { timeout: 20000 });
  check(true, 'engine loads and the Open button is enabled');

  await page.setInputFiles('#file', { name: 'test.nes', mimeType: 'application/octet-stream', buffer: Buffer.from(nesTestRom()) });
  await page.waitForSelector('#hint', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(500);

  const pixel = () =>
    page.evaluate(() => {
      const c = document.getElementById('screen') as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
      return [d[0], d[1], d[2], c.width, c.height];
    });
  const a = await pixel();
  check(a[3] === 256 && a[4] >= 224, `frame size is ${a[3]}x${a[4]}`);
  // The colour cycles through the palette, where several entries are black,
  // so sample for a while and expect several different colours.
  const colours = new Set<string>();
  for (let i = 0; i < 10; i++) {
    colours.add((await pixel()).slice(0, 3).join());
    await page.waitForTimeout(110);
  }
  check(colours.size >= 3, `the picture changes over time (${colours.size} colours seen)`);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  const held = await pixel();
  await page.keyboard.up('ArrowRight');
  // Palette colour $01 in Mesen's default palette is #002A88.
  check(held.slice(0, 3).join() === '0,42,136', `holding Right shows colour $01 (got ${held.slice(0, 3)})`);

  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/play.png` });

  await page.click('#pause');
  await page.waitForTimeout(200); // let frames already on their way arrive
  const p1 = await pixel();
  await page.waitForTimeout(300);
  const p2 = await pixel();
  check(p1.join() === p2.join(), 'pause stops the picture');
  await page.click('#pause');

  // Switch to a SNES game: a different engine starts.
  await page.setInputFiles('#file', { name: 'test.sfc', mimeType: 'application/octet-stream', buffer: Buffer.from(snesTestRom()) });
  await page.waitForFunction(() => document.body.dataset.system === 'snes', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const s = await pixel();
  check(s[3] === 256 && s[4] === 224, `SNES frame size is ${s[3]}x${s[4]}`);
  const snesColours = new Set<string>();
  for (let i = 0; i < 8; i++) {
    snesColours.add((await pixel()).slice(0, 3).join());
    await page.waitForTimeout(110);
  }
  check(snesColours.size >= 3, `the SNES picture changes over time (${snesColours.size} colours seen)`);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  const r1 = (await pixel()).slice(0, 3).join();
  await page.waitForTimeout(300);
  const r2 = (await pixel()).slice(0, 3).join();
  await page.keyboard.up('ArrowRight');
  check(r1 === r2, 'holding Right on SNES gives a steady colour (the game sees the button)');

  // And back to NES.
  await page.setInputFiles('#file', { name: 'test.nes', mimeType: 'application/octet-stream', buffer: Buffer.from(nesTestRom()) });
  await page.waitForFunction(() => document.body.dataset.system === 'nes', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const n = await pixel();
  check(n[3] === 256 && n[4] === 240, 'switching back to NES works');

  await page.goto(`${base}licenses.html`);
  await page.waitForSelector('#engines h2', { timeout: 5000 });
  const text = await page.textContent('#engines');
  check(!!text?.includes('Mesen') && /\/tree\/[0-9a-f]{40}/.test(text), 'licences page links the exact Mesen source');
  check(!!text?.includes('Snes9x') && !!text?.includes('non-commercial'), 'licences page lists Snes9x and its non-commercial licence');
  const snesLicence = await page.request.get(`${base}licenses/snes9x-LICENSE.txt`);
  check(snesLicence.ok() && (await snesLicence.text()).includes('non-commercial'), 'Snes9x licence text is served');
  const gpl = await page.request.get(`${base}licenses/GPL-3.0.txt`);
  check(gpl.ok() && (await gpl.text()).includes('GNU GENERAL PUBLIC LICENSE'), 'GPL text is served');

  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (err) {
  console.log('FAIL', err);
  failed = true;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
process.exit(failed ? 1 : 0);
