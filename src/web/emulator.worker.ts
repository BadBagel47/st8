// Runs the emulator off the main thread so the page stays responsive.
// Paces frames by the clock, sends video to the page and audio straight to
// the audio worklet, and reports changes to the game's battery save.

import { CoreHost, type EngineFactory } from '../core/host';
import { sameBytes } from './storage/types';
import type { FromWorker, ToAudio, ToWorker, WorkerRequest } from './protocol';

const SAVE_RAM_CHECK_FRAMES = 60;

let host: CoreHost | null = null;
let audioPort: MessagePort | null = null;
let running = false;
let nextFrameAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastAv = '';
let lastSaveRam: Uint8Array | null = null;
let framesSinceCheck = 0;

const post = (msg: FromWorker, transfer: Transferable[] = []) => postMessage(msg, transfer);
const toAudio = (msg: ToAudio, transfer: Transferable[] = []) => audioPort?.postMessage(msg, transfer);

function sendAudio(): void {
  if (!host) return;
  const pcm = host.takeAudio();
  if (!audioPort || pcm.length === 0) return;
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
  toAudio({ type: 'samples', samples }, [samples.buffer]);
}

function sendFrame(): void {
  if (!host || host.frameWidth === 0) return;
  const pixels = host.frame.slice().buffer;
  post({ type: 'frame', width: host.frameWidth, height: host.frameHeight, pixels }, [pixels]);
  const av = JSON.stringify(host.av);
  if (av !== lastAv) {
    lastAv = av;
    post({ type: 'av', av: { ...host.av } });
  }
}

/** Sends the battery save to the page if it changed since the last check. */
function checkSaveRam(): void {
  if (!host?.isLoaded) return;
  const ram = host.getSaveRam();
  if (!ram || (lastSaveRam && sameBytes(ram, lastSaveRam))) return;
  lastSaveRam = ram;
  const copy = ram.slice();
  post({ type: 'saveRam', data: copy.buffer }, [copy.buffer]);
}

function tick(): void {
  timer = undefined;
  if (!running || !host) return;
  const frameMs = 1000 / host.av.fps;
  const now = performance.now();
  if (now - nextFrameAt > 250) nextFrameAt = now; // Far behind (tab was busy): skip ahead.
  let ran = 0;
  while (now >= nextFrameAt && ran < 4) {
    host.runFrame();
    nextFrameAt += frameMs;
    ran++;
  }
  if (ran) {
    sendAudio();
    sendFrame();
    framesSinceCheck += ran;
    if (framesSinceCheck >= SAVE_RAM_CHECK_FRAMES) {
      framesSinceCheck = 0;
      checkSaveRam();
    }
  }
  timer = setTimeout(tick, Math.max(0, nextFrameAt - performance.now()));
}

function start(): void {
  if (running || !host?.isLoaded) return;
  running = true;
  nextFrameAt = performance.now();
  tick();
}

function stop(): void {
  running = false;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

async function init(engineUrl: string): Promise<void> {
  const factory = (await import(/* @vite-ignore */ engineUrl)).default as EngineFactory;
  host = await CoreHost.create(factory, { log: (line) => console.debug('[engine]', line) });
  post({ type: 'ready', info: host.info });
}

function handleRequest(id: number, req: WorkerRequest): void {
  if (!host?.isLoaded) throw new Error('No game is running');
  switch (req.op) {
    case 'saveState': {
      const data = host.saveState();
      post({ type: 'reply', id, ok: true, data: data.buffer as ArrayBuffer }, [data.buffer as ArrayBuffer]);
      break;
    }
    case 'loadState': {
      const ok = host.loadState(new Uint8Array(req.data));
      if (ok) sendFrame();
      post({ type: 'reply', id, ok });
      break;
    }
    case 'getSaveRam': {
      const ram = host.getSaveRam();
      if (ram) lastSaveRam = ram.slice();
      post({ type: 'reply', id, ok: true, data: ram ? (ram.buffer as ArrayBuffer) : null }, ram ? [ram.buffer as ArrayBuffer] : []);
      break;
    }
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init':
        audioPort = msg.audioPort;
        await init(msg.engineUrl);
        break;
      case 'load': {
        if (!host) throw new Error('The engine is not ready yet');
        stop();
        if (!host.loadGame(new Uint8Array(msg.bytes), msg.fileName)) {
          post({ type: 'error', message: 'This file could not be started. Is it a valid game file?' });
          return;
        }
        if (msg.saveRam) host.setSaveRam(new Uint8Array(msg.saveRam));
        lastSaveRam = host.getSaveRam();
        framesSinceCheck = 0;
        toAudio({ type: 'config', inputRate: host.av.sampleRate });
        toAudio({ type: 'clear' });
        lastAv = '';
        post({ type: 'loaded', av: { ...host.av } });
        start();
        break;
      }
      case 'input':
        host?.setButtons(msg.port, msg.mask);
        break;
      case 'pause':
        stop();
        checkSaveRam();
        toAudio({ type: 'clear' });
        break;
      case 'resume':
        start();
        break;
      case 'reset':
        host?.reset();
        break;
      case 'request':
        try {
          handleRequest(msg.id, msg);
        } catch (err) {
          post({ type: 'reply', id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
        }
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
