/**
 * GEM Global Seismic Hazard Map v2023.1 (GEM Foundation): aceleración máxima del suelo (PGA, en g)
 * con 10 % de probabilidad de ser superada en 50 años, en roca (Vs30 760–800 m/s), grilla de 3'.
 * Zenodo: https://doi.org/10.5281/zenodo.8409647 (GEM-GSHM_PGA-475y-rock_v2023.zip).
 * Licencia CC BY-NC-SA 4.0: uso no comercial, con atribución y compartir igual.
 *
 * Este script lo convierte en una imagen con la paleta oficial en Web Mercator (±85,05°), que el
 * globo de MapLibre apoya sobre el relieve:
 *   public/data/gem-3857.png   (4096 × 4096, un color por clase; transparente debajo de 0,02 g)
 *
 *   npm run gem -- <ruta a v2023_1_pga_475_rock_3min.tif>
 */
import { writeFileSync } from 'node:fs';
import { fromFile } from 'geotiff';
import { encodeIndexed, mercLat } from '../src/lib/png';

const OUT = 'public/data/gem-3857.png';
const SIZE = 4096;
/** Paleta oficial de GEM (README del mapa), una por clase a partir de LEVELS. */
const COLORS: [number, number, number][] = [[181, 202, 255], [143, 179, 255], [127, 151, 255], [171, 207, 99], [232, 245, 158], [255, 250, 20], [255, 209, 33], [255, 163, 10], [255, 76, 0]];
/** Límites de las clases de la paleta oficial de GEM (README del mapa), en g. Debajo de 0,02 g no se pinta. */
export const LEVELS = [0.02, 0.03, 0.05, 0.08, 0.13, 0.2, 0.35, 0.55, 0.9];

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error('Falta la ruta al GeoTIFF de GEM');
  const tiff = await fromFile(src);
  const img = await tiff.getImage();
  const [x0, y0, x1, y1] = img.getBoundingBox(); // oeste, sur, este, norte
  const w = img.getWidth(), h = img.getHeight();
  const nodata = img.getGDALNoData();
  const [band] = (await img.readRasters({ samples: [0] })) as unknown as [ArrayLike<number>];
  const dx = (x1 - x0) / w, dy = (y1 - y0) / h;
  // Cada píxel de la imagen Mercator toma el máximo de los píxeles de la grilla que cubre
  // (para no bajar la amenaza al reducir la resolución).
  const idx = new Uint8Array(SIZE * SIZE);
  const classOf = (z: number) => { let k = 0; for (let i = 0; i < LEVELS.length; i++) if (z >= LEVELS[i]) k = i + 1; return k; };
  for (let y = 0; y < SIZE; y++) {
    const latTop = mercLat(y - 0.5, SIZE), latBot = mercLat(y + 0.5, SIZE);
    const r0 = Math.max(0, Math.floor((y1 - latTop) / dy)), r1 = Math.min(h - 1, Math.floor((y1 - latBot) / dy));
    for (let x = 0; x < SIZE; x++) {
      const lon0 = -180 + (x * 360) / SIZE, lon1 = -180 + ((x + 1) * 360) / SIZE;
      const c0 = Math.max(0, Math.floor((lon0 - x0) / dx)), c1 = Math.min(w - 1, Math.floor((lon1 - x0) / dx));
      let m = 0;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const z = band[r * w + c];
        if (Number.isFinite(z) && z > m && (nodata == null || z !== nodata)) m = z;
      }
      idx[y * SIZE + x] = classOf(m);
    }
  }
  const png = encodeIndexed(SIZE, SIZE, idx, [[0, 0, 0, 0], ...COLORS.map(([r, g, b]) => [r, g, b, 255] as [number, number, number, number])]);
  writeFileSync(OUT, png);
  console.log(`${w}×${h} píxeles → ${OUT} (${Math.round(png.length / 1024)} kB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
