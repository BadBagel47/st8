import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup } from '../src/web/backup';
import { MemoryStore } from '../src/web/storage/memory';
import type { StateRecord } from '../src/web/storage/types';

const engine = { id: 'mesen', version: '0.9.9', commit: 'abc' };
const bytes = (...v: number[]) => new Uint8Array(v);

function state(gameId: string, slot: string, createdAt: number, fill: number): StateRecord {
  return { gameId, system: 'nes', slot, createdAt, engine, data: new Uint8Array(100).fill(fill), thumbnail: bytes(137, 80, 78, 71) };
}

async function filledStore(): Promise<MemoryStore> {
  const s = new MemoryStore();
  await s.putGame({ id: 'g1', system: 'nes', name: 'One.nes', lastPlayed: 10 });
  await s.putGame({ id: 'g2', system: 'snes', name: 'Two.sfc', lastPlayed: 20 });
  await s.putSave({ gameId: 'g1', system: 'nes', data: bytes(1, 2, 3), updatedAt: 100, history: [] });
  await s.putSave({ gameId: 'g2', system: 'snes', data: bytes(9), updatedAt: 100, history: [{ data: bytes(8), updatedAt: 50, replacedAt: 60 }] });
  await s.putState(state('g1', '1', 100, 1));
  await s.putState(state('g1', 'resume', 110, 2));
  await s.putState({ ...state('g2', '1', 100, 3), system: 'snes', thumbnail: null });
  await s.putSettings({ volume: 0.5, lastBackupAt: 5 });
  return s;
}

describe('backup', () => {
  it('restores everything into an empty store', async () => {
    const zip = await exportBackup(await filledStore());
    const target = new MemoryStore();
    const summary = await restoreBackup(target, zip);
    expect(summary).toMatchObject({ games: 2, saves: 2, states: 3, kept: 0 });
    expect((await target.getSave('g1'))!.data).toEqual(bytes(1, 2, 3));
    expect((await target.getSave('g2'))!.history[0].data).toEqual(bytes(8));
    expect((await target.getState('g1', 'resume'))!.data).toEqual(new Uint8Array(100).fill(2));
    expect((await target.getState('g2', '1'))!.thumbnail).toBeNull();
    expect((await target.getSettings()).volume).toBe(0.5);
  });

  it('exports one game only', async () => {
    const zip = await exportBackup(await filledStore(), { gameId: 'g2' });
    const target = new MemoryStore();
    await restoreBackup(target, zip);
    expect(await target.listGames()).toHaveLength(1);
    expect(await target.getSave('g1')).toBeNull();
    expect(await target.listStates()).toHaveLength(1);
  });

  it('restoring the same backup twice changes nothing', async () => {
    const source = await filledStore();
    const zip = await exportBackup(source);
    const summary = await restoreBackup(source, zip);
    expect(summary).toMatchObject({ saves: 0, states: 0, kept: 0 });
    expect(await source.listStates()).toHaveLength(3);
    expect((await source.getSave('g2'))!.history).toHaveLength(1);
  });

  it('keeps the older copy when both sides differ, newer wins', async () => {
    const zip = await exportBackup(await filledStore());
    const target = new MemoryStore();
    // Newer battery save on the device, older state in slot 1.
    await target.putSave({ gameId: 'g1', system: 'nes', data: bytes(7, 7), updatedAt: 200, history: [] });
    await target.putState(state('g1', '1', 50, 9));
    const summary = await restoreBackup(target, zip, 1000);

    const save = (await target.getSave('g1'))!;
    expect(save.data).toEqual(bytes(7, 7)); // device copy is newer and stays
    expect(save.history.map((h) => [...h.data])).toEqual([[1, 2, 3]]); // backup copy kept
    expect(summary.changedSaves).not.toContain('g1');

    expect((await target.getState('g1', '1'))!.createdAt).toBe(100); // backup state is newer
    expect((await target.getState('g1', 'kept-50'))!.data).toEqual(new Uint8Array(100).fill(9)); // device state kept
    expect(summary.kept).toBe(2);
  });

  it('a newer save in the backup replaces the device save and keeps the old one', async () => {
    const zip = await exportBackup(await filledStore());
    const target = new MemoryStore();
    await target.putSave({ gameId: 'g1', system: 'nes', data: bytes(4), updatedAt: 10, history: [] });
    const summary = await restoreBackup(target, zip, 1000);
    const save = (await target.getSave('g1'))!;
    expect(save.data).toEqual(bytes(1, 2, 3));
    expect(save.history[0]).toMatchObject({ data: bytes(4), replacedAt: 1000 });
    expect(summary.changedSaves).toContain('g1');
  });

  it('rejects files that are not backups', async () => {
    await expect(restoreBackup(new MemoryStore(), bytes(1, 2, 3))).rejects.toThrow(/not an st8 backup/);
  });
});
