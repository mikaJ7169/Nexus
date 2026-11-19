// Génère assets/icon.png (512x512) sans dépendance : goutte orange "liquid glass" sur fond clair.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 512, H = 512;
const px = new Uint8Array(W * H * 4);

const top = [253, 253, 254];
const bottom = [255, 232, 214];
const o1 = [255, 95, 0];     // bas de la goutte
const o3 = [255, 179, 64];   // haut de la goutte

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Goutte : union d'un cercle (centre bas) et d'un triangle (pointe en haut)
const CX = 256, CY = 300, R = 128;
const AX = 256, AY = 58;          // pointe
const BL = { x: CX - 108, y: CY }, BR = { x: CX + 108, y: CY };

function distSeg(px_, py_, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px_ - ax) * dx + (py_ - ay) * dy) / (dx * dx + dy * dy));
  const x = ax + t * dx, y = ay + t * dy;
  return Math.hypot(px_ - x, py_ - y);
}
function dropletSDF(x, y) {
  const dCircle = Math.hypot(x - CX, y - CY) - R;
  const dTri = Math.min(
    distSeg(x, y, AX, AY, BL.x, BL.y),
    distSeg(x, y, AX, AY, BR.x, BR.y),
    distSeg(x, y, BL.x, BL.y, BR.x, BR.y)
  );
  const inTri = (y >= AY) && (Math.abs(x - AX) <= (y - AY) / (CY - AY) * 108);
  const tri = inTri ? -dTri : dTri;
  return Math.min(dCircle, tri);
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = y / H;
    let col = mix(top, bottom, t);
    // halo doux derrière la goutte
    const dc = Math.hypot((x - CX) / 220, (y - (CY - 20)) / 220);
    const halo = Math.max(0, 1 - dc);
    col = mix(col, [255, 205, 150], halo * 0.35);

    const d = dropletSDF(x, y);
    const a = clamp01(0.5 - d / 2.2); // antialiasing
    if (a > 0) {
      const g = mix(o3, o1, clamp01((y - AY) / (CY + R - AY)));
      // reflet verre en haut à gauche de la goutte
      const gx = x - 205, gy = y - 250;
      const gloss = Math.max(0, 1 - Math.hypot(gx / 34, gy / 58));
      let rgb = g;
      rgb = mix(rgb, [255, 255, 255], gloss * gloss * 0.75 * a);
      col = mix(col, rgb, a);
      // léger halo orange autour
      const rim = Math.max(0, 1 - Math.abs(d) / 14);
      col = mix(col, [255, 170, 90], rim * (1 - a) * 0.5);
    }
    const i = (y * W + x) * 4;
    px[i] = Math.round(col[0]);
    px[i + 1] = Math.round(col[1]);
    px[i + 2] = Math.round(col[2]);
    px[i + 3] = 255;
  }
}

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}

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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);
const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.writeFileSync(out, png);
console.log('icon écrite :', out, png.length, 'octets');
