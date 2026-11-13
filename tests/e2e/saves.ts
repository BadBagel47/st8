// Browser test of saving: save states, the resume state after a reload,
// backup and restore into a fresh browser profile. Run after "npm run build".

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { preview } from 'vite';
import { nesTestRom } from '../../src/selftest/roms.ts';

const PORT = 4176;
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const base = `http://localhost:${PORT}/`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const tmp = mkdtempSync(join(tmpdir(), 'st8-e2e-'));
const errors: string[] = [];
let failed = false;

function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) failed = true;
}

const rom = { name: 'test.nes', mimeType: 'application/octet-stream', buffer: Buffer.from(nesTestRom()) };

async function openPage(page: Page): Promise<void> {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForSelector('#open:not([disabled])', { timeout: 20000 });
}

async function openGame(page: Page): Promise<void> {
  await page.setInputFiles('#file', rom);
  await page.waitForSelector('#hint', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(300);
}

const pixel = (page: Page) =>
  page.evaluate(() => {
    const c = document.getElementById('screen') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(c.width >> 1, c.height >> 1, 1, 1).data;
    return `${d[0]},${d[1]},${d[2]}`;
  });

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await openPage(page);
  await openGame(page);

  // Quick save and load while paused.
  await page.click('#pause');
  await page.waitForTimeout(200);
  await page.keyboard.press('F2');
  await page.waitForSelector('#status:has-text("Saved to slot 1")');
  const saved = await pixel(page);
  let other = saved;
  for (let i = 0; i < 20 && other === saved; i++) {
    await page.click('#pause');
    await page.waitForTimeout(100 + i * 10);
    await page.click('#pause');
    await page.waitForTimeout(150);
    other = await pixel(page);
  }
  check(other !== saved, 'the picture moved on after saving');
  await page.keyboard.press('F4');
  await page.waitForSelector('#status:has-text("Loaded slot 1")');
  await page.waitForTimeout(200);
  check((await pixel(page)) === saved, 'loading slot 1 brings back the saved picture');
  await page.click('#pause');

  // The Saves dialog lists slot 1 with a thumbnail and can save to slot 2.
  await page.click('#saves');
  await page.waitForSelector('#saves-dialog img.thumb');
  const slot2 = page.locator('#saves-dialog .slot').nth(1);
  await slot2.getByText('Save here').click();
  await page.waitForSelector('#saves-dialog .slot:nth-child(2) img.thumb');
  check(true, 'Saves dialog shows slots with thumbnails and saves to slot 2');
  await page.click('#saves-dialog form button');

  // Reload: the game's own save and the resume state survive.
  await page.waitForTimeout(6000); // let the in-memory resume snapshot be taken
  await page.reload();
  await page.waitForSelector('#open:not([disabled])');
  await openGame(page);
  const offered = await page.waitForSelector('#notice:has-text("Continue where you left off")', { timeout: 5000 }).then(
    () => true,
    () => false,
  );
  check(offered, 'after a reload, continuing where you left off is offered');
  const pausedWhileAsking = (await page.textContent('#pause'))?.trim() === 'Resume';
  check(pausedWhileAsking, 'the game waits while asking');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);
  const afterContinue = (await page.textContent('#status'))?.trim() ?? '';
  check(afterContinue === '' && (await page.textContent('#pause'))?.trim() === 'Pause', `continuing resumes the game without errors${afterContinue ? `: ${afterContinue}` : ''}`);

  // Backup everything.
  await page.click('#saves');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Back up everything').click()]);
  const backupPath = join(tmp, download.suggestedFilename());
  await download.saveAs(backupPath);
  check(/^st8-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(download.suggestedFilename()), `backup downloaded as ${download.suggestedFilename()}`);
  await page.waitForSelector('#saves-dialog:has-text("Last full backup") >> text=/Last full backup: (?!never)/');
  await context.close();

  // Restore into a fresh profile.
  const fresh = await browser.newContext();
  const page2 = await fresh.newPage();
  await openPage(page2);
  await page2.click('#saves');
  const [chooser] = await Promise.all([page2.waitForEvent('filechooser'), page2.getByText('Restore from backup…').click()]);
  await chooser.setFiles(backupPath);
  await page2.waitForSelector('#status:has-text("Restored")');
  const status = await page2.textContent('#status');
  check(/Restored 1 save files and [3-9] save states/.test(status ?? ''), `restore reports what it brought back: "${status}"`);
  await page2.click('#saves-dialog form button');
  await openGame(page2);
  await page2.click('#saves');
  await page2.waitForSelector('#saves-dialog .slot:nth-child(2) img.thumb');
  check(true, 'restored slots appear for the game');
  const hasSaveFile = await page2.locator('#saves-dialog').getByText("The game's own save").count();
  check(hasSaveFile === 1, 'the restored game save file is there');
  await fresh.close();

  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.join(' | ') : ''}`);
} catch (err) {
  console.log('FAIL', err);
  failed = true;
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}
process.exit(failed ? 1 : 0);
