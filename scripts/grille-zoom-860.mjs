// Zoomed grille crop from the SERVED 860w WebP (what mobile actually renders).
// Usage: node scripts/grille-zoom-860.mjs
import sharp from 'sharp';

const SRC = 'src/assets/hero/cutaway-860.webp'; // 860x484
const L = Math.round(860 * 0.18), T = Math.round(484 * 0.42);
const W = Math.round(860 * 0.24), H = Math.round(484 * 0.30);
const Z = 5;

await sharp(SRC)
  .extract({ left: L, top: T, width: W, height: H })
  .resize(W * Z, H * Z, { kernel: 'nearest' })
  .png()
  .toFile('artifacts/ui-audit/hero-shots/grille-zoom-860.png');
console.log('written artifacts/ui-audit/hero-shots/grille-zoom-860.png');
