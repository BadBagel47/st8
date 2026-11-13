// Page logic: wires the emulator worker to the screen, audio, input and UI.

import type { AvInfo } from '../core/host';
import { AudioOutput } from './audio';
import { Input, attachTouchControls } from './input';
import type { FromWorker, ToWorker } from './protocol';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('screen');
const ctx = canvas.getContext('2d', { alpha: false })!;
const wrap = $<HTMLDivElement>('screen-wrap');
const hint = $<HTMLDivElement>('hint');
const statusEl = $<HTMLParagraphElement>('status');
const fileInput = $<HTMLInputElement>('file');
const btnOpen = $<HTMLButtonElement>('open');
const btnPause = $<HTMLButtonElement>('pause');
const btnReset = $<HTMLButtonElement>('reset');
const btnFullscreen = $<HTMLButtonElement>('fullscreen');
const btnMute = $<HTMLButtonElement>('mute');
const volume = $<HTMLInputElement>('volume');
const touch = $<HTMLDivElement>('touch');
const stage = $<HTMLElement>('stage');
const help = $<HTMLDialogElement>('help');

const worker = new Worker(new URL('./emulator.worker.ts', import.meta.url), { type: 'module' });
const send = (msg: ToWorker, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);
const audio = new AudioOutput();
const input = new Input((port, mask) => send({ type: 'input', port, mask }));

let aspectRatio = 4 / 3;
let gameLoaded = false;
let userPaused = false;
let pendingFrame: { width: number; height: number; pixels: ArrayBuffer } | null = null;

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

// ---------- Video ----------

function layout(): void {
  const box = wrap.getBoundingClientRect();
  let w = box.width;
  let h = w / aspectRatio;
  if (h > box.height) {
    h = box.height;
    w = h * aspectRatio;
  }
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
}
new ResizeObserver(layout).observe(wrap);

function draw(): void {
  if (!pendingFrame) return;
  const { width, height, pixels } = pendingFrame;
  pendingFrame = null;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
}

function loop(): void {
  input.update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function applyAv(av: AvInfo): void {
  aspectRatio = av.aspectRatio > 0 ? av.aspectRatio : 4 / 3;
  layout();
}

// ---------- Worker messages ----------

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case 'ready':
      btnOpen.disabled = false;
      setStatus('');
      break;
    case 'loaded':
      gameLoaded = true;
      userPaused = false;
      hint.hidden = true;
      btnPause.disabled = btnReset.disabled = false;
      btnPause.textContent = 'Pause';
      applyAv(msg.av);
      setStatus(audio.available ? '' : 'Sound is not available in this browser.');
      break;
    case 'av':
      applyAv(msg.av);
      break;
    case 'frame':
      pendingFrame = msg;
      break;
    case 'error':
      setStatus(msg.message, true);
      break;
  }
};
worker.onerror = () => setStatus('The emulator stopped because of an error. Reload the page to try again.', true);

// ---------- Loading games ----------

const NES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];

async function openFile(file: File): Promise<void> {
  audio.unlock();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isNes = NES_MAGIC.every((b, i) => bytes[i] === b);
  if (!isNes) {
    setStatus(`"${file.name}" is not an NES game file (.nes).`, true);
    return;
  }
  setStatus(`Starting ${file.name}…`);
  send({ type: 'load', bytes: bytes.buffer, fileName: file.name }, [bytes.buffer]);
}

btnOpen.addEventListener('click', () => {
  audio.unlock();
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void openFile(file);
});
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
document.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dragging');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files[0];
  if (file && !btnOpen.disabled) void openFile(file);
});

// ---------- Controls ----------

function setPaused(paused: boolean): void {
  if (!gameLoaded) return;
  send({ type: paused ? 'pause' : 'resume' });
  btnPause.textContent = paused ? 'Resume' : 'Pause';
}

btnPause.addEventListener('click', () => {
  userPaused = !userPaused;
  setPaused(userPaused);
  btnPause.blur();
});
btnReset.addEventListener('click', () => {
  send({ type: 'reset' });
  btnReset.blur();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
  else if (!userPaused) setPaused(false);
});

// Audio may only start after a user action.
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}

volume.addEventListener('input', () => {
  audio.setVolume(Number(volume.value));
  if (audio.isMuted) toggleMute();
});
function toggleMute(): void {
  audio.setMuted(!audio.isMuted);
  btnMute.textContent = audio.isMuted ? '🔇' : '🔊';
  btnMute.setAttribute('aria-label', audio.isMuted ? 'Unmute' : 'Mute');
}
btnMute.addEventListener('click', () => {
  toggleMute();
  btnMute.blur();
});

if (document.fullscreenEnabled) {
  btnFullscreen.disabled = false;
  btnFullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen().catch(() => {});
    btnFullscreen.blur();
  });
} else {
  btnFullscreen.hidden = true;
}

$('help-open').addEventListener('click', () => {
  input.enabled = false;
  help.showModal();
});
help.addEventListener('close', () => (input.enabled = true));

// On-screen controls on touch screens.
const coarse = window.matchMedia('(pointer: coarse)');
const showTouch = () => {
  touch.hidden = !coarse.matches;
  document.body.classList.toggle('touch', coarse.matches);
  layout();
};
coarse.addEventListener('change', showTouch);
showTouch();
attachTouchControls(touch, (mask) => input.setTouchMask(mask));

// ---------- Start ----------

async function start(): Promise<void> {
  setStatus('Loading the emulator…');
  const audioPort = await audio.init();
  const engineUrl = new URL('cores/mesen.mjs', document.baseURI).href;
  send({ type: 'init', engineUrl, audioPort }, audioPort ? [audioPort] : []);
}
void start();
