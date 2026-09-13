// Text-likeness probe: count dark<->bright transitions along x per row band.
// Real lettering alternates frequently; lamps/reflections are solid runs.
// Usage: node scripts/text-probe.mjs X0 X1 Y0 Y1
import sharp from 'sharp';

const [x0f, x1f, y0f, y1f] = process.argv.slice(2).map(Number);
const SRC = 'src/assets/hero/cutaway-clean.png';
const { data, info } = await sharp(SRC).greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const xa = Math.floor(W * x0f), xb = Math.floor(W * x1f);
const ya = Math.floor(H * y0f), yb = Math.floor(H * y1f);

let transTotal = 0, rows = 0, brightTotal = 0, pxTotal = 0;
const perRow = [];
for (let y = ya; y < yb; y += 2) {
  let t = 0, bright = 0;
  let prev = null;
  for (let x = xa; x < xb; x += 1) {
    const v = data[y * W + x];
    const b = v > 150 ? 1 : 0;
    if (prev !== null && b !== prev) t++;
    prev = b;
    if (b) bright++;
  }
  transTotal += t; brightTotal += bright; pxTotal += (xb - xa);
  perRow.push(t);
  rows++;
}
const avgTrans = transTotal / rows;
const brightFrac = brightTotal / pxTotal;
// textness = transitions weighted by having some bright content
const textness = avgTrans * Math.min(1, brightFrac * 6);
console.log(`region x ${(x0f * 100).toFixed(1)}–${(x1f * 100).toFixed(1)}%, y ${(y0f * 100).toFixed(1)}–${(y1f * 100).toFixed(1)}%`);
console.log(`avg x-transitions/row: ${avgTrans.toFixed(1)}   brightFrac: ${(brightFrac * 100).toFixed(1)}%   TEXTNESS: ${textness.toFixed(1)}`);
console.log(`verdict: ${textness > 14 ? 'TEXT' : textness > 6 ? 'MAYBE' : 'NOT TEXT'}`);
