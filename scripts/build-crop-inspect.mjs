// Visual inspection page v2: stacked sections, 2x zoom, unambiguous captions.
// Sections: emblem zone, every detector box, known label zones, full clean.
// Usage: node scripts/build-crop-inspect.mjs
import sharp from 'sharp';
import fs from 'fs';

const MASTER = 'src/assets/hero/master-reference.png';
const CLEAN = 'src/assets/hero/cutaway-clean.png';
const MW = 1672, MH = 941;

const REGIONS = [
  { name: '1. EMBLEM ZONE — is the Mercedes star still present? (grille, x 26–40%, y 50–66%)', x0: 0.26, x1: 0.40, y0: 0.50, y1: 0.66 },
  { name: '2. RIGHT EDGE (x 84–100%, y 8–48%) — Electrical/Interior labels removed?', x0: 0.84, x1: 1.00, y0: 0.08, y1: 0.48 },
  { name: '3. RIGHT EDGE (x 84–100%, y 48–72%) — Cooling label removed?', x0: 0.84, x1: 1.00, y0: 0.48, y1: 0.72 },
  { name: '4. LEFT EDGE (x 0–16%, y 26–42%) — anything removed here? (was ceiling/scene)', x0: 0.00, x1: 0.16, y0: 0.26, y1: 0.42 },
  { name: '5. LEFT EDGE (x 0–16%, y 70–84%) — Brakes label tail removed?', x0: 0.00, x1: 0.16, y0: 0.70, y1: 0.84 },
  { name: '6. MID-LEFT BAKED LABEL (x 18–42%, y 46–60%) — Engine & Powertrain label STILL PRESENT in master?', x0: 0.18, x1: 0.42, y0: 0.46, y1: 0.60 },
  { name: '7. LOWER-MID (x 55–90%, y 80–94%) — Underbody label region', x0: 0.55, x1: 0.90, y0: 0.80, y1: 0.94 },
];

const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

let sections = '';
for (const r of REGIONS) {
  const box = { left: Math.round(MW * r.x0), top: Math.round(MH * r.y0), width: Math.round(MW * (r.x1 - r.x0)), height: Math.round(MH * (r.y1 - r.y0)) };
  const m = await sharp(MASTER).extract(box).resize({ width: box.width * 2 }).png().toBuffer();
  const c = await sharp(CLEAN).extract(box).resize({ width: box.width * 2 }).png().toBuffer();
  sections += `
  <section>
    <h2>${r.name}</h2>
    <div class="pair">
      <figure><figcaption>MASTER</figcaption><img src="${b64(m)}"></figure>
      <figure><figcaption>CLEANED</figcaption><img src="${b64(c)}"></figure>
    </div>
  </section>`;
}

const full = await sharp(CLEAN).resize({ width: 1400 }).png().toBuffer();
const html = `<!doctype html><html><head><style>
body{background:#0b0b0b;color:#ddd;font:14px system-ui;margin:16px}
section{margin:24px 0}
.pair{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0}figcaption{font-weight:700;color:#7cc4ff;margin:4px 0;font-size:12px}
h2{margin:0 0 8px;font-size:14px;color:#fff;border-left:3px solid #159EF3;padding-left:8px}
img{outline:1px solid #333;max-width:100%}
</style></head><body>
<h1>Hero artwork treatment inspection (2× zoom)</h1>
${sections}
<h2 style="margin-top:28px">FULL CLEANED ARTWORK</h2>
<img src="${b64(full)}">
</body></html>`;
fs.writeFileSync('artifacts/ui-audit/hero-crop-inspect.html', html);
console.log('written,', Math.round(html.length / 1024), 'KB');
