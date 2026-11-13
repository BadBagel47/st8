// Web storage in IndexedDB. Everything stays in this browser.

import type { BatterySave, GameRecord, SaveStore, Settings, StateRecord, StateSummary } from './types';

const DB_NAME = 'st8';
const DB_VERSION = 1;

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
  });
}

export class IdbStore implements SaveStore {
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IdbStore> {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('games', { keyPath: 'id' });
      db.createObjectStore('saves', { keyPath: 'gameId' });
      const states = db.createObjectStore('states', { keyPath: ['gameId', 'slot'] });
      states.createIndex('gameId', 'gameId');
      db.createObjectStore('settings');
    };
    return new IdbStore(await promisify(req));
  }

  private async get<T>(store: string, key: IDBValidKey): Promise<T | null> {
    const tx = this.db.transaction(store, 'readonly');
    return ((await promisify(tx.objectStore(store).get(key))) as T | undefined) ?? null;
  }

  private async all<T>(store: string): Promise<T[]> {
    const tx = this.db.transaction(store, 'readonly');
    return (await promisify(tx.objectStore(store).getAll())) as T[];
  }

  private async put(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.commit?.(); // commit right away, so the write can finish even if the page is closing
    await done(tx);
  }

  listGames() {
    return this.all<GameRecord>('games');
  }
  getGame(id: string) {
    return this.get<GameRecord>('games', id);
  }
  putGame(game: GameRecord) {
    return this.put('games', game);
  }
  listSaves() {
    return this.all<BatterySave>('saves');
  }
  getSave(gameId: string) {
    return this.get<BatterySave>('saves', gameId);
  }
  putSave(save: BatterySave) {
    return this.put('saves', save);
  }

  async listStates(gameId?: string): Promise<StateSummary[]> {
    const tx = this.db.transaction('states', 'readonly');
    const store = tx.objectStore('states');
    const req = gameId ? store.index('gameId').openCursor(IDBKeyRange.only(gameId)) : store.openCursor();
    const out: StateSummary[] = [];
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const { data: _data, ...summary } = cursor.value as StateRecord;
        out.push(summary);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    return out;
  }

  getState(gameId: string, slot: string) {
    return this.get<StateRecord>('states', [gameId, slot]);
  }
  putState(state: StateRecord) {
    return this.put('states', state);
  }

  async getSettings(): Promise<Settings> {
    return (await this.get<Settings>('settings', 'settings')) ?? {};
  }
  putSettings(settings: Settings) {
    return this.put('settings', settings, 'settings');
  }

  async persist(): Promise<boolean> {
    try {
      if (await navigator.storage?.persisted?.()) return true;
      return (await navigator.storage?.persist?.()) ?? false;
    } catch {
      return false;
    }
  }
}
