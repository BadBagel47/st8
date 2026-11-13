# Builds two tiny self-written test ROMs (no third-party content).
nes = bytearray(16+16384+8192)
nes[0:8] = bytes([0x4E,0x45,0x53,0x1A,1,1,0,0])
code = bytes.fromhex("78D8A2FF9A2C0220" "2C022010FB" "2C022010FB" "E600" "A93F8D0620" "A9008D0620" "A500293F8D0720" "A9008D06208D0620" "2C022010FB" "4C12C0")
nes[16:16+len(code)] = code
nes[16+0x100] = 0x40
v = 16+0x3FFA
nes[v:v+6] = bytes([0x00,0xC1,0x00,0xC0,0x00,0xC1])
open('test.nes','wb').write(nes)

sfc = bytearray(b'\x00'*0x40000)
code = bytes.fromhex("78" "A98F8D0021" "E600" "9C2121" "A500" "8D2221" "8D2221" "A90F8D0021" "2C124210FB" "2C124230FB" "4C0680")
sfc[0:len(code)] = code
sfc[0x100] = 0x40
h = 0x7FC0
sfc[h:h+21] = b'ST8 TEST ROM'.ljust(21)
sfc[h+21:h+28] = bytes([0x20,0x00,0x08,0x00,0x01,0x00,0x00])
for off in range(0x7FE4,0x8000,2): sfc[off:off+2] = bytes([0x00,0x81])
sfc[0x7FFC:0x7FFE] = bytes([0x00,0x80])
sfc[0x7FDC:0x7FE0] = bytes([0xFF,0xFF,0,0])
s = sum(sfc) & 0xFFFF
sfc[0x7FDE:0x7FE0] = s.to_bytes(2,'little'); sfc[0x7FDC:0x7FDE] = (s^0xFFFF).to_bytes(2,'little')
open('test.sfc','wb').write(sfc)
