// Zoomed ASCII map of a region (fractions of W/H) for precise feature location.
// Usage: node scripts/zoom-map.mjs X0 X1 Y0 Y1 [COLS]
import sharp from 'sharp';

const [x0f, x1f, y0f, y1f] = process.argv.slice(2).map(Number);
const COLS = Number(process.argv[6] || 72);
const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const xa = Math.floor(W * x0f), xb = Math.floor(W * x1f);
const ya = Math.floor(H * y0f), yb = Math.floor(H * y1f);
const ROWS = Math.max(8, Math.round(COLS * (yb - ya) / (xb - xa) * 0.5));
const ramp = ' .:-=+*#%@';
let header = '     ';
for (let c = 0; c < COLS; c++) header += c % 10 === 0 ? '|' : (c % 5 === 0 ? '+' : ' ');
console.log(header + `   (x ${(xa / W * 100).toFixed(1)}–${(xb / W * 100).toFixed(1)}%, y ${(ya / H * 100).toFixed(1)}–${(yb / H * 100).toFixed(1)}%)`);
for (let r = 0; r < ROWS; r++) {
  let line = '';
  for (let c = 0; c < COLS; c++) {
    const x0 = xa + Math.floor(c * (xb - xa) / COLS), x1 = xa + Math.floor((c + 1) * (xb - xa) / COLS);
    const y0 = ya + Math.floor(r * (yb - ya) / ROWS), y1 = ya + Math.floor((r + 1) * (yb - ya) / ROWS);
    let s = 0, n = 0;
    for (let y = y0; y < Math.max(y0 + 1, y1); y += 1) for (let x = x0; x < Math.max(x0 + 1, x1); x += 1) { s += data[y * W + x]; n++; }
    line += ramp[Math.min(ramp.length - 1, Math.floor((s / n) / 256 * ramp.length))];
  }
  console.log(String((ya + (r + 0.5) * (yb - ya) / ROWS) / H * 100).padStart(4) + '% ' + line);
}
