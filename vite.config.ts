import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

function sourceSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: './',
  define: {
    __SOURCE_SHA__: JSON.stringify(sourceSha()),
    __REPO_URL__: JSON.stringify('https://github.com/BadBagel47/st8'),
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        licenses: resolve(import.meta.dirname, 'licenses.html'),
      },
    },
  },
});
