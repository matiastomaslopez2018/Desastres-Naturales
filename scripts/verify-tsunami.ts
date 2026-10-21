/*
 * Prueba del simulador de tsunamis contra lo observado (NOAA NCEI): para cada tsunami de ejemplo, corre la
 * propagación y compara la hora de llegada en mareógrafos y boyas DART, y la altura máxima en las DART
 * (mar abierto, donde el modelo lineal vale).
 *   npx tsx scripts/verify-tsunami.ts [id] [factor de submuestreo 1|2]
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { TSUNAMI_PRESETS, boxLon } from '../src/lib/tsunami/presets';
import { createSim, cropGrid } from '../src/lib/tsunami/swe';
import { sourceOnGrid, type FaultRow } from '../src/lib/tsunami/source';

const dir = join(process.cwd(), 'public', 'data', 'tsunami');
const meta = JSON.parse(readFileSync(join(dir, 'etopo1-15m.json'), 'utf8'));
const raw = gunzipSync(readFileSync(join(dir, 'etopo1-15m.bin.gz')));
const z = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
const global = { z, nx: meta.nx, ny: meta.ny, lon0: meta.lon0, lat0: meta.lat0, step: meta.step };

const [id = 'tohoku-2011', fac = '2', th = '0.01'] = process.argv.slice(2);
const p = TSUNAMI_PRESETS.find((x) => x.id === id)!;
const data = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as { faults: FaultRow[]; gauges: (number | string)[][] };

const t0 = performance.now();
const grid = cropGrid(global, p.box, +fac);
const eta0 = sourceOnGrid(data.faults, grid);
const t1 = performance.now();
const sim = createSim(grid, eta0, { threshold: +th });
const obsT = data.gauges.filter((g) => (g[2] as number) > 0);
const tEnd = 26 * 3600;
sim.runTo(tEnd);
const t2 = performance.now();

/** Celda mojada más cercana a un punto (busca hasta 3 celdas alrededor). */
function cellAt(lon: number, lat: number) {
  const x = (boxLon(p.box, lon) - grid.lon0) / grid.step, y = (lat - grid.lat0) / grid.step;
  let best = -1, bd = Infinity;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
    const i = Math.round(x) + di, j = Math.round(y) + dj;
    if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) continue;
    const k = j * grid.nx + i;
    if (!sim.wet[k]) continue;
    const d = Math.hypot(i - x, j - y);
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

// Llegadas: por separado en boyas DART (mar abierto) y en mareógrafos (costa, donde la grilla no resuelve
// bahías ni mares interiores). Error relativo = (simulado − observado) / observado.
const rel = { dart: [] as number[], gauge: [] as number[] };
let n = 0, sumErr = 0, sumAbs = 0, within = 0;
const rows: string[] = [];
for (const g of obsT) {
  const k = cellAt(g[0] as number, g[1] as number);
  if (k < 0 || sim.arrival[k] < 0) continue;
  const obs = g[2] as number, sim_ = sim.arrival[k] / 60, err = sim_ - obs;
  n++; sumErr += err; sumAbs += Math.abs(err);
  (g[4] === 3 ? rel.dart : rel.gauge).push(err / obs);
  if (Math.abs(err) <= Math.max(15, 0.1 * obs)) within++;
  if (rows.length < 12 || Math.abs(err) > 120) rows.push(`  ${String(g[6]).slice(0, 38).padEnd(38)} obs ${obs.toFixed(0).padStart(5)} min  sim ${sim_.toFixed(0).padStart(5)} min  (${err > 0 ? '+' : ''}${err.toFixed(0)})`);
}
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const dart = data.gauges.filter((g) => g[4] === 3 && (g[3] as number) > 0);
const amp: string[] = [];
let lr = 0, nd = 0;
for (const g of dart) {
  const k = cellAt(g[0] as number, g[1] as number);
  if (k < 0 || sim.arrival[k] < 0) continue; // la onda no llegó en el tiempo simulado
  const r = sim.maxEta[k] / (g[3] as number);
  lr += Math.log(r); nd++;
  amp.push(`  ${String(g[6]).slice(0, 38).padEnd(38)} obs ${(g[3] as number).toFixed(2)} m  sim ${sim.maxEta[k].toFixed(2)} m`);
}
console.log(`${id}: grilla ${grid.nx}×${grid.ny} (${grid.step}°), dt ${sim.dt.toFixed(1)} s, fuente ${(t1 - t0).toFixed(0)} ms, ${(tEnd / 3600).toFixed(1)} h simuladas en ${((t2 - t1) / 1000).toFixed(1)} s`);
console.log(`Llegadas: ${n} lugares · error medio ${(sumErr / n).toFixed(1)} min · error absoluto medio ${(sumAbs / n).toFixed(1)} min · ${Math.round((100 * within) / n)} % dentro de ±max(15 min, 10 %)`);
console.log(`  Mediana del error relativo: DART ${(100 * med(rel.dart)).toFixed(1)} % (${rel.dart.length}) · mareógrafos ${(100 * med(rel.gauge)).toFixed(1)} % (${rel.gauge.length})`);
if (process.env.DETALLE) console.log(rows.join('\n'));
if (nd) console.log(`DART: ${nd} boyas · simulado/observado (media geométrica) ×${Math.exp(lr / nd).toFixed(2)}\n${amp.slice(0, 12).join('\n')}`);
