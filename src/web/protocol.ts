// Messages between the page and the emulator worker.

import type { AvInfo, SystemInfo } from '../core/host';

export type WorkerRequest =
  | { op: 'saveState' }
  | { op: 'loadState'; data: ArrayBuffer }
  | { op: 'getSaveRam' };

export type ToWorker =
  | { type: 'init'; engineUrl: string; audioPort: MessagePort | null }
  | { type: 'load'; bytes: ArrayBuffer; fileName: string; saveRam: ArrayBuffer | null }
  | { type: 'input'; port: number; mask: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | ({ type: 'request'; id: number } & WorkerRequest);

export type FromWorker =
  | { type: 'ready'; info: SystemInfo }
  | { type: 'loaded'; av: AvInfo }
  | { type: 'frame'; width: number; height: number; pixels: ArrayBuffer }
  | { type: 'av'; av: AvInfo }
  | { type: 'saveRam'; data: ArrayBuffer }
  | { type: 'reply'; id: number; ok: boolean; data?: ArrayBuffer | null; error?: string }
  | { type: 'error'; message: string };

export type ToAudio =
  | { type: 'config'; inputRate: number }
  | { type: 'samples'; samples: Float32Array }
  | { type: 'clear' };
