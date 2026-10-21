/*
 * Verifica los tiempos de llegada de src/lib/quake/waves.ts contra las tablas oficiales de ak135
 * (Kennett 2005, "Seismological Tables: ak135", IASPEI), transcriptas en github.com/bclswl0827/travel.
 * También compara el campo de la marcha rápida (frentes de la animación) con el trazado de rayos.
 *   npx tsx scripts/verify-waves.ts
 */
import { firstArrival, sampleField, travelTimeField, type Wave } from '../src/lib/quake/waves';

const BASE = 'https://raw.githubusercontent.com/bclswl0827/travel/HEAD/resource/data/';
const KM_PER_DEG = (Math.PI * 6371) / 180;

/** Filas "∆ m s m s …" de la tabla: distancia en grados → tiempos (s) por profundidad. */
async function table(file: string) {
  const text = await (await fetch(BASE + file)).text();
  const lines = text.split(/\r?\n/);
  const depths = lines.find((l) => /^[∆Δ]/.test(l))!.split(/\s+/).slice(1).map(Number);
  const rows: { deg: number; t: number[] }[] = [];
  for (const l of lines) {
    const f = l.trim().split(/\s+/);
    if (f.length === 1 + 2 * depths.length && /^\d+\.\d$/.test(f[0])) {
      const t: number[] = [];
      for (let k = 0; k < depths.length; k++) t.push(Number(f[1 + 2 * k]) * 60 + Number(f[2 + 2 * k]));
      rows.push({ deg: Number(f[0]), t });
    }
  }
  return { depths, rows };
}

async function main() {
  let worst = 0, n = 0, ok = true;
  for (const [file, w] of [['ak135_P_shallow.txt', 'P'], ['ak135_S_shallow.txt', 'S']] as [string, Wave][]) {
    const { depths, rows } = await table(file);
    let fileWorst = 0, where = '';
    for (const r of rows.filter((r) => r.deg >= 0.5 && r.deg <= 6)) {
      depths.forEach((d, k) => {
        const mine = firstArrival(w, d, r.deg * KM_PER_DEG).t, ref = r.t[k];
        const err = Math.abs(mine - ref);
        n++;
        if (err > fileWorst) { fileWorst = err; where = `${r.deg}° prof ${d} km: ${mine.toFixed(2)} s vs ${ref.toFixed(2)} s`; }
      });
    }
    worst = Math.max(worst, fileWorst);
    console.log(`${w}: error máximo ${fileWorst.toFixed(2)} s (${where})`);
  }
  // Tolerancia: 0,5 s (las tablas tienen centésimas; las diferencias vienen de las capas finas de 1 km).
  if (worst > 0.5) ok = false;
  console.log(`${ok ? 'OK ' : 'MAL'} ak135: ${n} tiempos, error máximo ${worst.toFixed(2)} s`);

  // Marcha rápida vs. rayos, en la superficie.
  let fmmWorst = 0, fmmWhere = '';
  for (const depth of [10, 33, 100, 250]) {
    for (const w of ['P', 'S'] as Wave[]) {
      const F = travelTimeField(w, depth, -40, 520, 300);
      for (const x of [20, 80, 150, 300, 500]) {
        const ray = firstArrival(w, depth, x).t, fmm = sampleField(F, x, 0);
        const err = Math.abs(fmm / ray - 1);
        if (err > fmmWorst) { fmmWorst = err; fmmWhere = `${w} prof ${depth} km a ${x} km: ${fmm.toFixed(2)} vs ${ray.toFixed(2)} s`; }
      }
    }
  }
  const fOk = fmmWorst < 0.03;
  console.log(`${fOk ? 'OK ' : 'MAL'} marcha rápida: error máximo ${(fmmWorst * 100).toFixed(2)} % (${fmmWhere})`);
  if (!ok || !fOk) process.exit(1);
}
main();
