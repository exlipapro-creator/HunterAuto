// Side-by-side 4x zoom of the grille star region: master (LEFT) vs cleaned (RIGHT).
// Usage: node scripts/star-compare.mjs
import sharp from 'sharp';
import fs from 'fs';

const MW = 1672, MH = 941;
const L = Math.round(MW * 0.22), T = Math.round(MH * 0.48);
const W = Math.round(MW * 0.14), H = Math.round(MH * 0.20); // grille + star zone
const Z = 4;

const master = await sharp('src/assets/hero/master-reference.png').extract({ left: L, top: T, width: W, height: H }).resize(W * Z, H * Z, { kernel: 'nearest' }).png().toBuffer();
const clean = await sharp('src/assets/hero/cutaway-clean.png').extract({ left: L, top: T, width: W, height: H }).resize(W * Z, H * Z, { kernel: 'nearest' }).png().toBuffer();

const labeled = async (buf, text) => {
  const tag = Buffer.from(`<svg width="${W * Z}" height="44"><rect width="100%" height="100%" fill="#000"/><text x="12" y="30" font-size="26" fill="#fff" font-family="monospace">${text}</text></svg>`);
  return sharp(buf).composite([{ input: await sharp(tag).png().toBuffer(), top: 0, left: 0 }]).png().toBuffer();
};

const a = await labeled(master, 'MASTER');
const b = await labeled(clean, 'CLEANED');
const gap = await sharp({ create: { width: 12, height: H * Z + 44, channels: 3, background: { r: 40, g: 40, b: 40 } } }).png().toBuffer();

await sharp({ create: { width: W * Z * 2 + 12, height: H * Z + 44, channels: 3, background: { r: 0, g: 0, b: 0 } } })
  .composite([
    { input: a, left: 0, top: 0 },
    { input: gap, left: W * Z, top: 0 },
    { input: b, left: W * Z + 12, top: 0 },
  ])
  .png()
  .toFile('artifacts/ui-audit/hero-shots/star-compare.png');
console.log('written artifacts/ui-audit/hero-shots/star-compare.png');
