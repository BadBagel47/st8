// The running game and everything saved for it: battery saves, save states,
// automatic states and backup. Talks to the emulator and the store.

import type { AvInfo } from '../core/host';
import { backupFileName, exportBackup, restoreBackup, type RestoreSummary } from './backup';
import type { Emulator } from './emulator';
import { detectEngine, engineRef, sha256Hex, type EngineEntry } from './engines';
import { saveFile } from './platform';
import { replaceSaveData, type BatterySave, type GameRecord, type SaveStore, type StateRecord, type StateSummary } from './storage/types';

export const MANUAL_SLOTS = ['1', '2', '3', '4'];
export const QUICK_SLOT = '1';
const AUTO_SLOTS = ['auto-1', 'auto-2', 'auto-3'];
const AUTO_EVERY_MS = 5 * 60 * 1000;
const SNAPSHOT_EVERY_MS = 5000;

export interface CurrentGame {
  game: GameRecord;
  engine: EngineEntry;
  bytes: Uint8Array;
}

export class Session {
  current: CurrentGame | null = null;
  /** Called when the saved data for the current game changed (to refresh the UI). */
  onChange: () => void = () => {};
  /** Called with the picture saved with a state, right after it was loaded. */
  onStill: (png: Uint8Array) => void = () => {};
  private playMs = 0;
  private lastTick = 0;
  private playing = false;
  private persistAsked = false;
  private saveQueue: Promise<void> = Promise.resolve();
  /** While the battery save is being replaced, reports from the old game state are ignored. */
  private ignoreSaveRam = false;
  /** Latest "resume" state, also kept in memory for a last write when the page closes. */
  private snapshot: StateRecord | null = null;
  /** True while the previous session's "resume" state has not been offered/answered yet. */
  private holdResume = false;

  constructor(
    readonly store: SaveStore,
    private emulator: Emulator,
    private thumbnail: () => Promise<Uint8Array | null>,
    private source: string,
  ) {
    setInterval(() => this.autoTick(), 15_000);
    setInterval(() => void this.takeSnapshot(), SNAPSHOT_EVERY_MS);
  }

  /** Starts a game file. Returns an error message, or the av info. */
  async open(file: { name: string; bytes: Uint8Array }): Promise<AvInfo | string> {
    const engine = detectEngine(file.name, file.bytes);
    if (typeof engine === 'string') return engine;
    if (this.current) await this.saveResume();
    const id = await sha256Hex(file.bytes);
    const existing = await this.store.getGame(id);
    const game: GameRecord = { id, system: engine.system, name: file.name, lastPlayed: Date.now() };
    await this.store.putGame({ ...existing, ...game });
    const save = await this.store.getSave(id);
    this.current = { game, engine, bytes: file.bytes };
    this.snapshot = null;
    this.holdResume = !!(await this.store.getState(id, 'resume'));
    this.playMs = 0;
    const av = await this.emulator.start(engine, file.bytes, file.name, save?.data ?? null);
    this.setPlaying(true);
    this.onChange();
    return av;
  }

  setPlaying(playing: boolean): void {
    this.autoTick();
    const wasPlaying = this.playing;
    this.playing = playing && !!this.current;
    this.lastTick = performance.now();
    // A paused game does not change, so one snapshot now covers the whole pause.
    if (wasPlaying && !this.playing) void this.takeSnapshot(true);
  }

  /** Stores the battery save reported by the running game. */
  handleSaveRam(data: Uint8Array): void {
    const cur = this.current;
    if (!cur || this.ignoreSaveRam) return;
    this.queue(async () => {
      const existing = await this.store.getSave(cur.game.id);
      const save: BatterySave = existing
        ? { ...existing, data, updatedAt: Date.now() }
        : { gameId: cur.game.id, system: cur.game.system, data, updatedAt: Date.now(), history: [] };
      await this.store.putSave(save);
      await this.askPersist();
      this.onChange();
    });
  }

  /** Writes the current battery save to storage now (before leaving or switching). */
  async flushSaveRam(): Promise<void> {
    if (!this.current) return;
    const ram = await this.emulator.getSaveRam().catch(() => null);
    if (ram) this.handleSaveRam(ram);
    await this.saveQueue;
  }

  async saveState(slot: string): Promise<StateRecord> {
    const cur = this.current;
    if (!cur) throw new Error('No game is running.');
    const data = await this.emulator.saveState();
    const state: StateRecord = {
      gameId: cur.game.id,
      system: cur.game.system,
      slot,
      createdAt: Date.now(),
      engine: await engineRef(cur.engine.id, this.emulator.info?.version ?? ''),
      data,
      thumbnail: await this.thumbnail(),
    };
    await this.store.putState(state);
    await this.askPersist();
    this.onChange();
    return state;
  }

  /** Loads a save state. Returns an error message, or null on success. */
  async loadState(slot: string): Promise<string | null> {
    const cur = this.current;
    if (!cur) return 'No game is running.';
    const state = await this.store.getState(cur.game.id, slot);
    if (!state) return 'There is no save state in this slot.';
    if (await this.emulator.loadState(state.data)) {
      // The engine draws the restored picture with the next frame; show the saved one until then.
      if (state.thumbnail) this.onStill(state.thumbnail);
      void this.takeSnapshot(true);
      return null;
    }
    const ref = await engineRef(cur.engine.id, this.emulator.info?.version ?? '');
    return state.engine.commit !== ref.commit
      ? 'This save state was made with a different version of the emulator and cannot be loaded. The game save file is not affected.'
      : 'This save state could not be loaded.';
  }

  /** Lets the "resume" state be updated again, once the user has chosen to continue or start over. */
  releaseResume(): void {
    this.holdResume = false;
  }

  /** Keeps the current progress as the "resume" state. Best effort. */
  async saveResume(): Promise<void> {
    if (!this.current || this.holdResume) return;
    await this.flushSaveRam();
    const state = await this.saveState('resume').catch(() => null);
    if (state) this.snapshot = state;
  }

  /**
   * For page close: writes the latest snapshot again (best effort; the snapshot
   * is also written every few seconds while playing, so at most that much is lost).
   */
  saveResumeNow(): void {
    if (this.snapshot && !this.holdResume) void this.store.putState(this.snapshot);
  }

  private async takeSnapshot(force = false): Promise<void> {
    const cur = this.current;
    if (!cur || this.holdResume || (!this.playing && !force)) return;
    try {
      const data = await this.emulator.saveState();
      if (this.current !== cur || this.holdResume) return;
      const snapshot: StateRecord = {
        gameId: cur.game.id,
        system: cur.game.system,
        slot: 'resume',
        createdAt: Date.now(),
        engine: await engineRef(cur.engine.id, this.emulator.info?.version ?? ''),
        data,
        thumbnail: await this.thumbnail(),
      };
      this.snapshot = snapshot;
      await this.store.putState(snapshot);
    } catch {
      // Not critical; the next snapshot will try again.
    }
  }

  states(): Promise<StateSummary[]> {
    return this.current ? this.store.listStates(this.current.game.id) : Promise.resolve([]);
  }

  async batterySave(): Promise<BatterySave | null> {
    return this.current ? this.store.getSave(this.current.game.id) : null;
  }

  async exportSaveFile(): Promise<boolean> {
    const cur = this.current;
    if (!cur) return false;
    await this.flushSaveRam();
    const save = await this.store.getSave(cur.game.id);
    if (!save) return false;
    return saveFile(cur.game.name.replace(/\.[^.]+$/, '') + '.srm', save.data);
  }

  /** Uses another battery save for the current game and restarts it. Current progress is kept as a save state. */
  async replaceSaveFile(data: Uint8Array, updatedAt = Date.now()): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    await this.exclusive(async () => {
      await this.keepProgress();
      const existing = await this.store.getSave(cur.game.id);
      const save = existing
        ? replaceSaveData(existing, data, updatedAt)
        : { gameId: cur.game.id, system: cur.game.system, data, updatedAt, history: [] };
      await this.store.putSave(save);
      await this.restart();
    });
  }

  /** Switches to an older copy of the battery save (the current one goes to the history). */
  async useOlderSave(index: number): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    await this.exclusive(async () => {
      const existing = await this.store.getSave(cur.game.id);
      if (!existing?.history[index]) return;
      await this.keepProgress();
      const copy = existing.history[index];
      const history = existing.history.filter((_, i) => i !== index);
      await this.store.putSave(replaceSaveData({ ...existing, history }, copy.data, copy.updatedAt));
      await this.restart();
    });
  }

  async exportBackup(onlyCurrent: boolean): Promise<boolean> {
    await this.flushSaveRam();
    const gameId = onlyCurrent ? this.current?.game.id : undefined;
    const zip = await exportBackup(this.store, { gameId, source: this.source });
    const ok = await saveFile(backupFileName(new Date(), onlyCurrent ? this.current?.game.name : undefined), zip, 'application/zip');
    if (ok && !onlyCurrent) {
      await this.store.putSettings({ ...(await this.store.getSettings()), lastBackupAt: Date.now() });
    }
    this.onChange();
    return ok;
  }

  /** Restores a backup. If the running game's save changed, the game restarts with it. */
  async restoreBackup(zip: Uint8Array): Promise<RestoreSummary & { restarted: boolean }> {
    const run = async () => {
      const summary = await restoreBackup(this.store, zip);
      let restarted = false;
      if (this.current && summary.changedSaves.includes(this.current.game.id)) {
        await this.keepProgress();
        await this.restart();
        restarted = true;
      }
      return { ...summary, restarted };
    };
    const result = this.current ? await this.exclusive(run) : await run();
    this.onChange();
    return result;
  }

  /** True when there are saves newer than the last backup and the last backup is old. */
  async needsBackupReminder(): Promise<boolean> {
    const { lastBackupAt = 0 } = await this.store.getSettings();
    if (Date.now() - lastBackupAt < 7 * 24 * 3600 * 1000) return false;
    const saves = await this.store.listSaves();
    const states = await this.store.listStates();
    return saves.some((s) => s.updatedAt > lastBackupAt) || states.some((s) => s.slot !== 'resume' && s.createdAt > lastBackupAt);
  }

  /** Runs fn with the game paused and its battery save flushed and frozen. */
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.flushSaveRam();
    const wasPlaying = this.playing;
    this.emulator.send({ type: 'pause' });
    this.ignoreSaveRam = true;
    try {
      return await fn();
    } finally {
      this.ignoreSaveRam = false;
      this.emulator.send({ type: wasPlaying ? 'resume' : 'pause' });
    }
  }

  /** Before replacing the battery save, keep the progress in memory as a save state. */
  private async keepProgress(): Promise<void> {
    await this.saveState(`kept-${Date.now()}`).catch(() => {});
  }

  private async restart(): Promise<void> {
    const cur = this.current;
    if (!cur) return;
    const save = await this.store.getSave(cur.game.id);
    await this.emulator.start(cur.engine, cur.bytes, cur.game.name, save?.data ?? null);
    this.onChange();
  }

  /** Rolling automatic save states every few minutes of play. */
  private autoTick(): void {
    const now = performance.now();
    if (this.playing) this.playMs += now - this.lastTick;
    this.lastTick = now;
    if (!this.playing || this.playMs < AUTO_EVERY_MS) return;
    this.playMs = 0;
    void this.saveAutoState();
  }

  private async saveAutoState(): Promise<void> {
    const states = await this.states();
    const used = AUTO_SLOTS.map((slot) => states.find((s) => s.slot === slot));
    const free = used.findIndex((s) => !s);
    const slot =
      free >= 0 ? AUTO_SLOTS[free] : AUTO_SLOTS[used.reduce((oldest, s, i) => (s!.createdAt < used[oldest]!.createdAt ? i : oldest), 0)];
    await this.saveState(slot).catch(() => {});
  }

  private queue(job: () => Promise<void>): void {
    this.saveQueue = this.saveQueue.then(job).catch((err) => console.error('Saving failed', err));
  }

  private async askPersist(): Promise<void> {
    if (this.persistAsked) return;
    this.persistAsked = true;
    await this.store.persist();
  }
}

export function slotLabel(slot: string): string {
  if (MANUAL_SLOTS.includes(slot)) return `Slot ${slot}`;
  if (slot === 'resume') return 'Where you left off';
  if (slot.startsWith('auto-')) return `Automatic ${slot.slice(5)}`;
  if (slot.startsWith('kept-')) return 'Kept copy';
  return slot;
}
