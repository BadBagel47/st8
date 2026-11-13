// Bridge to the desktop app (Tauri). Not used on the web.

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type InvokeArgs = Record<string, unknown> | Uint8Array;

export async function invoke<T>(cmd: string, args?: InvokeArgs, headers?: Record<string, string>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args as never, headers ? { headers } : undefined);
}

/** File access for the desktop store, confined by the app to its data folder. */
export const desktopFiles = {
  async read(path: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await invoke<ArrayBuffer>('store_read', { path }));
    } catch (err) {
      if (err === 'NOT_FOUND') return null;
      throw err;
    }
  },
  async write(path: string, data: Uint8Array): Promise<void> {
    await invoke('store_write', data, { path: encodeURIComponent(path) });
  },
  list(path: string): Promise<string[]> {
    return invoke<string[]>('store_list', { path });
  },
};

export function saveFileDesktop(name: string, data: Uint8Array): Promise<boolean> {
  return invoke<boolean>('save_file', data, { name: encodeURIComponent(name) });
}
