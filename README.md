# st8

A NES and SNES emulator for the web and for Mac and Linux. A non-commercial hobby project.

**Play in the browser:** https://badbagel47.github.io/st8/

**Desktop app:** download from the [desktop-latest release](https://github.com/BadBagel47/st8/releases/tag/desktop-latest).
- macOS (Apple silicon and Intel): `st8-macos-universal.dmg`. Open it and drag st8 to Applications. st8 is not signed by a registered Apple developer, so macOS blocks it the first time ("Apple could not verify…"). Choose Done (not Move to Trash), then open System Settings → Privacy & Security, scroll down to Security and click Open Anyway next to st8, and confirm. After that it opens normally. Alternatively, in Terminal: `xattr -dr com.apple.quarantine /Applications/st8.app`
- Linux: `st8-linux-x86_64.AppImage` (make it executable and run it) or `st8-linux-amd64.deb`.

Save states, the games' own save files and backup work the same in both. A backup made in the browser can be restored in the desktop app and the other way round.

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
npm run test:e2e        # browser tests of dist/
```

Desktop app (needs Rust, and on Linux the WebKitGTK 4.1 development packages, see `.github/workflows/desktop.yml`):

```bash
npm run desktop:dev     # run the desktop app against the dev server
npm run desktop:build   # build installers in desktop/target/release/bundle/
ST8_SELFTEST=1 desktop/target/release/st8   # self-test in a real window
```

## Licence

st8 is licensed under the GNU General Public License v3.0 or later, see [LICENSE](LICENSE).
The engines keep their own licences; the app's licences page lists them with links to the exact source used.
Snes9x may only be used non-commercially.
