// Keyboard, gamepad and touch input, merged into one button mask per port.

import { BUTTON, type ButtonName } from '../core/libretro';

export const KEYBOARD: Record<string, ButtonName> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyX: 'A',
  KeyZ: 'B',
  KeyS: 'X',
  KeyA: 'Y',
  KeyQ: 'L',
  KeyW: 'R',
  Enter: 'START',
  ShiftRight: 'SELECT',
  Backspace: 'SELECT',
};

// Standard gamepad layout (https://w3c.github.io/gamepad/#remapping).
// Buttons by position, as on a SNES pad: bottom = B, right = A, left = Y, top = X.
const GAMEPAD_BUTTONS: [number, ButtonName][] = [
  [0, 'B'],
  [1, 'A'],
  [2, 'Y'],
  [3, 'X'],
  [4, 'L'],
  [5, 'R'],
  [8, 'SELECT'],
  [9, 'START'],
  [12, 'UP'],
  [13, 'DOWN'],
  [14, 'LEFT'],
  [15, 'RIGHT'],
];

const bit = (name: ButtonName) => 1 << BUTTON[name];
const STICK_THRESHOLD = 0.5;

export class Input {
  private keyMask = 0;
  private touchMask = 0;
  private sent = [-1, -1];
  enabled = true;

  constructor(private send: (port: number, mask: number) => void) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.keyMask = 0;
    });
  }

  setTouchMask(mask: number): void {
    this.touchMask = mask;
  }

  /** Call once per animation frame: polls gamepads and sends changes. */
  update(): void {
    const masks = [this.keyMask | this.touchMask, 0];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let port = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected || port > 1) continue;
      masks[port] |= gamepadMask(pad);
      port++;
    }
    for (let p = 0; p < 2; p++) {
      const mask = this.enabled ? masks[p] : 0;
      if (mask !== this.sent[p]) {
        this.sent[p] = mask;
        this.send(p, mask);
      }
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) {
      if (target.getAttribute('type') !== 'range') return;
    }
    const name = KEYBOARD[e.code];
    if (!name || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (down) this.keyMask |= bit(name);
    else this.keyMask &= ~bit(name);
  }
}

function gamepadMask(pad: Gamepad): number {
  let mask = 0;
  for (const [index, name] of GAMEPAD_BUTTONS) {
    if (pad.buttons[index]?.pressed) mask |= bit(name);
  }
  const [x = 0, y = 0] = pad.axes;
  if (x < -STICK_THRESHOLD) mask |= bit('LEFT');
  if (x > STICK_THRESHOLD) mask |= bit('RIGHT');
  if (y < -STICK_THRESHOLD) mask |= bit('UP');
  if (y > STICK_THRESHOLD) mask |= bit('DOWN');
  return mask;
}

/**
 * On-screen controls for touch screens. Each element with data-button="A"
 * (or "UP,LEFT" for diagonals) is a button; fingers may slide between them.
 */
export function attachTouchControls(root: HTMLElement, onChange: (mask: number) => void): void {
  const pointers = new Map<number, number>();
  const maskAt = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-button]');
    if (!el || !root.contains(el)) return 0;
    return el.dataset.button!.split(',').reduce((m, n) => m | bit(n as ButtonName), 0);
  };
  const update = () => {
    let mask = 0;
    for (const m of pointers.values()) mask |= m;
    for (const el of root.querySelectorAll<HTMLElement>('[data-button]')) {
      const own = el.dataset.button!.split(',').reduce((m, n) => m | bit(n as ButtonName), 0);
      el.classList.toggle('pressed', (mask & own) === own);
    }
    onChange(mask);
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId) && e.type !== 'pointerdown') return;
    e.preventDefault();
    pointers.set(e.pointerId, maskAt(e.clientX, e.clientY));
    update();
  };
  const end = (e: PointerEvent) => {
    if (pointers.delete(e.pointerId)) update();
  };
  root.addEventListener('pointerdown', (e) => {
    root.setPointerCapture?.(e.pointerId);
    move(e);
  });
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
}
