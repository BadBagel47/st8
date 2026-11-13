// Runs the emulator off the main thread so the page stays responsive.
// Paces frames by the clock, sends video to the page and audio straight to
// the audio worklet.

import { CoreHost, type EngineFactory } from '../core/host';
import type { FromWorker, ToAudio, ToWorker } from './protocol';

let host: CoreHost | null = null;
let audioPort: MessagePort | null = null;
let running = false;
let nextFrameAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastAv = '';

const post = (msg: FromWorker, transfer: Transferable[] = []) => postMessage(msg, transfer);

function sendAudio(): void {
  if (!host) return;
  const pcm = host.takeAudio();
  if (!audioPort || pcm.length === 0) return;
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
  const msg: ToAudio = { type: 'samples', samples };
  audioPort.postMessage(msg, [samples.buffer]);
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
        audioPort?.postMessage({ type: 'config', inputRate: host.av.sampleRate } satisfies ToAudio);
        audioPort?.postMessage({ type: 'clear' } satisfies ToAudio);
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
        audioPort?.postMessage({ type: 'clear' } satisfies ToAudio);
        break;
      case 'resume':
        start();
        break;
      case 'reset':
        host?.reset();
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
