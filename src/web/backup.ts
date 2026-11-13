// Backup: all saves, save states and settings in one ZIP file, and restore
// by merging. Restoring never silently overwrites anything: when both sides
// have different data, the newer one is used and the older one is kept.
// Format: docs/ARCHITECTURE.md ("Backup format").

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import {
  HISTORY_LIMIT,
  sameBytes,
  type BatterySave,
  type EngineRef,
  type GameRecord,
  type SaveCopy,
  type SaveStore,
  type StateRecord,
  type System,
} from './storage/types';

export const BACKUP_FORMAT = 'st8-backup';
export const BACKUP_VERSION = 1;

interface Manifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  source: string;
  games: GameRecord[];
  saves: {
    gameId: string;
    system: System;
    updatedAt: number;
    file: string;
    history: { updatedAt: number; replacedAt: number; file: string }[];
  }[];
  states: {
    gameId: string;
    system: System;
    slot: string;
    createdAt: number;
    engine: EngineRef;
    file: string;
    thumbnail: string | null;
  }[];
}

export interface RestoreSummary {
  games: number;
  saves: number;
  states: number;
  /** Older copies kept because both sides had different data. */
  kept: number;
  /** Game ids whose current battery save changed. */
  changedSaves: string[];
}

const safe = (s: string) => s.replace(/[^\w.-]/g, '_');

/** Builds a backup of everything, or of one game. Never contains game files. */
export async function exportBackup(store: SaveStore, opts: { gameId?: string; source?: string } = {}): Promise<Uint8Array> {
  const only = <T extends { gameId?: string; id?: string }>(list: T[]) =>
    opts.gameId ? list.filter((x) => (x.gameId ?? x.id) === opts.gameId) : list;
  const files: Zippable = {};
  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    source: opts.source ?? '',
    games: only(await store.listGames()),
    saves: [],
    states: [],
  };

  for (const save of only(await store.listSaves())) {
    const base = `saves/${save.system}/${save.gameId}`;
    files[`${base}.srm`] = save.data;
    manifest.saves.push({
      gameId: save.gameId,
      system: save.system,
      updatedAt: save.updatedAt,
      file: `${base}.srm`,
      history: save.history.map((h, i) => {
        const file = `${base}.history-${i + 1}.srm`;
        files[file] = h.data;
        return { updatedAt: h.updatedAt, replacedAt: h.replacedAt, file };
      }),
    });
  }

  for (const summary of only(await store.listStates())) {
    const state = await store.getState(summary.gameId, summary.slot);
    if (!state) continue;
    const base = `states/${state.system}/${state.gameId}/${safe(state.slot)}`;
    files[`${base}.state`] = state.data;
    if (state.thumbnail) files[`${base}.png`] = [state.thumbnail, { level: 0 }];
    manifest.states.push({
      gameId: state.gameId,
      system: state.system,
      slot: state.slot,
      createdAt: state.createdAt,
      engine: state.engine,
      file: `${base}.state`,
      thumbnail: state.thumbnail ? `${base}.png` : null,
    });
  }

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['settings.json'] = strToU8(JSON.stringify(opts.gameId ? {} : await store.getSettings(), null, 2));
  return zipSync(files, { level: 6 });
}

export function backupFileName(date = new Date(), gameName?: string): string {
  const day = date.toISOString().slice(0, 10);
  const game = gameName ? `-${gameName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 40)}` : '';
  return `st8-backup${game}-${day}.zip`;
}

/** Merges a backup into the store. */
export async function restoreBackup(store: SaveStore, zip: Uint8Array, now = Date.now()): Promise<RestoreSummary> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new Error('This file is not an st8 backup (it is not a ZIP file).');
  }
  if (!files['manifest.json']) throw new Error('This file is not an st8 backup (no manifest).');
  const manifest = JSON.parse(strFromU8(files['manifest.json'])) as Manifest;
  if (manifest.format !== BACKUP_FORMAT) throw new Error('This file is not an st8 backup.');
  if (manifest.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of st8. Update st8 first.');
  const file = (name: string) => {
    const data = files[name];
    if (!data) throw new Error(`The backup is damaged: ${name} is missing.`);
    return data;
  };
  const summary: RestoreSummary = { games: 0, saves: 0, states: 0, kept: 0, changedSaves: [] };

  for (const game of manifest.games) {
    const existing = await store.getGame(game.id);
    if (!existing || game.lastPlayed > existing.lastPlayed) {
      await store.putGame({ ...existing, ...game });
      summary.games++;
    }
  }

  for (const entry of manifest.saves) {
    const incoming: BatterySave = {
      gameId: entry.gameId,
      system: entry.system,
      data: file(entry.file),
      updatedAt: entry.updatedAt,
      history: entry.history.map((h) => ({ data: file(h.file), updatedAt: h.updatedAt, replacedAt: h.replacedAt })),
    };
    const existing = await store.getSave(entry.gameId);
    if (!existing) {
      await store.putSave(incoming);
      summary.saves++;
      summary.changedSaves.push(entry.gameId);
      continue;
    }
    const merged = mergeSaves(existing, incoming, now);
    if (merged.kept) summary.kept++;
    if (merged.changed) {
      summary.saves++;
      summary.changedSaves.push(entry.gameId);
    }
    await store.putSave(merged.save);
  }

  for (const entry of manifest.states) {
    const incoming: StateRecord = {
      gameId: entry.gameId,
      system: entry.system,
      slot: entry.slot,
      createdAt: entry.createdAt,
      engine: entry.engine,
      data: file(entry.file),
      thumbnail: entry.thumbnail ? file(entry.thumbnail) : null,
    };
    const existing = await store.getState(entry.gameId, entry.slot);
    if (!existing) {
      await store.putState(incoming);
      summary.states++;
      continue;
    }
    if (existing.createdAt === incoming.createdAt && sameBytes(existing.data, incoming.data)) continue;
    const [newer, older] = incoming.createdAt > existing.createdAt ? [incoming, existing] : [existing, incoming];
    const keptSlot = `kept-${older.createdAt}`;
    if (!(await store.getState(older.gameId, keptSlot))) {
      await store.putState({ ...older, slot: keptSlot });
      summary.kept++;
    }
    if (newer === incoming) {
      await store.putState(incoming);
      summary.states++;
    }
  }

  const settings = JSON.parse(strFromU8(files['settings.json'] ?? strToU8('{}')));
  await store.putSettings({ ...settings, ...(await store.getSettings()) });
  return summary;
}

function mergeSaves(existing: BatterySave, incoming: BatterySave, now: number): { save: BatterySave; changed: boolean; kept: boolean } {
  const history: SaveCopy[] = [...existing.history];
  const addHistory = (copy: SaveCopy) => {
    if (!history.some((h) => sameBytes(h.data, copy.data))) history.push(copy);
  };
  incoming.history.forEach(addHistory);

  let current = existing;
  let changed = false;
  let kept = false;
  if (!sameBytes(existing.data, incoming.data)) {
    const [newer, older] = incoming.updatedAt > existing.updatedAt ? [incoming, existing] : [existing, incoming];
    addHistory({ data: older.data, updatedAt: older.updatedAt, replacedAt: now });
    kept = true;
    changed = newer === incoming;
    current = newer;
  }
  // Drop a history entry equal to the current data, then keep the newest copies.
  const cleaned = history
    .filter((h) => !sameBytes(h.data, current.data))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, HISTORY_LIMIT);
  return {
    save: { ...existing, data: current.data, updatedAt: Math.max(existing.updatedAt, incoming.updatedAt), history: cleaned },
    changed,
    kept,
  };
}
