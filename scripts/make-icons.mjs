// Draws the PrepPop logo (two tilted cards) into PNG app icons with no
// dependencies: rasterize with 4x4 supersampling, encode with node:zlib.
//   node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [255, 248, 240]; // warm paper, matches --bg
const ORANGE = [255, 90, 54]; // --pop
const SUN = [255, 197, 61]; // --sun

// A rounded rectangle centered at (cx, cy), rotated by `deg`, in unit coords.
const card = (cx, cy, w, h, r, deg, color) => ({ cx, cy, w, h, r, rad: (deg * Math.PI) / 180, color });

function inside(shape, x, y) {
  const cos = Math.cos(-shape.rad);
  const sin = Math.sin(-shape.rad);
  const dx = x - shape.cx;
  const dy = y - shape.cy;
  const lx = Math.abs(dx * cos - dy * sin);
  const ly = Math.abs(dx * sin + dy * cos);
  const hx = shape.w / 2 - shape.r;
  const hy = shape.h / 2 - shape.r;
  if (lx <= hx + shape.r && ly <= hy) return true;
  if (ly <= hy + shape.r && lx <= hx) return true;
  const qx = lx - hx;
  const qy = ly - hy;
  return qx > 0 && qy > 0 && qx * qx + qy * qy <= shape.r * shape.r;
}

function render(size, { padding = 0.04, maskable = false } = {}) {
  // Maskable icons need the art inside the central 80% safe zone.
  const scale = 1 - 2 * (maskable ? 0.17 : padding);
  const shapes = [
    card(0.44, 0.53, 0.62, 0.5, 0.1, -10, ORANGE),
    card(0.56, 0.47, 0.62, 0.5, 0.1, 5, SUN),
  ].map((s) => ({ ...s, cx: 0.5 + (s.cx - 0.5) * scale, cy: 0.5 + (s.cy - 0.5) * scale, w: s.w * scale, h: s.h * scale, r: s.r * scale }));

  const SS = 4;
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // no filter
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          let color = BG;
          for (const s of shapes) if (inside(s, x, y)) color = s.color;
          acc = acc.map((v, i) => v + color[i]);
        }
      }
      const o = 1 + px * 4;
      row[o] = Math.round(acc[0] / (SS * SS));
      row[o + 1] = Math.round(acc[1] / (SS * SS));
      row[o + 2] = Math.round(acc[2] / (SS * SS));
      row[o + 3] = 255;
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

function png(w, h, raw) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("icons", { recursive: true });
writeFileSync("icons/icon-192.png", render(192));
writeFileSync("icons/icon-512.png", render(512));
writeFileSync("icons/maskable-512.png", render(512, { maskable: true }));
writeFileSync("icons/apple-touch-icon.png", render(180, { padding: 0.06 }));
console.log("Wrote icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png");
