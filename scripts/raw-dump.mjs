// Raw pixel stats for a horizontal band: histogram buckets + a sample row dump.
// Usage: node scripts/raw-dump.mjs X0 X1 Y0 Y1 [SAMPLE_Y_FRACTION]
import sharp from 'sharp';

const [x0f, x1f, y0f, y1f, syf] = process.argv.slice(2).map(Number);
const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const xa = Math.floor(W * x0f), xb = Math.floor(W * x1f);
const ya = Math.floor(H * y0f), yb = Math.floor(H * y1f);

const buckets = new Array(6).fill(0); // <30, <60, <100, <150, <200, >=200
let n = 0;
for (let y = ya; y < yb; y++) {
  for (let x = xa; x < xb; x++) {
    const v = data[y * W + x];
    buckets[v < 30 ? 0 : v < 60 ? 1 : v < 100 ? 2 : v < 150 ? 3 : v < 200 ? 4 : 5]++;
    n++;
  }
}
console.log(`x ${(x0f * 100).toFixed(1)}–${(x1f * 100).toFixed(1)}%, y ${(y0f * 100).toFixed(1)}–${(y1f * 100).toFixed(1)}%  (${n}px)`);
console.log(`  <30: ${(buckets[0] / n * 100).toFixed(1)}%  30-60: ${(buckets[1] / n * 100).toFixed(1)}%  60-100: ${(buckets[2] / n * 100).toFixed(1)}%  100-150: ${(buckets[3] / n * 100).toFixed(1)}%  150-200: ${(buckets[4] / n * 100).toFixed(1)}%  >=200: ${(buckets[5] / n * 100).toFixed(1)}%`);

if (!Number.isNaN(syf)) {
  const sy = Math.floor(H * syf);
  let line = `  row y=${sy} (${(sy / H * 100).toFixed(1)}%): `;
  for (let x = xa; x < xb; x += Math.max(1, Math.floor((xb - xa) / 60))) line += String(data[sy * W + x]).padStart(4);
  console.log(line);
}
