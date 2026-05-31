// One-shot helper: generates maskable PWA icons by compositing the existing
// logo onto a warm-gradient background, sized so the logo stays inside the
// maskable "safe zone" (inscribed circle, ~40% radius) on any launcher shape.
//
// Usage:
//   npm install --no-save sharp
//   node scripts/generate-maskable-icons.js
//   rm -rf node_modules   # this repo has no package.json, sharp is one-shot

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcLogo = path.join(repoRoot, 'assets/img/pwa/icon-512x512.png');
const outDir = path.join(repoRoot, 'assets/img/pwa');

// Dark neutral background — lets the logo's warm colors stand out
function backgroundSvg(size) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#1a1a1a"/>
    </svg>
  `);
}

async function buildIcon(size, outName) {
  // Logo occupies ~85% of canvas. Safe-zone diameter is 80%, but the logo is
  // roughly circular so only the (already transparent) corners get cropped.
  const logoSize = Math.round(size * 0.85);

  const logo = await sharp(srcLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(backgroundSvg(size))
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, outName));

  console.log(`Wrote ${outName} (${size}x${size})`);
}

await buildIcon(512, 'icon-maskable-512x512.png');
await buildIcon(192, 'icon-maskable-192x192.png');
