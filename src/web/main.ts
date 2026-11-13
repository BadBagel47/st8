// Page logic: wires the emulator, saves, audio, input and UI together.

import type { AvInfo } from '../core/host';
import { AudioOutput } from './audio';
import { desktopFiles, invoke, isDesktop } from './desktop';
import { Emulator } from './emulator';
import { Input, attachTouchControls } from './input';
import { SavesDialog } from './saves-ui';
import { QUICK_SLOT, Session } from './session';
import { FileStore } from './storage/files';
import { IdbStore } from './storage/idb';
import { MemoryStore } from './storage/memory';
import type { SaveStore } from './storage/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('screen');
const ctx = canvas.getContext('2d', { alpha: false })!;
const wrap = $<HTMLDivElement>('screen-wrap');
const hint = $<HTMLDivElement>('hint');
const statusEl = $<HTMLParagraphElement>('status');
const notice = $<HTMLDivElement>('notice');
const fileInput = $<HTMLInputElement>('file');
const btnOpen = $<HTMLButtonElement>('open');
const btnPause = $<HTMLButtonElement>('pause');
const btnReset = $<HTMLButtonElement>('reset');
const btnSaves = $<HTMLButtonElement>('saves');
const btnFullscreen = $<HTMLButtonElement>('fullscreen');
const btnMute = $<HTMLButtonElement>('mute');
const volume = $<HTMLInputElement>('volume');
const touch = $<HTMLDivElement>('touch');
const stage = $<HTMLElement>('stage');
const help = $<HTMLDialogElement>('help');
const savesDialog = $<HTMLDialogElement>('saves-dialog');

const audio = new AudioOutput();
let aspectRatio = 4 / 3;
let gameLoaded = false;
let userPaused = false;
let pendingFrame: { width: number; height: number; pixels: ArrayBuffer } | null = null;
let store: SaveStore;

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

/** A message with action buttons above the game. */
function showNotice(text: string, actions: [string, () => void][]): void {
  notice.replaceChildren(text);
  for (const [label, fn] of actions) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      notice.hidden = true;
      fn();
    });
    notice.append(' ', b);
  }
  notice.hidden = false;
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

function applyAv(av: AvInfo): void {
  aspectRatio = av.aspectRatio > 0 ? av.aspectRatio : 4 / 3;
  layout();
}

function thumbnail(): Promise<Uint8Array | null> {
  draw();
  return new Promise((resolve) =>
    canvas.toBlob(async (blob) => resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null), 'image/png'),
  );
}

// ---------- Emulator and session ----------

const emulator = new Emulator(audio, {
  frame: (width, height, pixels) => (pendingFrame = { width, height, pixels }),
  av: applyAv,
  saveRam: (data) => session.handleSaveRam(data),
  error: (message) => setStatus(message, true),
});
const input = new Input((port, mask) => emulator.send({ type: 'input', port, mask }));
let session: Session;
let saves: SavesDialog;

function loop(): void {
  input.update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- Loading games ----------

async function openFile(file: File): Promise<void> {
  audio.unlock();
  const error = await openGame(file.name, new Uint8Array(await file.arrayBuffer()));
  if (!error) await offerResume();
}

/** Starts a game. Returns an error message, or null when it is running. */
async function openGame(name: string, bytes: Uint8Array): Promise<string | null> {
  notice.hidden = true;
  setStatus(`Starting ${name}…`);
  try {
    const result = await session.open({ name, bytes });
    if (typeof result === 'string') {
      setStatus(result, true);
      return result;
    }
    gameLoaded = true;
    userPaused = false;
    hint.hidden = true;
    btnPause.disabled = btnReset.disabled = false;
    btnPause.textContent = 'Pause';
    document.body.dataset.system = session.current!.game.system;
    applyAv(result);
    setStatus(audio.available ? '' : 'Sound is not available in this browser.');
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(message, true);
    return message;
  }
}

async function offerResume(): Promise<void> {
  const states = await session.states();
  const resume = states.find((s) => s.slot === 'resume');
  if (resume) {
    // Wait for the answer before playing, so the old position is not replaced.
    setPaused(true);
    const go = () => {
      session.releaseResume();
      if (!userPaused) setPaused(false);
    };
    showNotice(`Continue where you left off (${new Date(resume.createdAt).toLocaleString()})?`, [
      ['Continue', () => void session.loadState('resume').then((e) => (e && setStatus(e, true), go()))],
      ['Start over', go],
    ]);
  } else if (await session.needsBackupReminder()) {
    showNotice('Your saves are stored only on this device. Make a backup now and then.', [
      ['Back up now', () => void session.exportBackup(false)],
      ['Later', () => {}],
    ]);
  }
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
  emulator.send({ type: paused ? 'pause' : 'resume' });
  session.setPlaying(!paused);
  btnPause.textContent = paused ? 'Resume' : 'Pause';
}

btnPause.addEventListener('click', () => {
  userPaused = !userPaused;
  setPaused(userPaused);
  btnPause.blur();
});
btnReset.addEventListener('click', () => {
  emulator.send({ type: 'reset' });
  btnReset.blur();
});

btnSaves.addEventListener('click', () => {
  btnSaves.blur();
  input.enabled = false;
  setPaused(true);
  void saves.open();
});
savesDialog.addEventListener('close', () => {
  input.enabled = true;
  if (!userPaused) setPaused(false);
});

window.addEventListener('keydown', (e) => {
  if (!gameLoaded || savesDialog.open || e.repeat) return;
  if (e.key === 'F2') {
    e.preventDefault();
    session.saveState(QUICK_SLOT).then(
      () => setStatus('Saved to slot 1.'),
      (err) => setStatus(String(err.message ?? err), true),
    );
  } else if (e.key === 'F4') {
    e.preventDefault();
    void session.loadState(QUICK_SLOT).then((err) => setStatus(err ?? 'Loaded slot 1.', !!err));
  }
});

// Leaving the page or switching tabs: pause and keep the progress.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setPaused(true);
    if (gameLoaded) void session.saveResume();
  } else if (!userPaused && !savesDialog.open) setPaused(false);
});
window.addEventListener('pagehide', () => {
  if (gameLoaded) session.saveResumeNow();
});

// Audio may only start after a user action.
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}

async function saveAudioSettings(): Promise<void> {
  const s = await store.getSettings();
  await store.putSettings({ ...s, volume: audio.currentVolume, muted: audio.isMuted });
}
volume.addEventListener('input', () => {
  audio.setVolume(Number(volume.value));
  if (audio.isMuted) toggleMute();
});
volume.addEventListener('change', () => void saveAudioSettings());
function toggleMute(): void {
  audio.setMuted(!audio.isMuted);
  btnMute.textContent = audio.isMuted ? '🔇' : '🔊';
  btnMute.setAttribute('aria-label', audio.isMuted ? 'Unmute' : 'Mute');
}
btnMute.addEventListener('click', () => {
  toggleMute();
  void saveAudioSettings();
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
  setStatus('Loading…');
  try {
    store = isDesktop ? new FileStore(desktopFiles) : await IdbStore.open();
  } catch {
    store = new MemoryStore();
    showNotice('This browser does not allow saving. Saves disappear when you close the page; use Saves → Back up to keep them.', [['OK', () => {}]]);
  }
  const settings = await store.getSettings();
  if (settings.volume !== undefined) {
    volume.value = String(settings.volume);
    audio.setVolume(settings.volume);
  }
  if (settings.muted) toggleMute();
  session = new Session(store, emulator, thumbnail, __SOURCE_SHA__);
  session.onStill = (png) => {
    if (!userPaused) return; // a running game draws the restored picture right away
    void createImageBitmap(new Blob([png as BlobPart], { type: 'image/png' })).then((img) => {
      pendingFrame = null;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    });
  };
  saves = new SavesDialog(savesDialog, session, {
    status: setStatus,
    done: () => savesDialog.close(),
  });
  await audio.init();
  btnOpen.disabled = false;
  btnSaves.disabled = false;
  setStatus('');
  if (isDesktop && (await invoke<boolean>('selftest_enabled'))) await selfTest();
}

async function selfTest(): Promise<void> {
  const { runSelfTest } = await import('../selftest/run');
  const { passed, report } = await runSelfTest({ open: openGame, session, store, canvas, audioAvailable: audio.available });
  await invoke('selftest_report', { passed, report });
}

void start();
