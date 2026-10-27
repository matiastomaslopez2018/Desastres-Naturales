/*
 * Íconos de la app instalable (PWA) a partir de src/app/icon.svg:
 *   public/icons/icon-192.png, icon-512.png   (el logo entero)
 *   public/icons/maskable-512.png             (con margen y fondo, para íconos recortados en Android)
 *   public/icons/apple-180.png                (pantalla de inicio en iPhone)
 *   npx tsx scripts/pwa-icons.ts
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('src/app/icon.svg');
const BG = '#fafaf8';

async function main() {
  for (const s of [192, 512]) await sharp(svg, { density: 1200 }).resize(s, s).png().toFile(`public/icons/icon-${s}.png`);
  // Zona segura de los íconos "maskable": el 80 % central.
  for (const [s, name, pad] of [[512, 'maskable-512', 0.2], [180, 'apple-180', 0.12]] as const) {
    const inner = Math.round(s * (1 - pad));
    const logo = await sharp(svg, { density: 1200 }).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: s, height: s, channels: 4, background: BG } }).composite([{ input: logo, gravity: 'center' }]).png().toFile(`public/icons/${name}.png`);
  }
  console.log('ok');
}
main();
