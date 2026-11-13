// Core host: loads one libretro engine (built to WebAssembly with Emscripten)
// and exposes a small, platform-neutral interface. No DOM dependencies, so it
// runs in a Web Worker, in a desktop shell and in Node tests alike.

import { DEVICE_JOYPAD, ENV, MEMORY, PIXEL_FORMAT } from './libretro';

/** The parts of an Emscripten module that the host uses. */
export interface EngineModule {
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    unlink(path: string): void;
    analyzePath(path: string): { exists: boolean };
  };
  addFunction(fn: (...args: number[]) => number | void, signature: string): number;
  UTF8ToString(ptr: number): string;
  stringToNewUTF8(s: string): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _retro_init(): void;
  _retro_deinit(): void;
  _retro_api_version(): number;
  _retro_get_system_info(ptr: number): void;
  _retro_get_system_av_info(ptr: number): void;
  _retro_set_environment(fn: number): void;
  _retro_set_video_refresh(fn: number): void;
  _retro_set_audio_sample(fn: number): void;
  _retro_set_audio_sample_batch(fn: number): void;
  _retro_set_input_poll(fn: number): void;
  _retro_set_input_state(fn: number): void;
  _retro_set_controller_port_device(port: number, device: number): void;
  _retro_load_game(ptr: number): number;
  _retro_unload_game(): void;
  _retro_run(): void;
  _retro_reset(): void;
  _retro_serialize_size(): number;
  _retro_serialize(ptr: number, size: number): number;
  _retro_unserialize(ptr: number, size: number): number;
  _retro_get_memory_data(id: number): number;
  _retro_get_memory_size(id: number): number;
}

export type EngineFactory = (moduleArg?: Record<string, unknown>) => Promise<EngineModule>;

export interface SystemInfo {
  name: string;
  version: string;
  extensions: string[];
}

export interface AvInfo {
  width: number;
  height: number;
  aspectRatio: number;
  fps: number;
  sampleRate: number;
}

export interface HostOptions {
  /** Core option values that override the engine defaults. */
  options?: Record<string, string>;
  /** Engine log output; silent by default. */
  log?: (line: string) => void;
}

const SYSTEM_DIR = '/system';
const SAVE_DIR = '/saves';
const GAME_DIR = '/game';

export class CoreHost {
  readonly info: SystemInfo;
  av: AvInfo = { width: 256, height: 240, aspectRatio: 4 / 3, fps: 60, sampleRate: 48000 };

  /** Latest video frame as RGBA, width * height * 4 bytes. */
  frame = new Uint8ClampedArray(0);
  frameWidth = 0;
  frameHeight = 0;
  /** Incremented every time the engine delivers a new frame. */
  frameCount = 0;

  private m: EngineModule;
  private pixelFormat: number = PIXEL_FORMAT.RGB1555;
  private buttons = new Uint16Array(4);
  private audio = new Int16Array(8192);
  private audioLength = 0;
  private variables = new Map<string, string>();
  private variablePtrs = new Map<string, number>();
  private optionOverrides: Record<string, string>;
  private systemDirPtr: number;
  private saveDirPtr: number;
  private gamePath: string | null = null;
  private loaded = false;

  private constructor(m: EngineModule, opts: HostOptions) {
    this.m = m;
    this.optionOverrides = opts.options ?? {};
    for (const dir of [SYSTEM_DIR, SAVE_DIR, GAME_DIR]) {
      if (!m.FS.analyzePath(dir).exists) m.FS.mkdir(dir);
    }
    this.systemDirPtr = m.stringToNewUTF8(SYSTEM_DIR);
    this.saveDirPtr = m.stringToNewUTF8(SAVE_DIR);

    // Order matters: environment before init, the other callbacks after it.
    // (Mesen drops video and audio when they are set before retro_init.)
    m._retro_set_environment(m.addFunction((cmd, data) => (this.environment(cmd, data) ? 1 : 0), 'iii'));
    m._retro_init();
    m._retro_set_video_refresh(m.addFunction((data, w, h, pitch) => this.video(data, w, h, pitch), 'viiii'));
    m._retro_set_audio_sample(m.addFunction((l, r) => this.audioSample(l, r), 'vii'));
    m._retro_set_audio_sample_batch(m.addFunction((data, frames) => this.audioBatch(data, frames), 'iii'));
    m._retro_set_input_poll(m.addFunction(() => {}, 'v'));
    m._retro_set_input_state(m.addFunction((port, device, _index, id) => this.inputState(port, device, id), 'iiiii'));

    this.info = this.readSystemInfo();
  }

  static async create(factory: EngineFactory, opts: HostOptions = {}): Promise<CoreHost> {
    const log = opts.log ?? (() => {});
    const m = await factory({ print: log, printErr: log });
    return new CoreHost(m, opts);
  }

  /** Loads a game from its file contents. Returns false if the engine rejects it. */
  loadGame(bytes: Uint8Array, fileName: string): boolean {
    const { m } = this;
    if (this.loaded) this.unloadGame();
    // Engines that need a real path (Mesen does) read it from the in-memory file system.
    const safeName = fileName.replace(/[^\w.\- ]/g, '_') || 'game';
    this.gamePath = `${GAME_DIR}/${safeName}`;
    m.FS.writeFile(this.gamePath, bytes);

    const dataPtr = m._malloc(bytes.length);
    m.HEAPU8.set(bytes, dataPtr);
    const pathPtr = m.stringToNewUTF8(this.gamePath);
    const infoPtr = m._malloc(16);
    m.HEAPU32.set([pathPtr, dataPtr, bytes.length, 0], infoPtr >> 2);
    const ok = m._retro_load_game(infoPtr) !== 0;
    m._free(infoPtr);
    m._free(pathPtr);
    // The libretro API allows the engine to keep using the data, so it is not freed.
    if (!ok) {
      m._free(dataPtr);
      m.FS.unlink(this.gamePath);
      this.gamePath = null;
      return false;
    }
    this.loaded = true;
    for (let port = 0; port < 2; port++) m._retro_set_controller_port_device(port, DEVICE_JOYPAD);
    this.readAvInfo();
    return true;
  }

  unloadGame(): void {
    if (!this.loaded) return;
    this.m._retro_unload_game();
    if (this.gamePath) this.m.FS.unlink(this.gamePath);
    this.gamePath = null;
    this.loaded = false;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Runs one video frame of emulation. */
  runFrame(): void {
    this.m._retro_run();
  }

  reset(): void {
    this.m._retro_reset();
  }

  /** Sets the pressed buttons for a controller port as a bit mask of BUTTON ids. */
  setButtons(port: number, mask: number): void {
    if (port >= 0 && port < this.buttons.length) this.buttons[port] = mask;
  }

  /** Returns and clears the audio produced since the last call (interleaved stereo int16). */
  takeAudio(): Int16Array {
    const out = this.audio.slice(0, this.audioLength);
    this.audioLength = 0;
    return out;
  }

  /** Full snapshot of the running game. */
  saveState(): Uint8Array {
    const { m } = this;
    const size = m._retro_serialize_size();
    if (!size) throw new Error('The engine cannot save state right now');
    const ptr = m._malloc(size);
    try {
      if (!m._retro_serialize(ptr, size)) throw new Error('The engine failed to save state');
      return m.HEAPU8.slice(ptr, ptr + size);
    } finally {
      m._free(ptr);
    }
  }

  /** Restores a snapshot made by saveState. Returns false if the engine rejects it. */
  loadState(state: Uint8Array): boolean {
    const { m } = this;
    const ptr = m._malloc(state.length);
    try {
      m.HEAPU8.set(state, ptr);
      return m._retro_unserialize(ptr, state.length) !== 0;
    } finally {
      m._free(ptr);
    }
  }

  /** The game's own battery-backed save memory, or null if the game has none. */
  getSaveRam(): Uint8Array | null {
    return this.readMemory(MEMORY.SAVE_RAM);
  }

  setSaveRam(data: Uint8Array): boolean {
    const { m } = this;
    const ptr = m._retro_get_memory_data(MEMORY.SAVE_RAM);
    const size = m._retro_get_memory_size(MEMORY.SAVE_RAM);
    if (!ptr || !size) return false;
    m.HEAPU8.set(data.subarray(0, size), ptr);
    return true;
  }

  /** The console's work RAM (used by tests). */
  getSystemRam(): Uint8Array | null {
    return this.readMemory(MEMORY.SYSTEM_RAM);
  }

  private readMemory(id: number): Uint8Array | null {
    const ptr = this.m._retro_get_memory_data(id);
    const size = this.m._retro_get_memory_size(id);
    return ptr && size ? this.m.HEAPU8.slice(ptr, ptr + size) : null;
  }

  private readSystemInfo(): SystemInfo {
    const { m } = this;
    const ptr = m._malloc(32);
    m.HEAPU8.fill(0, ptr, ptr + 32);
    m._retro_get_system_info(ptr);
    const p = ptr >> 2;
    const str = (q: number) => (q ? m.UTF8ToString(q) : '');
    const info = {
      name: str(m.HEAPU32[p]),
      version: str(m.HEAPU32[p + 1]),
      extensions: str(m.HEAPU32[p + 2]).split('|').filter(Boolean),
    };
    m._free(ptr);
    return info;
  }

  private readAvInfo(): void {
    const { m } = this;
    const ptr = m._malloc(40);
    m._retro_get_system_av_info(ptr);
    this.readAvStruct(ptr, true);
    m._free(ptr);
  }

  // struct retro_system_av_info { geometry (5 x 4 bytes); padding; double fps; double sample_rate }
  private readAvStruct(ptr: number, withTiming: boolean): void {
    const { m } = this;
    const p = ptr >> 2;
    const width = m.HEAPU32[p];
    const height = m.HEAPU32[p + 1];
    const aspect = m.HEAPF32[p + 4];
    this.av.width = width;
    this.av.height = height;
    this.av.aspectRatio = aspect > 0 ? aspect : width / height;
    if (withTiming) {
      this.av.fps = m.HEAPF64[(ptr + 24) >> 3] || 60;
      this.av.sampleRate = m.HEAPF64[(ptr + 32) >> 3] || 48000;
    }
  }

  private environment(cmd: number, data: number): boolean {
    const { m } = this;
    switch (cmd) {
      case ENV.GET_CAN_DUPE:
        m.HEAPU8[data] = 1;
        return true;
      case ENV.GET_SYSTEM_DIRECTORY:
      case ENV.GET_CORE_ASSETS_DIRECTORY:
        m.HEAPU32[data >> 2] = this.systemDirPtr;
        return true;
      case ENV.GET_SAVE_DIRECTORY:
        m.HEAPU32[data >> 2] = this.saveDirPtr;
        return true;
      case ENV.SET_PIXEL_FORMAT: {
        const format = m.HEAPU32[data >> 2];
        if (format > PIXEL_FORMAT.RGB565) return false;
        this.pixelFormat = format;
        return true;
      }
      case ENV.SET_VARIABLES:
        this.setVariables(data);
        return true;
      case ENV.GET_VARIABLE:
        return this.getVariable(data);
      case ENV.GET_VARIABLE_UPDATE:
        m.HEAPU8[data] = 0;
        return true;
      case ENV.SET_SYSTEM_AV_INFO:
        this.readAvStruct(data, true);
        return true;
      case ENV.SET_GEOMETRY:
        this.readAvStruct(data, false);
        return true;
      case ENV.GET_LANGUAGE:
        m.HEAPU32[data >> 2] = 0; // English
        return true;
      default:
        return false;
    }
  }

  // Array of { const char *key; const char *value } ending with a null key.
  // value is "Description; default|other|...".
  private setVariables(ptr: number): void {
    const { m } = this;
    for (let p = ptr >> 2; m.HEAPU32[p]; p += 2) {
      const key = m.UTF8ToString(m.HEAPU32[p]);
      const desc = m.UTF8ToString(m.HEAPU32[p + 1]);
      const choices = desc.slice(desc.indexOf(';') + 1).trim().split('|');
      const override = this.optionOverrides[key];
      this.variables.set(key, override !== undefined && choices.includes(override) ? override : choices[0]);
    }
  }

  private getVariable(ptr: number): boolean {
    const { m } = this;
    const p = ptr >> 2;
    const key = m.UTF8ToString(m.HEAPU32[p]);
    const value = this.variables.get(key) ?? this.optionOverrides[key];
    if (value === undefined) return false;
    const cacheKey = `${key}=${value}`;
    let valuePtr = this.variablePtrs.get(cacheKey);
    if (!valuePtr) {
      valuePtr = m.stringToNewUTF8(value);
      this.variablePtrs.set(cacheKey, valuePtr);
    }
    m.HEAPU32[p + 1] = valuePtr;
    return true;
  }

  private video(data: number, width: number, height: number, pitch: number): void {
    if (!data) return; // Same frame as before.
    if (width !== this.frameWidth || height !== this.frameHeight) {
      this.frameWidth = width;
      this.frameHeight = height;
      this.frame = new Uint8ClampedArray(width * height * 4);
    }
    const out = new Uint32Array(this.frame.buffer);
    const { m } = this;
    if (this.pixelFormat === PIXEL_FORMAT.XRGB8888) {
      const src = m.HEAPU32;
      for (let y = 0; y < height; y++) {
        let s = (data + y * pitch) >> 2;
        let d = y * width;
        for (let x = 0; x < width; x++) {
          const c = src[s++];
          // 0x00RRGGBB -> bytes R,G,B,A (little endian 0xAABBGGRR)
          out[d++] = 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
        }
      }
    } else {
      const src = new Uint16Array(m.HEAPU8.buffer);
      const is565 = this.pixelFormat === PIXEL_FORMAT.RGB565;
      for (let y = 0; y < height; y++) {
        let s = (data + y * pitch) >> 1;
        let d = y * width;
        for (let x = 0; x < width; x++) {
          const c = src[s++];
          let r: number, g: number, b: number;
          if (is565) {
            r = (c >> 11) & 0x1f;
            g = (c >> 5) & 0x3f;
            b = c & 0x1f;
            g = (g << 2) | (g >> 4);
          } else {
            r = (c >> 10) & 0x1f;
            g = (c >> 5) & 0x1f;
            b = c & 0x1f;
            g = (g << 3) | (g >> 2);
          }
          r = (r << 3) | (r >> 2);
          b = (b << 3) | (b >> 2);
          out[d++] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }
    }
    this.frameCount++;
  }

  private ensureAudio(extra: number): void {
    if (this.audioLength + extra <= this.audio.length) return;
    const bigger = new Int16Array(Math.max(this.audio.length * 2, this.audioLength + extra));
    bigger.set(this.audio.subarray(0, this.audioLength));
    this.audio = bigger;
  }

  private audioSample(left: number, right: number): void {
    this.ensureAudio(2);
    this.audio[this.audioLength++] = left;
    this.audio[this.audioLength++] = right;
  }

  private audioBatch(data: number, frames: number): number {
    const n = frames * 2;
    this.ensureAudio(n);
    const start = data >> 1;
    this.audio.set(this.m.HEAP16.subarray(start, start + n), this.audioLength);
    this.audioLength += n;
    return frames;
  }

  private inputState(port: number, device: number, id: number): number {
    if ((device & 0xff) !== DEVICE_JOYPAD || port >= this.buttons.length || id > 15) return 0;
    return (this.buttons[port] >> id) & 1;
  }
}
