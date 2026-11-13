// Desktop self-test (ST8_SELFTEST=1): plays both test ROMs in the real app
// window and checks video, saves and storage. Used in CI for Mac and Linux.

import { exportBackup, restoreBackup } from '../web/backup';
import type { Session } from '../web/session';
import { MemoryStore } from '../web/storage/memory';
import type { SaveStore } from '../web/storage/types';
import { nesTestRom, snesTestRom } from './roms';

interface Ctx {
  /** Opens a game the way the Open button does; returns an error message or null. */
  open(name: string, bytes: Uint8Array): Promise<string | null>;
  session: Session;
  store: SaveStore;
  canvas: HTMLCanvasElement;
  audioAvailable: boolean;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runSelfTest({ open, session, store, canvas, audioAvailable }: Ctx): Promise<{ passed: boolean; report: string }> {
  const lines: string[] = [];
  let passed = true;
  const check = (ok: boolean, what: string) => {
    lines.push(`${ok ? 'PASS' : 'FAIL'} ${what}`);
    if (!ok) passed = false;
  };
  const ctx2d = canvas.getContext('2d')!;
  const pixel = () => [...ctx2d.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data.slice(0, 3)].join(',');
  const colours = async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(pixel());
      await wait(110);
    }
    return seen.size;
  };

  try {
    for (const [name, bytes, size] of [
      ['selftest.nes', nesTestRom(), '256x240'],
      ['selftest.sfc', snesTestRom(), '256x224'],
    ] as const) {
      const error = await open(name, bytes);
      check(error === null, `${name} starts${error ? `: ${error}` : ''}`);
      session.releaseResume();
      await wait(1500);
      check(`${canvas.width}x${canvas.height}` === size, `${name} picture is ${canvas.width}x${canvas.height}`);
      const n = await colours();
      check(n >= 3, `${name} picture changes (${n} colours)`);

      const gameId = session.current!.game.id;
      await session.saveState('1');
      check((await session.loadState('1')) === null, `${name} save state saved and loaded`);
      check((await store.listStates(gameId)).some((s) => s.slot === '1'), `${name} save state is stored`);
      await session.flushSaveRam();
      check(!!(await store.getSave(gameId)), `${name} game save file is stored`);
    }

    const copy = new MemoryStore();
    const summary = await restoreBackup(copy, await exportBackup(store));
    check(summary.saves >= 2 && summary.states >= 2, `backup round trip (${summary.saves} saves, ${summary.states} states)`);
    lines.push(`INFO sound ${audioAvailable ? 'available' : 'not available'}`);
    lines.push(`INFO user agent ${navigator.userAgent}`);
  } catch (err) {
    check(false, `self-test crashed: ${err instanceof Error ? err.stack || err.message : String(err)}`);
  }
  return { passed, report: lines.join('\n') };
}
