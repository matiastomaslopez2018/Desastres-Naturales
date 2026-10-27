/*
 * Verificación de los modelos de peligro (src/lib/volcano/hazards.ts):
 *   1. Cono de energía en terreno plano: el alcance es exactamente altura de colapso / tan(ángulo).
 *   2. Lava en una ladera inclinada: siempre baja (la celda más alta alcanzada es la de partida) y no pasa del largo.
 *   3. LAHARZ en un cono con un valle: el área inundada no supera B = 200·V^(2/3) más una sección.
 *   4. Calbuco (relieve real): los flujos piroclásticos de 2015 llegaron a ~6 km (Castruccio et al., 2016);
 *      se informa qué ángulo de movilidad reproduce ese alcance con 1000 m de colapso.
 *   npx tsx scripts/verify-hazards.ts
 */
import { readFileSync } from 'node:fs';
import { energyCone, lahar, lavaFlow, ventCell, type Dem } from '../src/lib/volcano/hazards';

let fails = 0;
const check = (name: string, ok: boolean, detail: string) => { console.log(`${ok ? 'OK ' : 'MAL'} ${name}: ${detail}`); if (!ok) fails++; };
/** La llegada de las celdas alcanzadas tiene que ir de cerca de 0 (la boca) a 1 (el frente): si no, no se ve el avance. */
const spread = (r: { value: Float32Array; arrival: Float32Array }) => {
  let lo = 9, hi = -1;
  for (let k = 0; k < r.value.length; k++) if (r.value[k] > 0) { lo = Math.min(lo, r.arrival[k]); hi = Math.max(hi, r.arrival[k]); }
  return { ok: lo < 0.15 && hi > 0.95 && hi <= 1 + 1e-6, txt: `llegada de ${lo.toFixed(2)} a ${hi.toFixed(2)}` };
};
const cell = 100;
const grid = (f: (x: number, y: number) => number, n = 201): Dem => { const c = (n - 1) / 2, h = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = f((i - c) * cell, (c - j) * cell); return { h, n, cell }; };

// 1. Plano con un pico de 1 celda en el centro (la boca).
{
  const d = grid((x, y) => (x === 0 && y === 0 ? 0 : 0));
  const r = energyCone(d, { collapseM: 500, angleDeg: 10 }), expect = 500 / Math.tan((10 * Math.PI) / 180);
  check('cono de energía en el plano', Math.abs(r.reachM - expect) <= cell, `${r.reachM.toFixed(0)} m (esperado ${expect.toFixed(0)} m)`);
  const sp = spread(r);
  check('cono de energía: avance', sp.ok, sp.txt);
}
// 2. Ladera que baja hacia el este (pendiente 10 %) con ondulaciones.
{
  const d = grid((x, y) => 2000 - 0.1 * x + 15 * Math.sin(y / 400));
  const r = lavaFlow(d, { lengthM: 5000, runs: 200 });
  let maxH = -Infinity, ok = true;
  for (let k = 0; k < d.n * d.n; k++) if (r.value[k] > 0) { maxH = Math.max(maxH, d.h[k]); if (r.arrival[k] > 1.01) ok = false; }
  check('lava: no supera el largo', ok && r.reachM <= 5000 + 2 * cell, `alcance ${r.reachM.toFixed(0)} m de 5000 m`);
  const start = d.h[ventCell(d)];
  check('lava: siempre baja', maxH <= start + 1e-3, `celda más alta alcanzada ${maxH.toFixed(0)} m (partida ${start.toFixed(0)} m)`);
}
// 3. Volcán empinado arriba y suave abajo (como uno real), con un valle radial hacia el sur; grilla de 30 km.
{
  const d = grid((x, y) => { const r = Math.hypot(x, y); return 3000 * Math.exp(-r / 1500) - (y < 0 ? 60 * Math.exp(-(x * x) / (2 * 300 * 300)) * Math.min(1, -y / 2000) : 0); }, 301);
  const V = 1e6, B = 200 * V ** (2 / 3), r = lahar(d, { volume: V, channels: 1 });
  const area = r.value.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) * cell * cell;
  const spl = spread(r);
  check('LAHARZ: avance', spl.ok, spl.txt);
  check('LAHARZ: área ≈ B', r.starts === 1 && area <= B + 40 * cell * cell && area >= 0.5 * B, `${(area / 1e6).toFixed(2)} km² (B = ${(B / 1e6).toFixed(2)} km², ${r.starts} cauce)`);
}
// 4. Calbuco.
{
  const buf = readFileSync('public/data/volcano/calbuco/dem.bin'), N = 256;
  const d: Dem = { h: Float32Array.from(new Int16Array(buf.buffer, buf.byteOffset, N * N)), n: N, cell: 32000 / (N - 1) };
  const rows = [10, 15, 20, 25].map((a) => `${a}° → ${(energyCone(d, { collapseM: 1000, angleDeg: a }).reachM / 1000).toFixed(1)} km`);
  console.log(`    Calbuco, colapso de 1000 m: ${rows.join(' · ')} (2015: ~6 km)`);
}
console.log(fails ? `\n${fails} verificaciones fallaron` : '\nTodo bien');
process.exit(fails ? 1 : 0);
