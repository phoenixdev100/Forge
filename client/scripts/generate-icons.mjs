/**
 * Renders the Forge mark (see src/components/Logo.tsx) into the PNG icons a
 * PWA install prompt requires. Run with `node scripts/generate-icons.mjs`
 * after changing the logo; the output is committed so builds stay toolless.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const ACCENT = [249, 115, 22]; // #f97316
const MARK = [34, 26, 22]; // #221a16

/** Signed-distance test for a rounded rectangle, in the 32-unit logo space. */
function insideRoundedRect(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const inBand = px >= x && px <= x + w && py >= y && py <= y + h;
  if (!inBand) return false;
  const nearCornerX = px < x + r || px > x + w - r;
  const nearCornerY = py < y + r || py > y + h - r;
  if (!nearCornerX || !nearCornerY) return true;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

/**
 * @param size pixel dimensions
 * @param inset fraction of padding around the mark (maskable icons need a
 *   safe zone, so the glyph shrinks while the background stays full-bleed)
 */
function renderIcon(size, inset = 0) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const samples = 3; // supersampling, for clean curves at small sizes
  const scale = 32 / size;

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // PNG filter: none
    for (let x = 0; x < size; x += 1) {
      let bg = 0;
      let mark = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const ux = (x + (sx + 0.5) / samples) * scale;
          const uy = (y + (sy + 0.5) / samples) * scale;

          // Background plate: full bleed for maskable, rounded otherwise.
          if (inset > 0 || insideRoundedRect(ux, uy, 0, 0, 32, 32, 8)) bg += 1;

          // The mark, optionally shrunk toward the centre.
          const k = 1 - inset * 2;
          const mx = (ux - 16) / k + 16;
          const my = (uy - 16) / k + 16;
          const onBar = insideRoundedRect(mx, my, 6, 14.5, 20, 3, 1.5);
          const onLeft = insideRoundedRect(mx, my, 8.5, 10, 3.5, 12, 1.75);
          const onRight = insideRoundedRect(mx, my, 20, 10, 3.5, 12, 1.75);
          if (onBar || onLeft || onRight) mark += 1;
        }
      }

      const total = samples * samples;
      const bgA = bg / total;
      const markA = mark / total;
      const offset = rowStart + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        // Mark over accent over transparency.
        raw[offset + channel] = Math.round(
          ACCENT[channel] * (1 - markA) + MARK[channel] * markA,
        );
      }
      raw[offset + 3] = Math.round(255 * Math.max(bgA, markA));
    }
  }

  return encodePng(size, size, raw);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['public/icon-192.png', 192, 0],
  ['public/icon-512.png', 512, 0],
  // Maskable: Android crops to a circle, so the glyph needs breathing room.
  ['public/icon-maskable-512.png', 512, 0.12],
  ['public/apple-touch-icon.png', 180, 0.06],
];

for (const [path, size, inset] of targets) {
  writeFileSync(path, renderIcon(size, inset));
  console.log(`wrote ${path} (${size}px)`);
}
