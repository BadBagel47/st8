// Which engine runs which system, and how to recognise a game file.

import type { EngineRef, System } from './storage/types';

export interface EngineEntry {
  id: string;
  system: System;
  name: string;
  file: string;
  extensions: string[];
}

export const ENGINES: EngineEntry[] = [
  { id: 'mesen', system: 'nes', name: 'NES', file: 'cores/mesen.mjs', extensions: ['nes'] },
  { id: 'snes9x', system: 'snes', name: 'SNES', file: 'cores/snes9x.mjs', extensions: ['sfc', 'smc', 'swc', 'fig'] },
];

const NES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];

/** Picks the engine for a game file, or returns an explanation. */
export function detectEngine(fileName: string, bytes: Uint8Array): EngineEntry | string {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const isNes = NES_MAGIC.every((b, i) => bytes[i] === b);
  const supported = ENGINES.flatMap((e) => e.extensions.map((x) => `.${x}`)).join(', ');
  if (isNes) return ENGINES.find((e) => e.system === 'nes')!;
  const byExt = ENGINES.find((e) => e.extensions.includes(ext) && e.system !== 'nes');
  if (byExt) {
    if (bytes.length < 0x8000) return `"${fileName}" is too small to be a game file.`;
    return byExt;
  }
  if (ext === 'nes') return `"${fileName}" is not a valid NES game file.`;
  return `"${fileName}" is not a supported game file. Supported: ${supported}.`;
}

interface Manifest {
  engines: { id: string; commit: string }[];
}

let manifest: Promise<Manifest> | null = null;

/** Exact engine version, recorded with every save state. */
export async function engineRef(id: string, version: string): Promise<EngineRef> {
  manifest ??= fetch(new URL('cores/manifest.json', document.baseURI))
    .then((r) => r.json() as Promise<Manifest>)
    .catch(() => ({ engines: [] }));
  const commit = (await manifest).engines.find((e) => e.id === id)?.commit ?? 'unknown';
  return { id, version, commit };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}
