import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CoreHost, type EngineFactory } from '../src/core/host';
import { BUTTON } from '../src/core/libretro';
import { snesTestRom } from './roms';

const enginePath = resolve(__dirname, '../public/cores/snes9x.mjs');
const haveEngine = existsSync(enginePath);
if (!haveEngine) console.warn('Engine not built; run "npm run build:engines" first.');

async function snesHost(): Promise<CoreHost> {
  const factory = (await import(pathToFileURL(enginePath).href)).default as EngineFactory;
  const host = await CoreHost.create(factory);
  expect(host.loadGame(snesTestRom(), 'test.sfc')).toBe(true);
  return host;
}

const wram = (host: CoreHost) => host.getSystemRam()!;

describe.skipIf(!haveEngine)('SNES engine (Snes9x) through the core host', () => {
  it('reports engine info and timing', async () => {
    const host = await snesHost();
    expect(host.info.name).toBe('Snes9x');
    expect(host.info.extensions).toContain('sfc');
    expect(host.av.fps).toBeGreaterThan(59);
    expect(host.av.fps).toBeLessThan(61);
    expect(host.av.sampleRate).toBe(32040);
  });

  it('runs the game and produces changing video and audio', async () => {
    const host = await snesHost();
    host.takeAudio();
    for (let i = 0; i < 60; i++) host.runFrame();
    expect(host.frameWidth).toBe(256);
    expect(host.frameHeight).toBe(224);
    expect(wram(host)[0]).toBeGreaterThan(50);
    const samples = host.takeAudio().length / 2;
    expect(samples).toBeGreaterThan(32040 * 0.9);
    expect(samples).toBeLessThan(32040 * 1.1);
    const first = host.frame.slice();
    host.runFrame();
    expect(host.frame).not.toEqual(first);
  });

  it('passes all SNES buttons to the game', async () => {
    const host = await snesHost();
    for (let i = 0; i < 5; i++) host.runFrame();
    host.setButtons(0, (1 << BUTTON.B) | (1 << BUTTON.RIGHT) | (1 << BUTTON.A) | (1 << BUTTON.R));
    for (let i = 0; i < 3; i++) host.runFrame();
    expect(wram(host)[2]).toBe(0b1000_0001); // JOY1H: B ... Right
    expect(wram(host)[1]).toBe(0b1001_0000); // JOY1L: A X L R
    host.setButtons(0, (1 << BUTTON.Y) | (1 << BUTTON.X) | (1 << BUTTON.L) | (1 << BUTTON.START));
    for (let i = 0; i < 3; i++) host.runFrame();
    expect(wram(host)[2]).toBe(0b0101_0000);
    expect(wram(host)[1]).toBe(0b0110_0000);
  });

  it('restores a save state to the exact same point', async () => {
    const host = await snesHost();
    for (let i = 0; i < 30; i++) host.runFrame();
    const state = host.saveState();
    const atSave = wram(host)[0];
    for (let i = 0; i < 30; i++) host.runFrame();
    const later = wram(host)[0];
    const laterFrame = host.frame.slice();
    expect(host.loadState(state)).toBe(true);
    expect(wram(host)[0]).toBe(atSave);
    for (let i = 0; i < 30; i++) host.runFrame();
    expect(wram(host)[0]).toBe(later);
    expect(host.frame).toEqual(laterFrame);
  });

  it('exposes the battery save and restores it', async () => {
    const host = await snesHost();
    for (let i = 0; i < 20; i++) host.runFrame();
    const save = host.getSaveRam()!;
    expect(save.length).toBe(2048);
    expect(save[0]).toBe(wram(host)[0]);
    const fresh = await snesHost();
    const data = new Uint8Array(2048);
    data[0] = 0x42;
    expect(fresh.setSaveRam(data)).toBe(true);
    expect(fresh.getSaveRam()![0]).toBe(0x42);
  });
});
