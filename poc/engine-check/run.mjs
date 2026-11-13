import fs from 'fs'; import crypto from 'crypto';
const [,, name, romPath] = process.argv;
const M = await (await import(`./${name}.mjs`)).default({ print: ()=>{}, printErr: ()=>{} });
const h = b => crypto.createHash('sha1').update(b).digest('hex').slice(0,10);
let dirPtr = M.stringToNewUTF8('/data'); if (M.FS) { M.FS.mkdir('/data'); }
let frame = null, fw=0, fh=0, audioFrames = 0, bpp = 2;
M._retro_set_environment(M.addFunction((cmd, data) => {
  if (cmd === 10) { const f = M.HEAPU32[data>>2]; bpp = f === 1 ? 4 : 2; return 1; }
  if (cmd === 9 || cmd === 31) { M.HEAPU32[data>>2] = dirPtr; return 1; }
  return 0;
}, 'iii'));
M._retro_init();
M._retro_set_video_refresh(M.addFunction((data, w, hh, pitch) => {
  if (!data) return; fw=w; fh=hh; frame = h(M.HEAPU8.subarray(data, data + pitch*hh));
}, 'viiii'));
M._retro_set_audio_sample(M.addFunction(()=>{ audioFrames++; }, 'vii'));
M._retro_set_audio_sample_batch(M.addFunction((d,n)=>{ audioFrames += n; return n; }, 'iii'));
M._retro_set_input_poll(M.addFunction(()=>{}, 'v'));
M._retro_set_input_state(M.addFunction(()=>0, 'iiiii'));
const rom = fs.readFileSync(romPath);
if (M.FS) M.FS.writeFile('/'+romPath, rom);
const p = M._malloc(rom.length); M.HEAPU8.set(rom, p);
const gi = M._malloc(16); M.HEAPU32.set([M.stringToNewUTF8('/'+romPath), p, rom.length, 0], gi>>2);
const ok = M._retro_load_game(gi);
const si = M._malloc(32); M._retro_get_system_info(si);
console.log(name, 'core:', M.UTF8ToString(M.HEAPU32[si>>2]), M.UTF8ToString(M.HEAPU32[(si>>2)+1]), '| load_game:', ok);
if (!ok) process.exit(1);
const ram = () => { const d = M._retro_get_memory_data(2), n = M._retro_get_memory_size(2); return h(M.HEAPU8.subarray(d, d+n)) + ' counter=' + M.HEAPU8[d]; };
const run = n => { for (let i=0;i<n;i++) M._retro_run(); };
run(60);
const size = M._retro_serialize_size(); const sp = M._malloc(size);
const sOk = M._retro_serialize(sp, size); const state = M.HEAPU8.slice(sp, sp+size);
console.log(`video ${fw}x${fh} bpp=${bpp} audioFrames=${audioFrames} | state size=${size} serialize=${sOk}`);
const atSave = ram() + ' frame=' + frame;
run(60); const a = ram() + ' frame=' + frame;
M.HEAPU8.set(state, sp); const uOk = M._retro_unserialize(sp, size);
const restored = ram();
run(60); const b = ram() + ' frame=' + frame;
console.log(' at save      :', atSave); console.log(' +60 frames   :', a);
console.log(' after restore:', restored, 'unserialize=', uOk); console.log(' +60 again    :', b);
console.log(' SAVE STATE ROUND-TRIP:', a === b && a !== atSave ? 'PASS' : 'FAIL');
const t = performance.now(); run(1800); const ms = performance.now()-t;
console.log(` speed: 1800 frames in ${ms.toFixed(0)} ms = ${(1800/ms*1000/60).toFixed(1)}x realtime`);
