# st8

A NES and SNES emulator for the web, with a desktop version for Mac and Linux planned. A non-commercial hobby project.

**Play:** https://badbagel47.github.io/st8/

Load your own game files (`.nes`, `.sfc`, `.smc`). They are read on your device and never uploaded. No games are included.

## How it works

st8 does not contain its own emulation code. It runs established open-source emulator engines, built unchanged from their source to WebAssembly, behind a small shell:

- NES: [Mesen](https://github.com/libretro/Mesen) (libretro core)
- SNES: [Snes9x](https://github.com/snes9xgit/snes9x)

The engines talk to the shell through the [libretro](https://www.libretro.com/) API. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ENGINES.md](docs/ENGINES.md).

## Building

Requirements: Node 22, git, make, and the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (version 7.0.0) activated in the shell.

```bash
git clone https://github.com/BadBagel47/st8.git
cd st8
git submodule update --init   # the engines (not their own submodules)
npm ci
npm run build:engines   # builds the engines to WebAssembly (needs emcc)
npm test                # engine tests in Node
npm run dev             # local development server
npm run build           # production build in dist/
npm run test:e2e        # browser smoke test of dist/
```

## Licence

st8 is licensed under the GNU General Public License v3.0 or later, see [LICENSE](LICENSE).
The engines keep their own licences; the app's licences page lists them with links to the exact source used.
Snes9x may only be used non-commercially.
