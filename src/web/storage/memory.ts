// In-memory store, used by tests and as a fallback when no storage is available.

import type { BatterySave, GameRecord, SaveStore, Settings, StateRecord, StateSummary } from './types';

const key = (gameId: string, slot: string) => `${gameId}/${slot}`;

export class MemoryStore implements SaveStore {
  private games = new Map<string, GameRecord>();
  private saves = new Map<string, BatterySave>();
  private states = new Map<string, StateRecord>();
  private settings: Settings = {};

  async listGames() {
    return [...this.games.values()];
  }
  async getGame(id: string) {
    return this.games.get(id) ?? null;
  }
  async putGame(game: GameRecord) {
    this.games.set(game.id, structuredClone(game));
  }
  async listSaves() {
    return [...this.saves.values()];
  }
  async getSave(gameId: string) {
    const s = this.saves.get(gameId);
    return s ? structuredClone(s) : null;
  }
  async putSave(save: BatterySave) {
    this.saves.set(save.gameId, structuredClone(save));
  }
  async listStates(gameId?: string): Promise<StateSummary[]> {
    return [...this.states.values()]
      .filter((s) => !gameId || s.gameId === gameId)
      .map(({ data: _data, ...summary }) => summary);
  }
  async getState(gameId: string, slot: string) {
    const s = this.states.get(key(gameId, slot));
    return s ? structuredClone(s) : null;
  }
  async putState(state: StateRecord) {
    this.states.set(key(state.gameId, state.slot), structuredClone(state));
  }
  async getSettings() {
    return { ...this.settings };
  }
  async putSettings(settings: Settings) {
    this.settings = { ...settings };
  }
  async persist() {
    return false;
  }
}
