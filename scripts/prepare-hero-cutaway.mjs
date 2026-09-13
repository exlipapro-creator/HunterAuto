// Hero asset pipeline v5 — idempotent. Produces ALL production hero assets from
// the archived master reference (1774x887 campaign render, emblem-free):
//   1. provenance archive of the supplied reference
//   2. desktop responsive variants (full frame, left negative space preserved
//      for the headline zone)
//   3. dedicated MOBILE vehicle crop (car fills ~97% of crop width) sized for
//      real mobile DPRs
// Usage: node scripts/prepare-hero-cutaway.mjs
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'src/assets/hero/master-reference.png';
const ASSET_DIR = 'src/assets/hero';
const ARCHIVE_DIR = 'artifacts/brand';

const meta = await sharp(SRC).metadata();
const W = meta.width, H = meta.height;
console.log('master:', W, 'x', H);

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
fs.copyFileSync(SRC, path.join(ARCHIVE_DIR, 'hero-cutaway-master.png'));

// --------------------------------------------------- 1. desktop variants -----
const source = sharp(SRC);
for (const w of [1920, 1280, 860]) {
  const out = path.join(ASSET_DIR, `cutaway-${w}.webp`);
  await source.clone().resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 82 }).toFile(out);
  console.log(`cutaway-${w}.webp: ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
await source.clone().resize({ width: 860, kernel: 'lanczos3' }).jpeg({ quality: 86 }).toFile(path.join(ASSET_DIR, 'cutaway-860.jpg'));
console.log('cutaway-860.jpg:', Math.round(fs.statSync(path.join(ASSET_DIR, 'cutaway-860.jpg')).size / 1024), 'KB');

// --------------------------------------- 2. dedicated MOBILE crop variants ---
// Vehicle occupies x 28.4–100%, y 22.8–90% of the master. Crop tight to the
// car (+ floor contact shadow, small margins) so the car fills ~97% of the
// crop; band aspect ≈ 1.95.
const M = { x0: 0.26, x1: 1.0, y0: 0.20, y1: 0.96 };
const mobileCrop = source.clone().extract({
  left: Math.round(W * M.x0),
  top: Math.round(H * M.y0),
  width: Math.round(W * (M.x1 - M.x0)),
  height: Math.round(H * (M.y1 - M.y0)),
});
for (const w of [1200, 800, 480]) {
  const out = path.join(ASSET_DIR, `cutaway-mobile-${w}.webp`);
  await mobileCrop.clone().resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(out);
  console.log(`cutaway-mobile-${w}.webp: ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
await mobileCrop.clone().resize({ width: 480, kernel: 'lanczos3' }).jpeg({ quality: 88 }).toFile(path.join(ASSET_DIR, 'cutaway-mobile-480.jpg'));
console.log('cutaway-mobile-480.jpg:', Math.round(fs.statSync(path.join(ASSET_DIR, 'cutaway-mobile-480.jpg')).size / 1024), 'KB');
console.log('DONE');
