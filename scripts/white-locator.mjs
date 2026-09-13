// White-text locator: connected components of unsaturated bright pixels within
// a band → merged label bbox. For precise baked-label measurement.
// Usage: node scripts/white-locator.mjs X0 X1 Y0 Y1 [MINL]
import sharp from 'sharp';

const [x0f, x1f, y0f, y1f, minLf] = process.argv.slice(2).map(Number);
const MINL = minLf || 170;
const SRC = 'src/assets/hero/master-reference.png';
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const xa = Math.floor(W * x0f), xb = Math.floor(W * x1f);
const ya = Math.floor(H * y0f), yb = Math.floor(H * y1f);

const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d !== 0) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s: s * 100, l: l * 255 };
};

const mask = new Uint8Array(W * H);
const pts = [];
for (let y = ya; y < yb; y++) {
  for (let x = xa; x < xb; x++) {
    const i = (y * W + x) * C;
    const p = hsl(data[i], data[i + 1], data[i + 2]);
    if (p.l > MINL && p.s < 20) { mask[y * W + x] = 1; pts.push([x, y]); }
  }
}
// connected components with generous linkage, then merge all into bbox clusters
const seen = new Uint8Array(W * H);
const comps = [];
for (const [sx, sy] of pts) {
  if (seen[sy * W + sx]) continue;
  const q = [[sx, sy]]; seen[sy * W + sx] = 1; const comp = [];
  while (q.length) {
    const [x, y] = q.pop(); comp.push([x, y]);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= xa && nx < xb && ny >= ya && ny < yb && mask[ny * W + nx] && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); }
    }
  }
  comps.push(comp);
}
// merge components whose bboxes are close (same label text block)
const boxes = comps.map(c => {
  let mnx = 1e9, mxx = 0, mny = 1e9, mxy = 0;
  for (const [x, y] of c) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  return { mnx, mxx, mny, mxy, size: c.length };
}).filter(b => b.size > 8);
boxes.sort((a, b) => a.mny - b.mny);
const merged = [];
for (const b of boxes) {
  const last = merged[merged.length - 1];
  if (last && b.mny < last.mxy + 26 && b.mnx < last.mxx + 320) {
    last.mnx = Math.min(last.mnx, b.mnx); last.mxx = Math.max(last.mxx, b.mxx);
    last.mny = Math.min(last.mny, b.mny); last.mxy = Math.max(last.mxy, b.mxy);
    last.size += b.size;
  } else merged.push({ ...b });
}
console.log(`band x ${(x0f * 100).toFixed(1)}–${(x1f * 100).toFixed(1)}%, y ${(y0f * 100).toFixed(1)}–${(y1f * 100).toFixed(1)}%, minL ${MINL}: ${merged.length} text block(s)`);
for (const b of merged) {
  console.log(`  bbox x ${(b.mnx / W * 100).toFixed(2)}–${(b.mxx / W * 100).toFixed(2)}%  y ${(b.mny / H * 100).toFixed(2)}–${(b.mxy / H * 100).toFixed(2)}%  (px ${b.mnx}-${b.mxx}, ${b.mny}-${b.mxy}, white px ${b.size})`);
}
