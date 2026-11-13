import { describe, expect, it } from 'vitest';
import { exportBackup, restoreBackup } from '../src/web/backup';
import { FileStore, MemoryFileIO } from '../src/web/storage/files';
import { MemoryStore } from '../src/web/storage/memory';
import type { SaveStore } from '../src/web/storage/types';

const engine = { id: 'snes9x', version: '1.63', commit: 'abc' };
const stores: [string, () => SaveStore][] = [
  ['memory', () => new MemoryStore()],
  ['files', () => new FileStore(new MemoryFileIO())],
];

describe.each(stores)('%s store', (_name, make) => {
  it('stores and lists games, saves, states and settings', async () => {
    const s = make();
    await s.putGame({ id: 'g1', system: 'snes', name: 'A.sfc', lastPlayed: 1 });
    await s.putSave({ gameId: 'g1', system: 'snes', data: new Uint8Array([1, 2]), updatedAt: 5, history: [{ data: new Uint8Array([0]), updatedAt: 2, replacedAt: 3 }] });
    await s.putState({ gameId: 'g1', system: 'snes', slot: '1', createdAt: 7, engine, data: new Uint8Array([9, 9]), thumbnail: new Uint8Array([1]) });
    await s.putState({ gameId: 'g1', system: 'snes', slot: 'resume', createdAt: 8, engine, data: new Uint8Array([8]), thumbnail: null });
    await s.putSettings({ volume: 0.3 });

    expect((await s.listGames()).map((g) => g.id)).toEqual(['g1']);
    const save = (await s.getSave('g1'))!;
    expect([...save.data]).toEqual([1, 2]);
    expect(save.history).toHaveLength(1);
    expect([...save.history[0].data]).toEqual([0]);
    expect(await s.listSaves()).toHaveLength(1);

    const states = await s.listStates('g1');
    expect(states.map((x) => x.slot).sort()).toEqual(['1', 'resume']);
    expect(states.every((x) => !('data' in x) || (x as { data: Uint8Array }).data.length === 0)).toBe(true);
    expect(await s.listStates()).toHaveLength(2);
    const st = (await s.getState('g1', '1'))!;
    expect([...st.data]).toEqual([9, 9]);
    expect([...st.thumbnail!]).toEqual([1]);
    expect((await s.getState('g1', 'resume'))!.thumbnail).toBeNull();
    expect(await s.getState('g1', '2')).toBeNull();
    expect(await s.getSave('nope')).toBeNull();
    expect((await s.getSettings()).volume).toBe(0.3);
  });

  it('round-trips through a backup into the other kind of store', async () => {
    const s = make();
    await s.putGame({ id: 'g1', system: 'nes', name: 'A.nes', lastPlayed: 1 });
    await s.putSave({ gameId: 'g1', system: 'nes', data: new Uint8Array([4]), updatedAt: 5, history: [] });
    await s.putState({ gameId: 'g1', system: 'nes', slot: '2', createdAt: 7, engine, data: new Uint8Array([3]), thumbnail: null });
    const other = s instanceof FileStore ? new MemoryStore() : new FileStore(new MemoryFileIO());
    const summary = await restoreBackup(other, await exportBackup(s));
    expect(summary).toMatchObject({ games: 1, saves: 1, states: 1 });
    expect([...(await other.getState('g1', '2'))!.data]).toEqual([3]);
  });
});
