#!/usr/bin/env bash
# Builds the emulator engines (git submodules under engines/) to WebAssembly
# with Emscripten and installs them into public/cores, together with the
# licence texts the engines require us to ship.
#
# Requires an activated Emscripten SDK (emcc on PATH), make, git and tar.
# Engines are built out-of-tree in build/ so the submodules stay clean.
# A finished engine is reused until its commit or this script changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUILD="$ROOT/build/engines"
OUT="$ROOT/public/cores"
LIC="$ROOT/public/licenses"
SCRIPT_HASH="$(sha256sum "$0" | cut -c1-16)"
JOBS="$(nproc 2>/dev/null || echo 2)"
mkdir -p "$BUILD" "$OUT" "$LIC"

EXPORTS='_retro_init,_retro_deinit,_retro_api_version,_retro_get_system_info,_retro_get_system_av_info,_retro_set_environment,_retro_set_video_refresh,_retro_set_audio_sample,_retro_set_audio_sample_batch,_retro_set_input_poll,_retro_set_input_state,_retro_set_controller_port_device,_retro_load_game,_retro_unload_game,_retro_run,_retro_reset,_retro_get_region,_retro_serialize_size,_retro_serialize,_retro_unserialize,_retro_get_memory_data,_retro_get_memory_size,_malloc,_free'
RUNTIME='addFunction,HEAPU8,HEAP16,HEAPU32,HEAPF32,HEAPF64,UTF8ToString,stringToNewUTF8,FS'

# build_engine <name> <submodule dir> <libretro subdir> <make args...>
build_engine() {
  local name="$1" src="$2" sub="$3"; shift 3
  local commit stamp work
  commit="$(git -C "$src" rev-parse HEAD)"
  stamp="$commit-$SCRIPT_HASH-$(emcc -dumpversion)"
  if [ -f "$OUT/$name.wasm" ] && [ "$(cat "$BUILD/$name.stamp" 2>/dev/null)" = "$stamp" ]; then
    echo "$name: up to date ($commit)"
    return
  fi
  echo "$name: building $commit"
  work="$BUILD/$name-src"
  rm -rf "$work"
  mkdir -p "$work"
  tar -C "$src" --exclude=.git -cf - . | tar -C "$work" -xf -
  emmake make -C "$work/$sub" -j"$JOBS" platform=emscripten "$@"
  # The makefiles call the output .bc, but it is a static archive.
  cp "$work/$sub/${name}_libretro_emscripten.bc" "$BUILD/lib$name.a"
  em++ -O3 -flto \
    -Wl,--whole-archive "$BUILD/lib$name.a" -Wl,--no-whole-archive \
    -o "$OUT/$name.mjs" \
    -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH -sALLOW_TABLE_GROWTH -sFORCE_FILESYSTEM \
    -sEXPORTED_FUNCTIONS="$EXPORTS" -sEXPORTED_RUNTIME_METHODS="$RUNTIME"
  echo "$stamp" > "$BUILD/$name.stamp"
  rm -rf "$work"
}

build_engine mesen engines/mesen Libretro STATIC_LINKING=1

# Engine manifest, read by the app (licences page, save state metadata).
MESEN_COMMIT="$(git -C engines/mesen rev-parse HEAD)"
cat > "$OUT/manifest.json" <<JSON
{
  "engines": [
    {
      "id": "mesen",
      "name": "Mesen",
      "system": "nes",
      "licence": "GPL-3.0",
      "licenceFile": "licenses/GPL-3.0.txt",
      "source": "https://github.com/libretro/Mesen",
      "commit": "$MESEN_COMMIT"
    }
  ]
}
JSON

# Licence texts shipped with the app.
cp LICENSE "$LIC/GPL-3.0.txt"
if [ -f node_modules/fflate/LICENSE ]; then
  cp node_modules/fflate/LICENSE "$LIC/fflate-MIT.txt"
else
  echo "warning: run npm ci first to include the fflate licence" >&2
fi
sed -n '1,/^ \*\//p' engines/mesen/Libretro/libretro.h > "$LIC/libretro-MIT.txt"
echo "Engines ready in $OUT"
