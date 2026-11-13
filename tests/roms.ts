// Tiny self-written test ROMs, generated in code so that no game files are
// ever stored in the repo. Hand-assembled 6502; see comments for the source.

/**
 * NES test ROM (mapper 0, 16 KB PRG, 8 KB CHR). Each frame it:
 * - increments a counter in RAM $00,
 * - reads controller 1 into RAM $01 (bit 7 = A, 6 = B, 5 = Select,
 *   4 = Start, 3 = Up, 2 = Down, 1 = Left, 0 = Right),
 * - shows the buttons as the background colour (palette index = buttons & $3F),
 *   or the counter when no button is held. Holding Right gives colour $01.
 */
export function nesTestRom(): Uint8Array {
  const rom = new Uint8Array(16 + 16384 + 8192);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 1, 1, 0, 0]);
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
    0xa9, 0x01, //       C014 LDA #1
    0x8d, 0x16, 0x40, // C016 STA $4016   ; strobe controllers
    0xa9, 0x00, //       C019 LDA #0
    0x8d, 0x16, 0x40, // C01B STA $4016
    0xa2, 0x08, //       C01E LDX #8
    0xad, 0x16, 0x40, // C020 read: LDA $4016
    0x4a, //             C023 LSR A
    0x26, 0x01, //       C024 ROL $01
    0xca, //             C026 DEX
    0xd0, 0xf7, //       C027 BNE read
    0xa9, 0x3f, //       C029 LDA #$3F
    0x8d, 0x06, 0x20, // C02B STA $2006
    0xa9, 0x00, //       C02E LDA #$00
    0x8d, 0x06, 0x20, // C030 STA $2006
    0xa5, 0x01, //       C033 LDA $01     ; buttons held?
    0xd0, 0x02, //       C035 BNE colour  ; then show them as the colour
    0xa5, 0x00, //       C037 LDA $00     ; else show the counter
    0x29, 0x3f, //       C039 colour: AND #$3F
    0x8d, 0x07, 0x20, // C03B STA $2007   ; background colour
    0xa9, 0x00, //       C03E LDA #0
    0x8d, 0x06, 0x20, // C040 STA $2006
    0x8d, 0x06, 0x20, // C043 STA $2006
    0x2c, 0x02, 0x20, // C046 vwait: BIT $2002
    0x10, 0xfb, //       C049 BPL vwait
    0x4c, 0x12, 0xc0, // C04B JMP main
  ];
  rom.set(code, 16);
  rom[16 + 0x100] = 0x40; // C100: RTI (NMI and IRQ handler)
  rom.set([0x00, 0xc1, 0x00, 0xc0, 0x00, 0xc1], 16 + 0x3ffa); // NMI, RESET, IRQ vectors
  return rom;
}
