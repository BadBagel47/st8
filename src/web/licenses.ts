// Fills in the exact source versions on the licences page.

interface EngineEntry {
  name: string;
  system: string;
  licence: string;
  licenceFile: string;
  source: string;
  commit: string;
}

const LICENCE_NAMES: Record<string, string> = {
  'GPL-3.0': 'GNU General Public License v3.0',
};

const appLink = document.getElementById('app-source') as HTMLAnchorElement;
const appUrl = __SOURCE_SHA__ === 'unknown' ? __REPO_URL__ : `${__REPO_URL__}/tree/${__SOURCE_SHA__}`;
appLink.href = appUrl;
appLink.textContent = appUrl;

const container = document.getElementById('engines')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  return e;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el('a', text);
  a.href = href;
  return a;
}

fetch('./cores/manifest.json')
  .then((r) => r.json() as Promise<{ engines: EngineEntry[] }>)
  .then(({ engines }) => {
    for (const e of engines) {
      container.append(el('h2', `${e.name} (${e.system.toUpperCase()} engine)`));
      const p = el('p');
      const sourceUrl = `${e.source}/tree/${e.commit}`;
      p.append(
        'Licence: ',
        link(`./${e.licenceFile}`, LICENCE_NAMES[e.licence] ?? e.licence),
        el('br'),
        'Source code of exactly the version used here: ',
        link(sourceUrl, sourceUrl),
        el('br'),
        'Built without changes from that source, by the build script in the st8 repository.',
      );
      container.append(p);
    }
  })
  .catch(() => {
    container.append(el('p', 'The engine list could not be loaded.'));
  });
