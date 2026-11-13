// Audio output: buffers samples from the emulator worker and resamples them
// to the device rate. A small dynamic rate adjustment keeps the buffer at a
// steady level, so the emulator clock and the audio clock never drift apart.

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

type Msg =
  | { type: 'port' }
  | { type: 'config'; inputRate: number }
  | { type: 'samples'; samples: Float32Array }
  | { type: 'clear' };

const CAPACITY = 32768; // stereo frames, about 0.7 s at 48 kHz
const TARGET_SECONDS = 0.06;
const MAX_ADJUST = 0.005;

class St8AudioProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(CAPACITY * 2);
  private read = 0; // fractional frame position
  private write = 0; // frame position
  private inputRate = 48000;
  private waiting = true; // refilling after an underrun

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<Msg>) => {
      // The worker sends us its own port; listen to both.
      if (e.data.type === 'port' && e.ports[0]) {
        e.ports[0].onmessage = (ev: MessageEvent<Msg>) => this.handle(ev.data);
        return;
      }
      this.handle(e.data);
    };
  }

  private handle(msg: Msg): void {
    if (msg.type === 'config') this.inputRate = msg.inputRate;
    else if (msg.type === 'clear') {
      this.read = this.write = 0;
      this.waiting = true;
    } else if (msg.type === 'samples') this.push(msg.samples);
  }

  private available(): number {
    return this.write - this.read;
  }

  private push(samples: Float32Array): void {
    const frames = samples.length >> 1;
    for (let i = 0; i < frames; i++) {
      const w = (this.write % CAPACITY) * 2;
      this.buf[w] = samples[i * 2];
      this.buf[w + 1] = samples[i * 2 + 1];
      this.write++;
    }
    // Overflow: drop the oldest audio.
    if (this.available() > CAPACITY - 1) this.read = this.write - (CAPACITY >> 1);
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const [left, right] = outputs[0];
    const n = left.length;
    const target = this.inputRate * TARGET_SECONDS;
    let avail = this.available();

    if (this.waiting && avail >= target) this.waiting = false;
    if (this.waiting) {
      left.fill(0);
      right?.fill(0);
      return true;
    }

    const fill = (avail - target) / target;
    const adjust = 1 + Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, fill * MAX_ADJUST));
    const step = (this.inputRate / sampleRate) * adjust;

    for (let i = 0; i < n; i++) {
      avail = this.write - this.read;
      if (avail < 2) {
        left.fill(0, i);
        right?.fill(0, i);
        this.waiting = true;
        break;
      }
      const pos = Math.floor(this.read);
      const frac = this.read - pos;
      const a = (pos % CAPACITY) * 2;
      const b = ((pos + 1) % CAPACITY) * 2;
      left[i] = this.buf[a] + (this.buf[b] - this.buf[a]) * frac;
      if (right) right[i] = this.buf[a + 1] + (this.buf[b + 1] - this.buf[a + 1]) * frac;
      this.read += step;
    }
    return true;
  }
}

registerProcessor('st8-audio', St8AudioProcessor);
