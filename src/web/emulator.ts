// Page-side control of the emulator worker. One worker per engine; switching
// to a game for another system starts a fresh worker with that engine.

import type { AvInfo, SystemInfo } from '../core/host';
import type { AudioOutput } from './audio';
import type { EngineEntry } from './engines';
import type { FromWorker, ToWorker, WorkerRequest } from './protocol';

export interface EmulatorEvents {
  frame(width: number, height: number, pixels: ArrayBuffer): void;
  av(av: AvInfo): void;
  saveRam(data: Uint8Array): void;
  error(message: string): void;
}

interface Pending {
  resolve(v: { ok: boolean; data?: ArrayBuffer | null }): void;
  reject(e: Error): void;
}

export class Emulator {
  engine: EngineEntry | null = null;
  info: SystemInfo | null = null;
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private loaded: ((av: AvInfo) => void) | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(
    private audio: AudioOutput,
    private events: EmulatorEvents,
  ) {}

  /** Starts a game; resolves when it is running. */
  async start(engine: EngineEntry, bytes: Uint8Array, fileName: string, saveRam: Uint8Array | null): Promise<AvInfo> {
    await this.useEngine(engine);
    const copy = bytes.slice().buffer;
    const ram = saveRam ? saveRam.slice().buffer : null;
    const done = new Promise<AvInfo>((resolve) => (this.loaded = resolve));
    this.send({ type: 'load', bytes: copy, fileName, saveRam: ram }, ram ? [copy, ram] : [copy]);
    return done;
  }

  send(msg: ToWorker, transfer: Transferable[] = []): void {
    this.worker?.postMessage(msg, transfer);
  }

  async saveState(): Promise<Uint8Array> {
    const r = await this.request({ op: 'saveState' });
    if (!r.ok || !r.data) throw new Error('The game could not be saved right now.');
    return new Uint8Array(r.data);
  }

  async loadState(data: Uint8Array): Promise<boolean> {
    const copy = data.slice().buffer;
    return (await this.request({ op: 'loadState', data: copy }, [copy])).ok;
  }

  async getSaveRam(): Promise<Uint8Array | null> {
    const r = await this.request({ op: 'getSaveRam' });
    return r.data ? new Uint8Array(r.data) : null;
  }

  private request(req: WorkerRequest, transfer: Transferable[] = []): Promise<{ ok: boolean; data?: ArrayBuffer | null }> {
    if (!this.worker) return Promise.reject(new Error('No game is running'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: 'request', id, ...req } as ToWorker, transfer);
    });
  }

  private async useEngine(engine: EngineEntry): Promise<void> {
    if (this.engine?.id === engine.id && this.ready) return this.ready;
    this.worker?.terminate();
    for (const p of this.pending.values()) p.reject(new Error('The engine was stopped'));
    this.pending.clear();
    this.engine = engine;
    this.info = null;
    const worker = new Worker(new URL('./emulator.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === 'ready') {
          this.info = e.data.info;
          resolve();
        }
        this.handle(e.data);
      };
      worker.onerror = (e) => {
        reject(new Error('The emulator could not be started.'));
        this.events.error(`The emulator stopped because of an error${e.message ? `: ${e.message}` : ''}. Reload the page to try again.`);
      };
    });
    const audioPort = this.audio.connect();
    const engineUrl = new URL(engine.file, document.baseURI).href;
    this.send({ type: 'init', engineUrl, audioPort }, audioPort ? [audioPort] : []);
    return this.ready;
  }

  private handle(msg: FromWorker): void {
    switch (msg.type) {
      case 'loaded':
        this.loaded?.(msg.av);
        this.loaded = null;
        break;
      case 'av':
        this.events.av(msg.av);
        break;
      case 'frame':
        this.events.frame(msg.width, msg.height, msg.pixels);
        break;
      case 'saveRam':
        this.events.saveRam(new Uint8Array(msg.data));
        break;
      case 'reply': {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (!p) break;
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve({ ok: msg.ok, data: msg.data });
        break;
      }
      case 'error':
        this.loaded = null;
        this.events.error(msg.message);
        break;
    }
  }
}
