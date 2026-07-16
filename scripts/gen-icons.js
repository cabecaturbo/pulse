// Generates solid-color PWA icons (192 & 512) with no image dependencies:
// hand-assembled PNG chunks over zlib-deflated RGBA rows.
const { deflateSync } = require("node:zlib");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size, file) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  // Deep ink background with a teal pulse dot in the center.
  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.28;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const inDot = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const o = 1 + x * 4;
      if (inDot) {
        row[o] = 0x14; row[o + 1] = 0xb8; row[o + 2] = 0xa6; // teal
      } else {
        row[o] = 0x0b; row[o + 1] = 0x12; row[o + 2] = 0x20; // ink
      }
      row[o + 3] = 0xff;
    }
    rows.push(row);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(join(__dirname, "..", "public", file), png);
  console.log(`wrote public/${file} (${png.length} bytes)`);
}

makeIcon(192, "icon-192.png");
makeIcon(512, "icon-512.png");
