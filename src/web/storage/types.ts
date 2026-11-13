// Saved data and the storage interface shared by the web (IndexedDB) and
// desktop (files) implementations. Layout and meaning: docs/ARCHITECTURE.md.

export type System = 'nes' | 'snes';

export interface EngineRef {
  id: string;
  version: string;
  commit: string;
}

export interface GameRecord {
  /** SHA-256 of the game file, hex. */
  id: string;
  system: System;
  /** File name the game was last opened as. */
  name: string;
  lastPlayed: number;
}

export interface SaveCopy {
  data: Uint8Array;
  updatedAt: number;
  /** When this copy was replaced by another one (restore or import). */
  replacedAt: number;
}

/** The game's own battery-backed save memory. */
export interface BatterySave {
  gameId: string;
  system: System;
  data: Uint8Array;
  updatedAt: number;
  /** Older copies kept when a restore or import replaced the save (newest first). */
  history: SaveCopy[];
}

export interface StateMeta {
  gameId: string;
  system: System;
  /** "1".."4" manual slots, "resume", "auto-1".."auto-3", or "kept-<time>". */
  slot: string;
  createdAt: number;
  engine: EngineRef;
}

export interface StateSummary extends StateMeta {
  thumbnail: Uint8Array | null;
}

export interface StateRecord extends StateSummary {
  data: Uint8Array;
}

export interface Settings {
  volume?: number;
  muted?: boolean;
  lastBackupAt?: number;
}

export interface SaveStore {
  listGames(): Promise<GameRecord[]>;
  getGame(id: string): Promise<GameRecord | null>;
  putGame(game: GameRecord): Promise<void>;

  listSaves(): Promise<BatterySave[]>;
  getSave(gameId: string): Promise<BatterySave | null>;
  putSave(save: BatterySave): Promise<void>;

  /** All states of one game, or of all games, without the state data. */
  listStates(gameId?: string): Promise<StateSummary[]>;
  getState(gameId: string, slot: string): Promise<StateRecord | null>;
  putState(state: StateRecord): Promise<void>;

  getSettings(): Promise<Settings>;
  putSettings(settings: Settings): Promise<void>;

  /** Asks the platform to keep the data even when storage runs low. */
  persist(): Promise<boolean>;
}

export const HISTORY_LIMIT = 10;

/** Replaces a battery save's data, keeping the old data in its history. */
export function replaceSaveData(save: BatterySave, data: Uint8Array, updatedAt: number, now = Date.now()): BatterySave {
  if (sameBytes(save.data, data)) return { ...save, updatedAt: Math.max(save.updatedAt, updatedAt) };
  const history = [{ data: save.data, updatedAt: save.updatedAt, replacedAt: now }, ...save.history].slice(0, HISTORY_LIMIT);
  return { ...save, data, updatedAt, history };
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
