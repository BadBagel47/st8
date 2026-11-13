// Sets up the audio worklet and volume control. Browsers only allow sound
// after a user action, so unlock() is called from click and key handlers.

import workletUrl from './audio-worklet.ts?worker&url';

export class AudioOutput {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private volume = 0.8;
  private muted = false;
  private node: AudioWorkletNode | null = null;

  /** Creates the audio graph. */
  async init(): Promise<void> {
    if (typeof AudioWorkletNode === 'undefined') return;
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      await this.ctx.audioWorklet.addModule(workletUrl);
      this.node = new AudioWorkletNode(this.ctx, 'st8-audio', { outputChannelCount: [2] });
      this.gain = this.ctx.createGain();
      this.applyVolume();
      this.node.connect(this.gain).connect(this.ctx.destination);
    } catch (err) {
      console.warn('Audio is not available', err);
      this.ctx = null;
      this.node = null;
    }
  }

  /** A new port for an emulator worker to send samples to (replaces the previous one). */
  connect(): MessagePort | null {
    if (!this.node) return null;
    const channel = new MessageChannel();
    this.node.port.postMessage({ type: 'port' }, [channel.port2]);
    return channel.port1;
  }

  unlock(): void {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  get available(): boolean {
    return this.ctx !== null;
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  get currentVolume(): number {
    return this.volume;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume * this.volume;
  }
}
