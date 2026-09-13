// ASCII luminance map of the hero artwork (80x36) for layout planning.
// Usage: node scripts/map-hero-artwork.mjs
import sharp from 'sharp';

const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const COLS = 80, ROWS = 36;
const ramp = ' .:-=+*#%@';
let header = '    ';
for (let c = 0; c < COLS; c++) header += c % 10 === 0 ? '|' : (c % 5 === 0 ? '+' : ' ');
console.log(header);
for (let r = 0; r < ROWS; r++) {
  let line = '';
  for (let c = 0; c < COLS; c++) {
    let s = 0, n = 0;
    const x0 = Math.floor(c * W / COLS), x1 = Math.floor((c + 1) * W / COLS);
    const y0 = Math.floor(r * H / ROWS), y1 = Math.floor((r + 1) * H / ROWS);
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { s += data[y * W + x]; n++; }
    const v = s / n;
    line += ramp[Math.min(ramp.length - 1, Math.floor(v / 256 * ramp.length))];
  }
  console.log(String(Math.round((r + 0.5) / ROWS * 100)).padStart(3) + '% ' + line);
}
