// Sets up the audio worklet and volume control. Browsers only allow sound
// after a user action, so unlock() is called from click and key handlers.

import workletUrl from './audio-worklet.ts?worker&url';

export class AudioOutput {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private volume = 0.8;
  private muted = false;

  /** Creates the audio graph and returns the port the emulator worker writes to. */
  async init(): Promise<MessagePort | null> {
    if (typeof AudioWorkletNode === 'undefined') return null;
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      await this.ctx.audioWorklet.addModule(workletUrl);
      const node = new AudioWorkletNode(this.ctx, 'st8-audio', { outputChannelCount: [2] });
      this.gain = this.ctx.createGain();
      this.applyVolume();
      node.connect(this.gain).connect(this.ctx.destination);
      const channel = new MessageChannel();
      node.port.postMessage({ type: 'port' }, [channel.port2]);
      return channel.port1;
    } catch (err) {
      console.warn('Audio is not available', err);
      this.ctx = null;
      return null;
    }
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

  get isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume * this.volume;
  }
}
