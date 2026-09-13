// Color probe: dominant hue/saturation stats for an artwork region.
// Usage: node scripts/color-probe.mjs X0 X1 Y0 Y1
import sharp from 'sharp';

const [x0f, x1f, y0f, y1f] = process.argv.slice(2).map(Number);
const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, CH = info.channels;
const xa = Math.floor(W * x0f), xb = Math.floor(W * x1f);
const ya = Math.floor(H * y0f), yb = Math.floor(H * y1f);

const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 255 };
};

const buckets = { chrome: 0, blue: 0, warm: 0, dark: 0, other: 0 };
let n = 0, lSum = 0, lMax = 0;
for (let y = ya; y < yb; y += 2) {
  for (let x = xa; x < xb; x += 2) {
    const i = (y * W + x) * CH;
    const { h, s, l } = hsl(data[i], data[i + 1], data[i + 2]);
    n++; lSum += l; if (l > lMax) lMax = l;
    if (l < 45) { buckets.dark++; continue; }
    if (s < 18) { buckets.chrome++; continue; }
    if (h >= 170 && h <= 250) { buckets.blue++; continue; }
    if (h >= 20 && h <= 70) { buckets.warm++; continue; }
    buckets.other++;
  }
}
console.log(`region x ${(x0f * 100).toFixed(1)}–${(x1f * 100).toFixed(1)}%, y ${(y0f * 100).toFixed(1)}–${(y1f * 100).toFixed(1)}%`);
console.log(`samples ${n}, mean luma ${(lSum / n).toFixed(0)}, max luma ${lMax.toFixed(0)}`);
console.log('mix:', JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, (v / n * 100).toFixed(1) + '%']))));
