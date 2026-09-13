// Probe the hero artwork: locate baked-in technical labels + vehicle extent.
// Usage: node scripts/probe-hero-artwork.mjs
import sharp from 'sharp';

const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const lum = (x, y) => data[y * W + x];

// Baked labels are bright text in the far-left (x<0.16W) and far-right (x>0.87W) bands.
// Report mean luminance per 3%-tall row band to find the text rows.
console.log('--- LEFT band (x 1%–14%) row means ---');
for (let b = 0; b < H; b += Math.floor(H * 0.03)) {
  let s = 0, n = 0, mx = 0;
  for (let y = b; y < Math.min(b + Math.floor(H * 0.03), H); y += 2)
    for (let x = Math.floor(W * 0.01); x < Math.floor(W * 0.14); x += 3) { const v = lum(x, y); s += v; n++; if (v > mx) mx = v; }
  if (mx > 150) console.log(`y ${(b / H * 100).toFixed(1)}%  mean ${(s / n).toFixed(1)}  max ${mx}`);
}
console.log('--- RIGHT band (x 87%–99%) row means ---');
for (let b = 0; b < H; b += Math.floor(H * 0.03)) {
  let s = 0, n = 0, mx = 0;
  for (let y = b; y < Math.min(b + Math.floor(H * 0.03), H); y += 2)
    for (let x = Math.floor(W * 0.87); x < Math.floor(W * 0.99); x += 3) { const v = lum(x, y); s += v; n++; if (v > mx) mx = v; }
  if (mx > 150) console.log(`y ${(b / H * 100).toFixed(1)}%  mean ${(s / n).toFixed(1)}  max ${mx}`);
}

// Vehicle horizontal extent: scan middle rows (30–75% height) for bright
// cutaway/content pixels; find min/max x of pixels above threshold.
let minX = W, maxX = 0;
for (let y = Math.floor(H * 0.3); y < Math.floor(H * 0.75); y += 4)
  for (let x = 0; x < W; x += 4)
    if (lum(x, y) > 70) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
console.log(`--- vehicle/content x-extent in mid rows: ${(minX / W * 100).toFixed(1)}% → ${(maxX / W * 100).toFixed(1)}%`);

// Corner/edge samples for blend planning (what the hero background must match)
const samples = { topLeft: [], bottomLeft: [], topRight: [], bottomRight: [] };
const grab = (x0, y0, x1, y1) => {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { s += lum(x, y); n++; }
  return (s / n).toFixed(1);
};
console.log(`--- edge means: TL ${grab(0, 0, W * 0.08 | 0, H * 0.08 | 0)}  BL ${grab(0, H * 0.92 | 0, W * 0.08 | 0, H)}  TR ${grab(W * 0.92 | 0, 0, W, H * 0.08 | 0)}  BR ${grab(W * 0.92 | 0, H * 0.92 | 0, W, H)}  bottomCenter ${grab(W * 0.4 | 0, H * 0.94 | 0, W * 0.6 | 0, H)}`);
