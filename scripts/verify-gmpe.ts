/*
 * Verifica src/lib/quake/gmpe.ts contra las tablas de prueba de OpenQuake (GEM Foundation), las mismas
 * con las que GEM valida su implementación de cada modelo. Se descargan en cada corrida (no se guardan).
 *   npx tsx scripts/verify-gmpe.ts
 */
import { bcHydro, bssa14, type Mechanism } from '../src/lib/quake/gmpe';
import { BCHYDRO, BSSA14 } from '../src/lib/quake/coeffs';

const BASE = 'https://raw.githubusercontent.com/gem/oq-engine/master/openquake/hazardlib/tests/gsim/data/';

async function csv(path: string) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const [head, ...rows] = (await res.text()).trim().split(/\r?\n/).map((l) => l.split(','));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const mechOf = (rake: number): Mechanism => (Math.abs(rake) <= 30 || 180 - Math.abs(rake) <= 30 ? 'strike-slip' : rake > 30 && rake < 150 ? 'reverse' : 'normal');
/** Columnas de la tabla que también tenemos en nuestros coeficientes. */
const shared = (cols: string[], table: Record<string, number[]>) =>
  cols.filter((c) => c === 'pga' || c === 'pgv' || (Number.isFinite(Number(c)) && table[String(Number(c))]));

type Stat = { n: number; worst: number; where: string };
const check = (stat: Stat, mine: number, ref: number, where: string) => {
  const err = Math.abs(mine / ref - 1);
  stat.n++;
  if (err > stat.worst) { stat.worst = err; stat.where = where; }
};
const report = (name: string, s: Stat, tol: number) => {
  const ok = s.worst <= tol;
  console.log(`${ok ? 'OK ' : 'MAL'} ${name}: ${s.n} valores, error máximo ${(s.worst * 100).toFixed(4)} %${ok ? '' : ` en ${s.where}`}`);
  return ok;
};

async function main() {
  const TOL = 1e-4; // las tablas traen ~6 cifras significativas
  let allOk = true;

  // BSSA14 (global, con estilo de falla): mediana y sigma total.
  const mean = await csv('BSSA2014/BSSA_2014_MEAN.csv'), std = await csv('BSSA2014/BSSA_2014_TOTAL_STD.csv');
  const sm: Stat = { n: 0, worst: 0, where: '' }, ss: Stat = { n: 0, worst: 0, where: '' };
  const cols = shared(Object.keys(mean[0]), BSSA14);
  mean.forEach((r, i) => {
    const x = { mag: +r.rup_mag, mech: mechOf(+r.rup_rake), rjb: +r.dist_rjb, vs30: +r.site_vs30 };
    for (const c of cols) {
      const imt = c === 'pga' || c === 'pgv' ? c : Number(c);
      const m = bssa14(imt, x), where = `M${x.mag} rake ${r.rup_rake} Rjb ${x.rjb} Vs30 ${x.vs30} ${c}`;
      check(sm, m.median, +r[c], where);
      check(ss, m.sigma, +std[i][c], where);
    }
  });
  allOk = report('BSSA14 mediana', sm, TOL) && allOk;
  allOk = report('BSSA14 sigma total', ss, TOL) && allOk;

  // BC Hydro interplaca e intraplaca, modelo central (solo sitios de antearco).
  for (const [file, setting] of [['BCHYDRO/BCHYDRO_SINTER_CENTRAL_MEAN.csv', 'interface'], ['BCHYDRO/BCHYDRO_SSLAB_CENTRAL_MEAN.csv', 'slab']] as const) {
    const rows = (await csv(file)).filter((r) => +r.site_backarc === 0);
    const st: Stat = { n: 0, worst: 0, where: '' };
    const c2 = shared(Object.keys(rows[0]), BCHYDRO);
    for (const r of rows) {
      const x = setting === 'interface'
        ? { mag: +r.rup_mag, setting, dist: +r.dist_rrup, depth: 20, vs30: +r.site_vs30 }
        : { mag: +r.rup_mag, setting, dist: +r.dist_rhypo, depth: +r.rup_hypo_depth, vs30: +r.site_vs30 };
      for (const c of c2) check(st, bcHydro(c === 'pga' ? 'pga' : Number(c), x).median, +r[c], `${JSON.stringify(x)} ${c}`);
    }
    allOk = report(`BC Hydro ${setting} mediana`, st, TOL) && allOk;
  }
  if (!allOk) process.exit(1);
}
main();
