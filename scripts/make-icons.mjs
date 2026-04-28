// Generates simple violet rounded-square PNG icons for the extension.
// Pure Node — no image libraries. Writes 16/32/48/128 png files.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makePng(size) {
  const w = size, h = size;
  const radius = Math.max(2, Math.floor(size * 0.18));
  // Background gradient violet (#7C7AED) → darker (#5C5ABF) by row.
  const bytesPerRow = 1 + w * 4;
  const raw = Buffer.alloc(bytesPerRow * h);
  for (let y = 0; y < h; y++) {
    raw[y * bytesPerRow] = 0; // filter byte
    for (let x = 0; x < w; x++) {
      // Alpha mask: rounded rect.
      const insideX = x >= radius && x < w - radius;
      const insideY = y >= radius && y < h - radius;
      let alpha = 255;
      if (!insideX && !insideY) {
        const cx = x < radius ? radius : w - 1 - radius;
        const cy = y < radius ? radius : h - 1 - radius;
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        alpha = d <= radius ? 255 : 0;
      }
      const t = y / Math.max(1, h - 1);
      const r = Math.round(124 * (1 - t) + 92 * t);
      const g = Math.round(122 * (1 - t) + 90 * t);
      const b = Math.round(237 * (1 - t) + 191 * t);
      const idx = y * bytesPerRow + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = alpha;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;     // bit depth
  ihdr[9] = 6;     // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = deflateSync(raw);

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

for (const size of [16, 32, 48, 128]) {
  const file = resolve(outDir, `${size}.png`);
  writeFileSync(file, makePng(size));
  console.log('wrote', file);
}
