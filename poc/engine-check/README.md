# Engine check (D-001)

Throwaway proof that the chosen engines build for the browser and that save
states work. Not part of the product; the real build is set up in F-003/F-009.

- `build.sh` fetches both engines at pinned commits, builds them with
  Emscripten and runs the test.
- `mkroms.py` generates two tiny self-written test ROMs (no third-party content).
- `run.mjs` loads an engine in Node, runs frames, saves a state, runs on,
  restores the state and checks that the result is identical.

Results are recorded in [docs/ENGINES.md](../../docs/ENGINES.md).
