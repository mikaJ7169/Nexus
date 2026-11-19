// Génère assets/icon.png (512x512) sans aucune dépendance : losange néon sur fond dégradé.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 512, H = 512;
const px = new Uint8Array(W * H * 4);

const c0 = [5, 6, 15];        // haut
const c1 = [27, 17, 64];      // bas
const cyan = [34, 211, 238];
const violet = [167, 139, 250];
const pink = [244, 114, 182];

function lerp(a, b, t) { return a + (b - a) * t; }
function mix3(a, b, c, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = y / H;
    let col = mix3(c0, c1, c1, t);
    // halo radial central
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, 1 - dist / 0.85);
    col = [lerp(col[0], 76, glow * 0.35), lerp(col[1], 58, glow * 0.3), lerp(col[2], 150, glow * 0.45)];
    // losange (distance de Manhattan normalisée)
    const d = (Math.abs(x - W / 2) + Math.abs(y - H / 2)) / 210;
    const ring = Math.abs(d - 1);
    let alpha = 0;
    if (ring < 0.055) alpha = 1;
    else if (ring < 0.16) alpha = Math.max(0, 1 - (ring - 0.055) / 0.105) * 0.35; // halo
    // petit losange plein au centre
    const dc = (Math.abs(x - W / 2) + Math.abs(y - H / 2)) / 52;
    if (dc < 1) alpha = Math.max(alpha, dc < 0.8 ? 1 : (1 - dc) / 0.2 * 0.9);
    const grad = mix3(cyan, violet, pink, t);
    const i = (y * W + x) * 4;
    px[i] = lerp(col[0], grad[0], alpha);
    px[i + 1] = lerp(col[1], grad[1], alpha);
    px[i + 2] = lerp(col[2], grad[2], alpha);
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
