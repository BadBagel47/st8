import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CoreHost, type EngineFactory } from '../src/core/host';
import { BUTTON } from '../src/core/libretro';
import { nesTestRom } from './roms';

const enginePath = resolve(__dirname, '../public/cores/mesen.mjs');
const haveEngine = existsSync(enginePath);
if (!haveEngine) console.warn('Engine not built; run "npm run build:engines" first.');

async function nesHost(): Promise<CoreHost> {
  const factory = (await import(pathToFileURL(enginePath).href)).default as EngineFactory;
  const host = await CoreHost.create(factory);
  expect(host.loadGame(nesTestRom(), 'test.nes')).toBe(true);
  return host;
}

const counter = (host: CoreHost) => host.getSystemRam()![0];
const pad = (host: CoreHost) => host.getSystemRam()![1];

describe.skipIf(!haveEngine)('NES engine (Mesen) through the core host', () => {
  it('reports engine info and timing', async () => {
    const host = await nesHost();
    expect(host.info.name).toBe('Mesen');
    expect(host.info.extensions).toContain('nes');
    expect(host.av.fps).toBeGreaterThan(59);
    expect(host.av.fps).toBeLessThan(61);
    expect(host.av.sampleRate).toBeGreaterThan(0);
  });

  it('produces video frames that change with the game', async () => {
    const host = await nesHost();
    for (let i = 0; i < 10; i++) host.runFrame();
    expect(host.frameWidth).toBe(256);
    expect(host.frameHeight).toBeGreaterThanOrEqual(224);
    const first = host.frame.slice();
    expect(first[3]).toBe(255); // opaque
    host.runFrame();
    expect(host.frame).not.toEqual(first); // background colour follows the counter
  });

  it('produces about one frame of stereo audio per frame', async () => {
    const host = await nesHost();
    host.takeAudio();
    for (let i = 0; i < 60; i++) host.runFrame();
    const samples = host.takeAudio().length / 2;
    expect(samples).toBeGreaterThan(host.av.sampleRate * 0.9);
    expect(samples).toBeLessThan(host.av.sampleRate * 1.1);
  });

  it('passes controller buttons to the game', async () => {
    const host = await nesHost();
    for (let i = 0; i < 5; i++) host.runFrame();
    expect(pad(host)).toBe(0);
    host.setButtons(0, (1 << BUTTON.A) | (1 << BUTTON.RIGHT));
    for (let i = 0; i < 3; i++) host.runFrame();
    expect(pad(host)).toBe(0b1000_0001);
    host.setButtons(0, (1 << BUTTON.START) | (1 << BUTTON.UP));
    for (let i = 0; i < 3; i++) host.runFrame();
    expect(pad(host)).toBe(0b0001_1000);
  });

  it('restores a save state to the exact same point', async () => {
    const host = await nesHost();
    for (let i = 0; i < 30; i++) host.runFrame();
    const state = host.saveState();
    const atSave = counter(host);
    for (let i = 0; i < 30; i++) host.runFrame();
    const later = counter(host);
    const laterFrame = host.frame.slice();
    expect(later).not.toBe(atSave);
    expect(host.loadState(state)).toBe(true);
    expect(counter(host)).toBe(atSave);
    for (let i = 0; i < 30; i++) host.runFrame();
    expect(counter(host)).toBe(later);
    expect(host.frame).toEqual(laterFrame);
  });

  it('exposes the battery save and restores it', async () => {
    const host = await nesHost();
    for (let i = 0; i < 20; i++) host.runFrame();
    const save = host.getSaveRam();
    expect(save).not.toBeNull();
    expect(save![0]).toBe(counter(host));

    const fresh = await nesHost();
    const data = new Uint8Array(save!.length);
    data[0] = 0x42;
    expect(fresh.setSaveRam(data)).toBe(true);
    expect(fresh.getSaveRam()![0]).toBe(0x42);
  });

  it('rejects files that are not NES games', async () => {
    const factory = (await import(pathToFileURL(enginePath).href)).default as EngineFactory;
    const host = await CoreHost.create(factory);
    expect(host.loadGame(new Uint8Array(1000), 'junk.nes')).toBe(false);
  });
});
