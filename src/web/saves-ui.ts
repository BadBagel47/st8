// The "Saves" dialog: save state slots, automatic states, the game's own
// save file and backup.

import { isDesktop } from './desktop';
import { pickFile } from './platform';
import { MANUAL_SLOTS, slotLabel, type Session } from './session';
import type { StateSummary } from './storage/types';

interface UiHooks {
  status(text: string, isError?: boolean): void;
  /** Called after a state was loaded or the game restarted, to close the dialog. */
  done(): void;
}

const time = (t: number) =>
  new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function button(text: string, onClick: () => unknown, cls = ''): HTMLButtonElement {
  const b = el('button', { type: 'button', class: cls }, text);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await onClick();
    } finally {
      b.disabled = false;
    }
  });
  return b;
}

export class SavesDialog {
  private urls: string[] = [];

  constructor(
    private dialog: HTMLDialogElement,
    private session: Session,
    private hooks: UiHooks,
  ) {
    dialog.addEventListener('close', () => this.releaseUrls());
    session.onChange = () => {
      if (dialog.open) void this.render();
    };
  }

  async open(): Promise<void> {
    await this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  private releaseUrls(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];
  }

  private thumb(state: StateSummary | undefined): HTMLElement {
    if (!state?.thumbnail) return el('div', { class: 'thumb empty' }, 'Empty');
    const url = URL.createObjectURL(new Blob([state.thumbnail as BlobPart], { type: 'image/png' }));
    this.urls.push(url);
    return el('img', { class: 'thumb', src: url, alt: '' });
  }

  private async render(): Promise<void> {
    const { session } = this;
    this.releaseUrls();
    const body = el('div', { class: 'saves-body' });
    const cur = session.current;

    if (cur) {
      const states = await session.states();
      const bySlot = new Map(states.map((s) => [s.slot, s]));
      body.append(el('h3', {}, cur.game.name));

      const manual = el('div', { class: 'slots' });
      for (const slot of MANUAL_SLOTS) {
        const s = bySlot.get(slot);
        const actions = el('div', { class: 'slot-actions' }, button('Save here', () => this.save(slot)));
        if (s) actions.append(button('Load', () => this.load(slot), 'primary'));
        manual.append(
          el('div', { class: 'slot' }, this.thumb(s), el('div', { class: 'slot-name' }, slotLabel(slot)), el('div', { class: 'slot-time' }, s ? time(s.createdAt) : '—'), actions),
        );
      }
      body.append(manual, el('p', { class: 'small' }, 'Keyboard: F2 saves to slot 1, F4 loads slot 1.'));

      const auto = states.filter((s) => !MANUAL_SLOTS.includes(s.slot)).sort((a, b) => b.createdAt - a.createdAt);
      if (auto.length) {
        body.append(el('h4', {}, 'Automatic and kept'));
        const list = el('div', { class: 'slots' });
        for (const s of auto) {
          list.append(
            el('div', { class: 'slot' }, this.thumb(s), el('div', { class: 'slot-name' }, slotLabel(s.slot)), el('div', { class: 'slot-time' }, time(s.createdAt)),
              el('div', { class: 'slot-actions' }, button('Load', () => this.load(s.slot), 'primary'))),
          );
        }
        body.append(list);
      }

      body.append(el('h4', {}, 'Game save file'));
      const save = await session.batterySave();
      if (save) {
        body.append(el('p', {}, `The game's own save, stored automatically. Last changed ${time(save.updatedAt)}.`));
      } else {
        body.append(el('p', { class: 'small' }, 'This game has not saved anything of its own (yet).'));
      }
      const fileActions = el('div', { class: 'row' });
      if (save) fileActions.append(button('Export save file', () => session.exportSaveFile()));
      fileActions.append(button('Import save file…', () => this.importSaveFile()));
      body.append(fileActions);
      if (save?.history.length) {
        body.append(el('p', { class: 'small' }, 'Older copies, kept when a save file was replaced:'));
        const list = el('ul', { class: 'history' });
        save.history.forEach((h, i) =>
          list.append(el('li', {}, `${time(h.updatedAt)} (${h.data.length} bytes) `, button('Use this copy', () => this.useOlder(i)))),
        );
        body.append(list);
      }
    } else {
      body.append(el('p', { class: 'small' }, 'Open a game to save and load its states.'));
    }

    body.append(el('h3', {}, 'Backup'));
    const { lastBackupAt } = await session.store.getSettings();
    body.append(
      el('p', {}, `Last full backup: ${lastBackupAt ? time(lastBackupAt) : 'never'}.`),
      el('p', { class: 'small' }, isDesktop
        ? "Saves are stored in st8's data folder on this computer. Make a backup now and then, for example before reinstalling. Backups contain saves and settings, never game files."
        : 'Saves are stored only on this device. A browser may delete them when storage runs low or when you clear site data, so make a backup now and then. Backups contain saves and settings, never game files.'),
    );
    const backupActions = el('div', { class: 'row' }, button('Back up everything', () => this.backup(false), 'primary'));
    if (cur) backupActions.append(button('Back up this game', () => this.backup(true)));
    backupActions.append(button('Restore from backup…', () => this.restore()));
    body.append(backupActions);

    this.dialog.querySelector('.saves-body')?.replaceWith(body);
  }

  private async save(slot: string): Promise<void> {
    try {
      await this.session.saveState(slot);
      this.hooks.status(`Saved to ${slotLabel(slot).toLowerCase()}.`);
    } catch (err) {
      this.hooks.status(err instanceof Error ? err.message : String(err), true);
    }
  }

  private async load(slot: string): Promise<void> {
    const error = await this.session.loadState(slot);
    if (error) return this.hooks.status(error, true);
    this.hooks.status(`Loaded ${slotLabel(slot).toLowerCase()}.`);
    this.hooks.done();
  }

  private async importSaveFile(): Promise<void> {
    const file = await pickFile();
    if (!file) return;
    const data = new Uint8Array(await file.arrayBuffer());
    if (data.length === 0 || data.length > 1 << 20) return this.hooks.status(`"${file.name}" does not look like a save file.`, true);
    await this.session.replaceSaveFile(data, file.lastModified || Date.now());
    this.hooks.status('Save file imported and the game restarted. Your previous progress is kept as a save state.');
    this.hooks.done();
  }

  private async useOlder(index: number): Promise<void> {
    await this.session.useOlderSave(index);
    this.hooks.status('Switched save file and restarted the game. Your previous progress is kept as a save state.');
    this.hooks.done();
  }

  private async backup(onlyCurrent: boolean): Promise<void> {
    try {
      if (await this.session.exportBackup(onlyCurrent)) this.hooks.status('Backup saved.');
    } catch (err) {
      this.hooks.status(`Backup failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }

  private async restore(): Promise<void> {
    const file = await pickFile('.zip,application/zip');
    if (!file) return;
    try {
      const r = await this.session.restoreBackup(new Uint8Array(await file.arrayBuffer()));
      const parts = [`${r.saves} save files`, `${r.states} save states`];
      let text = `Restored ${parts.join(' and ')}.`;
      if (r.kept) text += ` ${r.kept} older copies were kept instead of being overwritten.`;
      if (r.restarted) text += ' The game restarted with the restored save file; your previous progress is kept as a save state.';
      this.hooks.status(text);
    } catch (err) {
      this.hooks.status(err instanceof Error ? err.message : String(err), true);
    }
  }
}
