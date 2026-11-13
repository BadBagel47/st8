# Architecture (D-002)

Status: approved 2026-11-13. Implemented for the web (NES) in F-003 to F-011; saves, SNES and desktop are still to come.

## Goals

- The engines are separate from the shell and are the same on web and desktop.
- Save states and backup are core requirements, designed in from the start.
- Engines can be swapped or added without touching the rest.

## Layers

```
UI (screens, menus, settings)
Platform services: video, audio, input, storage   <- web and desktop implementations
Core host: loads an engine, speaks libretro, no browser/desktop dependencies
Engines: one WebAssembly file per engine (Mesen, Snes9x), built unmodified
```

1. Engines. Each engine is built from pinned upstream source with Emscripten into its own WebAssembly file exposing the libretro API. Engine source is referenced as git submodules (engines/), built by scripts/build-engines.sh, at pinned commits, never copied into the repo. Engines are never linked together (licence separation, see ENGINES.md).

2. Core host. A small library that loads one engine file and offers a plain interface:
   `loadGame(bytes, name)`, `runFrame()`, `setInput(port, buttons)`, `reset()`,
   `saveState() -> bytes`, `loadState(bytes)`, `getBatterySave() -> bytes`, `setBatterySave(bytes)`,
   plus callbacks for a finished video frame and audio samples.
   It has no dependency on the browser page, so it runs in Node for automated tests (as in `poc/engine-check`).

3. Platform services. Narrow interfaces with one implementation per platform:
   - Video: canvas (WebGL with 2D fallback), integer or aspect-correct scaling.
   - Audio: AudioWorklet fed with a ring buffer over a message port (no shared memory needed).
   - Input: keyboard, Gamepad API, touch controls on phones.
   - Storage: see "Saves and backup".
   The emulation runs in a Web Worker so the page stays responsive; timing follows the audio clock.

4. UI. Load a game, play, save/load state, manage saves, backup, settings, licences page.

## Technology

Recommendation: shell in TypeScript; desktop app by packaging the same shell and the same engine files with Tauri.

Why this replaces the earlier Rust recommendation: Rust was recommended when the plan was to write the engine ourselves. With ready-made engines delivered as WebAssembly, everything the shell does is browser functionality (canvas, audio, gamepad, storage), which TypeScript reaches directly. Tauri (itself Rust based) gives a real installable program for Windows, Mac and Linux with file access, at small size.

Main benefit: web and desktop run the identical engine files, so behaviour and save states are the same everywhere, and a backup made on the web can be restored on desktop and back.

Alternative: a native desktop shell in Rust loading natively built engines. Faster, but twice the shell work, and whether save states are interchangeable between the native and the WebAssembly builds is unverified.

## Saves and backup

Three kinds of data per game:

- Battery save: the game's own save memory (`.srm`). Small, standard format that other emulators also read. Written to storage shortly after it changes and when the page is hidden or closed.
- Save states: full snapshots made by the engine. Several manual slots per game, an automatic "resume" state when leaving a game, and a few rolling automatic states. Each state stores time, a screenshot thumbnail, engine name and engine version.
- Settings: key mappings and preferences.

Game identity is the SHA-256 of the ROM content, so saves follow the game regardless of file name.

Storage:
- Web: IndexedDB. The app asks the browser for persistent storage to reduce the risk of eviction. Browsers can still clear site data, which is why backup matters.
- Desktop: plain files in the app's data folder, in the same layout as the backup format.

Backup format (one file, `.st8backup`, a ZIP archive):

```
manifest.json                         format version, created time, app version, list of games
saves/<system>/<romhash>.srm          battery saves, raw standard format
states/<system>/<romhash>/<slot>.state
states/<system>/<romhash>/<slot>.png  thumbnail
settings.json
```

- Export: everything, or one game. Never contains ROM files.
- Restore: merges into existing data. Nothing is overwritten silently: on conflict the newer item wins and the older one is kept as an extra copy.
- Single battery saves can also be exported and imported as plain `.srm` for use with other emulators.
- The app shows when the last backup was made and reminds after a period with new saves.
- Later option: automatic backup to a chosen folder (desktop; and browsers that support folder access).

Save state compatibility: a save state belongs to the engine version that made it. Therefore engine versions are pinned, every state records its engine version, and an engine upgrade is only made after an automated test shows that states from the previous version still load. Battery saves do not have this limitation and are the long-term safe format; the app keeps both.

## Build and publishing

- Build: GitHub Actions builds the engines with Emscripten (cached per pinned commit) and the shell, then deploys to GitHub Pages.
- Note for F-009: pushes made by the auto-merge workflow use the built-in token and do not start other "on push" workflows. The deploy workflow must therefore also start on completion of the auto-merge workflow (`workflow_run`), or be branch-based.
- Desktop builds (later): Tauri build per operating system in GitHub Actions, published as release files.

## Testing

- Core host tests in Node with script-generated test ROMs: load, run, video/audio produced, save state round-trip, battery save round-trip, backup export/restore round-trip.
- Browser smoke test with Playwright: page loads, a test ROM runs, a frame is drawn.

## Privacy and storage rules (preliminary, not legal advice)

All data stays on the user's device; there is no server, account, analytics or third-party content. Local storage of the user's own saves is storage the user explicitly asks for. The Swedish rules on storing data on a user's device (LEK ch. 9 s. 28, supervised by PTS) are assessed in F-006; the plan is a short plain-language notice in the app and no tracking of any kind.
