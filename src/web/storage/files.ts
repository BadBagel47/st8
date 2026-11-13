// Store as plain files, in the same layout as the backup format
// (docs/ARCHITECTURE.md). Used by the desktop app; tested with an in-memory IO.

import type { BatterySave, GameRecord, SaveStore, Settings, StateRecord, StateSummary, System } from './types';

export interface FileIO {
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, data: Uint8Array): Promise<void>;
  list(path: string): Promise<string[]>;
}

const SYSTEMS: System[] = ['nes', 'snes'];
const enc = new TextEncoder();
const dec = new TextDecoder();

interface SaveMeta {
  gameId: string;
  system: System;
  updatedAt: number;
  history: { updatedAt: number; replacedAt: number; file: string }[];
}

type StateMeta = Omit<StateRecord, 'data' | 'thumbnail'> & { thumbnail: boolean };

export class FileStore implements SaveStore {
  constructor(private io: FileIO) {}

  private async readJson<T>(path: string): Promise<T | null> {
    const data = await this.io.read(path);
    return data ? (JSON.parse(dec.decode(data)) as T) : null;
  }

  private writeJson(path: string, value: unknown): Promise<void> {
    return this.io.write(path, enc.encode(JSON.stringify(value, null, 2)));
  }

  private async systemsFor(gameId: string): Promise<System[]> {
    const game = await this.getGame(gameId);
    return game ? [game.system] : SYSTEMS;
  }

  async listGames(): Promise<GameRecord[]> {
    const names = (await this.io.list('games')).filter((n) => n.endsWith('.json'));
    const games = await Promise.all(names.map((n) => this.readJson<GameRecord>(`games/${n}`)));
    return games.filter((g): g is GameRecord => !!g);
  }
  getGame(id: string) {
    return this.readJson<GameRecord>(`games/${id}.json`);
  }
  putGame(game: GameRecord) {
    return this.writeJson(`games/${game.id}.json`, game);
  }

  async getSave(gameId: string): Promise<BatterySave | null> {
    for (const system of await this.systemsFor(gameId)) {
      const base = `saves/${system}/${gameId}`;
      const meta = await this.readJson<SaveMeta>(`${base}.json`);
      const data = meta && (await this.io.read(`${base}.srm`));
      if (!meta || !data) continue;
      const history = [];
      for (const h of meta.history) {
        const copy = await this.io.read(`saves/${system}/${h.file}`);
        if (copy) history.push({ data: copy, updatedAt: h.updatedAt, replacedAt: h.replacedAt });
      }
      return { gameId, system, data, updatedAt: meta.updatedAt, history };
    }
    return null;
  }

  async putSave(save: BatterySave): Promise<void> {
    const base = `saves/${save.system}/${save.gameId}`;
    const history = [];
    for (const h of save.history) {
      const file = `${save.gameId}.history-${h.updatedAt}.srm`;
      await this.io.write(`saves/${save.system}/${file}`, h.data);
      history.push({ updatedAt: h.updatedAt, replacedAt: h.replacedAt, file });
    }
    await this.io.write(`${base}.srm`, save.data);
    const meta: SaveMeta = { gameId: save.gameId, system: save.system, updatedAt: save.updatedAt, history };
    await this.writeJson(`${base}.json`, meta); // last: the save counts once its metadata is written
  }

  async listSaves(): Promise<BatterySave[]> {
    const out: BatterySave[] = [];
    for (const system of SYSTEMS) {
      for (const name of await this.io.list(`saves/${system}`)) {
        if (!name.endsWith('.json')) continue;
        const save = await this.getSave(name.slice(0, -5));
        if (save) out.push(save);
      }
    }
    return out;
  }

  async listStates(gameId?: string): Promise<StateSummary[]> {
    const out: StateSummary[] = [];
    for (const system of gameId ? await this.systemsFor(gameId) : SYSTEMS) {
      const ids = gameId ? [gameId] : await this.io.list(`states/${system}`);
      for (const id of ids) {
        for (const name of await this.io.list(`states/${system}/${id}`)) {
          if (!name.endsWith('.json')) continue;
          const summary = await this.readState(system, id, name.slice(0, -5), false);
          if (summary) out.push(summary);
        }
      }
    }
    return out;
  }

  private async readState(system: System, gameId: string, slot: string, withData: boolean): Promise<StateRecord | null> {
    const base = `states/${system}/${gameId}/${slot}`;
    const meta = await this.readJson<StateMeta>(`${base}.json`);
    if (!meta) return null;
    const thumbnail = meta.thumbnail ? await this.io.read(`${base}.png`) : null;
    const data = withData ? await this.io.read(`${base}.state`) : new Uint8Array(0);
    if (!data) return null;
    return { ...meta, thumbnail, data };
  }

  async getState(gameId: string, slot: string): Promise<StateRecord | null> {
    for (const system of await this.systemsFor(gameId)) {
      const state = await this.readState(system, gameId, slot, true);
      if (state) return state;
    }
    return null;
  }

  async putState(state: StateRecord): Promise<void> {
    const base = `states/${state.system}/${state.gameId}/${state.slot}`;
    await this.io.write(`${base}.state`, state.data);
    if (state.thumbnail) await this.io.write(`${base}.png`, state.thumbnail);
    const { data: _data, thumbnail, ...meta } = state;
    await this.writeJson(`${base}.json`, { ...meta, thumbnail: !!thumbnail } satisfies StateMeta);
  }

  async getSettings(): Promise<Settings> {
    return (await this.readJson<Settings>('settings.json')) ?? {};
  }
  putSettings(settings: Settings) {
    return this.writeJson('settings.json', settings);
  }
  async persist() {
    return true;
  }
}

/** In-memory FileIO, for tests. */
export class MemoryFileIO implements FileIO {
  files = new Map<string, Uint8Array>();
  async read(path: string) {
    return this.files.get(path)?.slice() ?? null;
  }
  async write(path: string, data: Uint8Array) {
    this.files.set(path, data.slice());
  }
  async list(path: string) {
    const prefix = path ? `${path}/` : '';
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
    }
    return [...names].sort();
  }
}
