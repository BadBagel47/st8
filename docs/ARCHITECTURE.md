# Architecture (D-002)

Status: approved 2026-11-13 and implemented: web (F-003 to F-011, F-006, F-010), SNES (F-007), desktop for Mac and Linux (F-008).

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

Why this replaces the earlier Rust recommendation: Rust was recommended when the plan was to write the engine ourselves. With ready-made engines delivered as WebAssembly, everything the shell does is browser functionality (canvas, audio, gamepad, storage), which TypeScript reaches directly. Tauri (itself Rust based) gives a real installable program for Mac and Linux (Windows is out of scope) with file access, at small size.

Main benefit: web and desktop run the identical engine files, so behaviour and save states are the same everywhere, and a backup made on the web can be restored on desktop and back.

Alternative: a native desktop shell in Rust loading natively built engines. Faster, but twice the shell work, and whether save states are interchangeable between the native and the WebAssembly builds is unverified.

## Saves and backup

Implemented in F-006 and F-010 (src/web/session.ts, src/web/backup.ts, src/web/storage/).

Three kinds of data per game:

- Battery save: the game's own save memory (`.srm`). Small, standard format that other emulators also read. The worker checks it once a second and the page stores it when it changed, and again when pausing or leaving.
- Save states: full snapshots made by the engine. Slots: four manual slots ("1"–"4", F2/F4 use slot 1), "resume" (where you left off), three rolling automatic states ("auto-1".."auto-3", one every 5 minutes of play) and "kept-<time>" copies. Each state stores time, a PNG thumbnail and the exact engine (id, version, commit).
- Settings: volume and mute, time of the last full backup.

"Resume" is written every 5 seconds while playing, when pausing and when the tab is hidden, so closing the page loses at most a few seconds. When a game with a resume state is opened, the game waits until the user chooses Continue or Start over; until then the old resume state is never overwritten.

Nothing is overwritten silently:
- Replacing the battery save (import of a `.srm`, choosing an older copy, a restore with a newer save) first keeps the progress in memory as a "kept" save state, moves the old save file into the save's history (up to 10 copies), then restarts the game with the new save.
- A restore that meets a different state in the same slot keeps the newer one in the slot and the older one as a "kept" state.

Game identity is the SHA-256 of the ROM content, so saves follow the game regardless of file name.

Storage:
- Web: IndexedDB (database "st8": games, saves, states, settings). The app asks the browser for persistent storage the first time something is saved. Browsers can still clear site data, which is why backup matters. If IndexedDB is unavailable, saves live in memory only and the app says so.
- Desktop: plain files in the app's data folder (`<app data>/data/`, e.g. `~/.local/share/io.github.badbagel47.st8/data` on Linux and `~/Library/Application Support/io.github.badbagel47.st8/data` on macOS), in the same layout as the backup format, written atomically (temporary file, then rename). Code: `src/web/storage/files.ts` and `desktop/src/main.rs`, which only allows paths inside that folder.

Backup format (one ZIP file, `st8-backup-<date>.zip`, or `st8-backup-<game>-<date>.zip` for one game):

```
manifest.json                                   format "st8-backup", version 1, games, saves, states (with metadata)
settings.json
saves/<system>/<romhash>.srm                    battery save
saves/<system>/<romhash>.history-<n>.srm        older copies
states/<system>/<romhash>/<slot>.state
states/<system>/<romhash>/<slot>.png            thumbnail
```

- Export: everything, or one game. Never contains ROM files.
- Restore: merges, by the rules above. Restoring the same backup twice changes nothing.
- A single battery save can be exported and imported as a plain `.srm` for use with other emulators.
- The app shows when the last full backup was made, and when opening a game reminds about backup if there are saves newer than a backup that is more than 7 days old.

Save state compatibility: a save state belongs to the engine version that made it. Engine versions are pinned, every state records its engine, and loading a state from another version gives a clear message. Battery saves do not have this limitation and are the long-term safe format; the app keeps both. Before an engine upgrade, check that states from the previous version still load.

## Build and publishing

- Build: GitHub Actions builds the engines with Emscripten (cached per pinned commit) and the shell, then deploys to GitHub Pages.
- Note for F-009: pushes made by the auto-merge workflow use the built-in token and do not start other "on push" workflows. The deploy workflow must therefore also start on completion of the auto-merge workflow (`workflow_run`), or be branch-based.
- Desktop: `desktop/` is a Tauri 2 app that embeds the same built web app (dist/) and engine files. `.github/workflows/desktop.yml` builds a universal macOS app (dmg) and Linux AppImage and deb, runs the self-test in a real window on both, and publishes the files on the `desktop-latest` release.
- Self-test: started with `ST8_SELFTEST=1`; plays the NES and SNES test ROMs in the app window, saves and loads a state, checks that state and save file are stored as files and that a backup round trip works, prints PASS/FAIL lines and exits with 0 on success (`src/selftest/run.ts`).

## Testing

- Core host tests in Node with script-generated test ROMs: load, run, video/audio produced, save state round-trip, battery save round-trip, backup export/restore round-trip.
- Browser smoke test with Playwright: page loads, a test ROM runs, a frame is drawn.

## Privacy and storage rules (preliminary, not legal advice)

All data stays on the user's device; there is no server, account, analytics or third-party content. Local storage of the user's own saves is storage the user explicitly asks for. The Swedish rules on storing data on a user's device (LEK ch. 9 s. 28, supervised by PTS) are assessed in F-006; the plan is a short plain-language notice in the app and no tracking of any kind.
