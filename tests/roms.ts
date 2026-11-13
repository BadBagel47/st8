// Tiny self-written test ROMs, generated in code so that no game files are
// ever stored in the repo. Hand-assembled; see comments for the source.

/**
 * NES test ROM (mapper 0, 16 KB PRG, 8 KB CHR, battery-backed RAM). Each frame it:
 * - increments a counter in RAM $00 and copies it to battery RAM $6000,
 * - reads controller 1 into RAM $01 (bit 7 = A, 6 = B, 5 = Select,
 *   4 = Start, 3 = Up, 2 = Down, 1 = Left, 0 = Right),
 * - shows the buttons as the background colour (palette index = buttons & $3F),
 *   or the counter when no button is held. Holding Right gives colour $01.
 */
export function nesTestRom(): Uint8Array {
  const rom = new Uint8Array(16 + 16384 + 8192);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 1, 1, 0x02, 0]); // flags 6: battery
  const code = [
    0x78, //             C000 SEI
    0xd8, //             C001 CLD
    0xa2, 0xff, //       C002 LDX #$FF
    0x9a, //             C004 TXS
    0x2c, 0x02, 0x20, // C005 BIT $2002
    0x2c, 0x02, 0x20, // C008 vwait1: BIT $2002
    0x10, 0xfb, //       C00B BPL vwait1
    0x2c, 0x02, 0x20, // C00D vwait2: BIT $2002
    0x10, 0xfb, //       C010 BPL vwait2
    0xe6, 0x00, //       C012 main: INC $00
    0xa5, 0x00, //       C014 LDA $00
    0x8d, 0x00, 0x60, // C016 STA $6000   ; battery RAM
    0xa9, 0x01, //       C019 LDA #1
    0x8d, 0x16, 0x40, // C01B STA $4016   ; strobe controllers
    0xa9, 0x00, //       C01E LDA #0
    0x8d, 0x16, 0x40, // C020 STA $4016
    0xa2, 0x08, //       C023 LDX #8
    0xad, 0x16, 0x40, // C025 read: LDA $4016
    0x4a, //             C028 LSR A
    0x26, 0x01, //       C029 ROL $01
    0xca, //             C02B DEX
    0xd0, 0xf7, //       C02C BNE read
    0xa9, 0x3f, //       C02E LDA #$3F
    0x8d, 0x06, 0x20, // C030 STA $2006
    0xa9, 0x00, //       C033 LDA #$00
    0x8d, 0x06, 0x20, // C035 STA $2006
    0xa5, 0x01, //       C038 LDA $01     ; buttons held?
    0xd0, 0x02, //       C03A BNE colour  ; then show them as the colour
    0xa5, 0x00, //       C03C LDA $00     ; else show the counter
    0x29, 0x3f, //       C03E colour: AND #$3F
    0x8d, 0x07, 0x20, // C040 STA $2007   ; background colour
    0xa9, 0x00, //       C043 LDA #0
    0x8d, 0x06, 0x20, // C045 STA $2006
    0x8d, 0x06, 0x20, // C048 STA $2006
    0x2c, 0x02, 0x20, // C04B vwait: BIT $2002
    0x10, 0xfb, //       C04E BPL vwait
    0x4c, 0x12, 0xc0, // C050 JMP main
  ];
  rom.set(code, 16);
  rom[16 + 0x100] = 0x40; // C100: RTI (NMI and IRQ handler)
  rom.set([0x00, 0xc1, 0x00, 0xc0, 0x00, 0xc1], 16 + 0x3ffa); // NMI, RESET, IRQ vectors
  return rom;
}

/**
 * SNES test ROM (LoROM, 256 KB, 2 KB battery-backed SRAM). Each frame it:
 * - increments a counter in WRAM $00 and copies it to SRAM $70:0000,
 * - stores controller 1 in WRAM $01 (JOY1L: A X L R) and $02 (JOY1H: B Y Select Start Up Down Left Right),
 * - writes the counter to colour 0 (the backdrop).
 */
export function snesTestRom(): Uint8Array {
  const rom = new Uint8Array(0x40000);
  const code = [
    0x78, //                   8000 SEI
    0xa9, 0x8f, //             8001 LDA #$8F
    0x8d, 0x00, 0x21, //       8003 STA $2100   ; forced blank
    0xa9, 0x01, //             8006 LDA #$01
    0x8d, 0x00, 0x42, //       8008 STA $4200   ; auto joypad read on, NMI off
    0xe6, 0x00, //             800B main: INC $00
    0xa5, 0x00, //             800D LDA $00
    0x8f, 0x00, 0x00, 0x70, // 800F STA $700000 ; battery SRAM
    0xad, 0x18, 0x42, //       8013 LDA $4218   ; JOY1L
    0x85, 0x01, //             8016 STA $01
    0xad, 0x19, 0x42, //       8018 LDA $4219   ; JOY1H
    0x85, 0x02, //             801B STA $02
    0x9c, 0x21, 0x21, //       801D STZ $2121   ; colour 0
    0xa5, 0x00, //             8020 LDA $00
    0x8d, 0x22, 0x21, //       8022 STA $2122
    0x8d, 0x22, 0x21, //       8025 STA $2122
    0xa9, 0x0f, //             8028 LDA #$0F
    0x8d, 0x00, 0x21, //       802A STA $2100   ; screen on
    0x2c, 0x12, 0x42, //       802D vb1: BIT $4212
    0x10, 0xfb, //             8030 BPL vb1     ; wait for vertical blank
    0x2c, 0x12, 0x42, //       8032 vb2: BIT $4212
    0x30, 0xfb, //             8035 BMI vb2     ; wait for it to end
    0x4c, 0x0b, 0x80, //       8037 JMP main
  ];
  rom.set(code, 0);
  rom[0x100] = 0x40; // 8100: RTI
  const h = 0x7fc0;
  rom.set(new TextEncoder().encode('ST8 TEST ROM'.padEnd(21, ' ')), h);
  rom.set([0x20, 0x02, 0x08, 0x01, 0x01, 0x00, 0x00], h + 21); // LoROM, ROM+RAM+battery, 256 KB, 2 KB SRAM
  for (let v = 0x7fe4; v < 0x8000; v += 2) rom.set([0x00, 0x81], v); // all vectors -> 8100
  rom.set([0x00, 0x80], 0x7ffc); // emulation-mode RESET -> 8000
  rom.set([0xff, 0xff, 0x00, 0x00], 0x7fdc);
  let sum = 0;
  for (const b of rom) sum = (sum + b) & 0xffff;
  rom.set([(sum ^ 0xffff) & 0xff, (sum ^ 0xffff) >> 8, sum & 0xff, sum >> 8], 0x7fdc);
  return rom;
}
