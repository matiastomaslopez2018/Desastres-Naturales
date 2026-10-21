/*
 * Verifica src/lib/tsunami/okada.ts contra los datos de prueba de GeoClaw (Clawpack): deformación del
 * fondo para el sismo de Alaska de 1964 descrito en 12 subfallas (tests/data/alaska1964.csv), en una grilla
 * de 0,25° (tests/data/alaska1964_test_data.tt3). Se descargan en cada corrida.
 *   npx tsx scripts/verify-okada.ts
 */
import { dzGrid, type Subfault } from '../src/lib/tsunami/okada';

const BASE = 'https://raw.githubusercontent.com/clawpack/geoclaw/master/tests/data/';

async function main() {
  const csv = (await (await fetch(BASE + 'alaska1964.csv')).text()).trim().split(/\r?\n/).slice(1);
  // Columnas: Longitude, Latitude, Depth(km), Length (km), Width (km), Strike, Dip, Rake, Slip (m); convención "noaa sift".
  const faults: Subfault[] = csv.map((l) => {
    const [lon, lat, depth, length, width, strike, dip, rake, slip] = l.split(',').map(Number);
    return { lon, lat, depth: depth * 1e3, length: length * 1e3, width: width * 1e3, strike, dip, rake, slip, spec: 'noaa sift' };
  });
  const tt3 = (await (await fetch(BASE + 'alaska1964_test_data.tt3')).text()).trim().split(/\r?\n/);
  const head = tt3.slice(0, 9).map((l) => Number(l.trim().split(/\s+/)[0]));
  const [mx, my, , x0, y0, , dx, dy] = head;
  const rows = tt3.slice(9).map((l) => l.trim().split(/\s+/).map(Number)); // de norte a sur
  const lons = Array.from({ length: mx }, (_, i) => x0 + i * dx), lats = Array.from({ length: my }, (_, j) => y0 + j * dy);
  const dz = dzGrid(faults, lons, lats);
  let worst = 0, maxRef = 0, where = '';
  for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
    const ref = rows[my - 1 - j][i], mine = dz[j * mx + i];
    maxRef = Math.max(maxRef, Math.abs(ref));
    const err = Math.abs(mine - ref);
    if (err > worst) { worst = err; where = `(${lons[i]}, ${lats[j]}): ${mine.toFixed(6)} vs ${ref.toFixed(6)} m`; }
  }
  // Las tablas tienen 7 cifras significativas: tolerancia 1e-5 del máximo.
  const ok = worst <= 1e-5 * maxRef + 1e-6;
  console.log(`${ok ? 'OK ' : 'MAL'} Okada vs GeoClaw (Alaska 1964): ${mx * my} puntos, error máximo ${worst.toExponential(2)} m (máximo |dz| ${maxRef.toFixed(2)} m) ${ok ? '' : where}`);
  if (!ok) process.exit(1);
}
main();
