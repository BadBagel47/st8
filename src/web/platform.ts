// Things that differ between the web page and the desktop app.

import { isDesktop, saveFileDesktop } from './desktop';

/** Offers a file to the user (download on the web, save dialog on desktop). */
export async function saveFile(name: string, data: Uint8Array, mime = 'application/octet-stream'): Promise<boolean> {
  if (isDesktop) return saveFileDesktop(name, data);
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Lets the user pick a file. Resolves with null if nothing was picked. */
export function pickFile(accept = ''): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
