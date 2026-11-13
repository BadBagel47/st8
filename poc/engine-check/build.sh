#!/usr/bin/env bash
# Reproduces the D-001 engine check: builds both engines for the browser
# and runs a headless save state round-trip in Node.
# Requires: git, make, python3, node, and an activated Emscripten SDK (emcc on PATH).
set -euo pipefail
cd "$(dirname "$0")"
MESEN_COMMIT=0102910c39ad1a62bc3f784466f3f67ca9eae335
SNES9X_COMMIT=1bcc369e89f08243e0a462882fb1f3e42e51de3a
mkdir -p build && cd build

fetch() { # dir url commit
  if [ ! -d "$1" ]; then
    git init -q "$1"
    git -C "$1" fetch -q --depth 1 "$2" "$3"
    git -C "$1" checkout -q FETCH_HEAD
  fi
}
fetch mesen https://github.com/libretro/Mesen "$MESEN_COMMIT"
fetch snes9x https://github.com/snes9xgit/snes9x "$SNES9X_COMMIT"

emmake make -C mesen/Libretro -j"$(nproc)" platform=emscripten STATIC_LINKING=1
emmake make -C snes9x/libretro -j"$(nproc)" platform=emscripten
# The makefiles name the output .bc, but it is a static archive.
cp mesen/Libretro/mesen_libretro_emscripten.bc libmesen.a
cp snes9x/libretro/snes9x_libretro_emscripten.bc libsnes9x.a

EXP='_retro_init,_retro_deinit,_retro_api_version,_retro_get_system_info,_retro_get_system_av_info,_retro_set_environment,_retro_set_video_refresh,_retro_set_audio_sample,_retro_set_audio_sample_batch,_retro_set_input_poll,_retro_set_input_state,_retro_load_game,_retro_unload_game,_retro_run,_retro_reset,_retro_serialize_size,_retro_serialize,_retro_unserialize,_retro_get_memory_data,_retro_get_memory_size,_malloc,_free'
for n in mesen snes9x; do
  em++ -O3 -flto -Wl,--whole-archive lib$n.a -Wl,--no-whole-archive -o $n.mjs \
    -sMODULARIZE -sEXPORT_ES6 -sALLOW_MEMORY_GROWTH -sALLOW_TABLE_GROWTH -sFORCE_FILESYSTEM \
    -sEXPORTED_FUNCTIONS=$EXP \
    -sEXPORTED_RUNTIME_METHODS=addFunction,HEAPU8,HEAPU32,HEAP16,UTF8ToString,stringToNewUTF8,FS \
    -sENVIRONMENT=node,web
done

cp ../mkroms.py ../run.mjs .
python3 mkroms.py
node run.mjs mesen test.nes
node run.mjs snes9x test.sfc
