/*
 * Verificación del modelo de caída de tefra (src/lib/volcano/tephra.ts):
 *   1. Conservación de la masa: la carga integrada sobre una grilla grande devuelve la masa emitida.
 *   2. Sin viento la carga es simétrica y máxima en la boca.
 *   3. Velocidades de caída contra valores de referencia de la literatura.
 *   4. Villarrica, 3 de marzo de 2015, con el viento del reanálisis: dirección del eje y cargas contra lo
 *      medido por Romero et al. (2018): ~11,5 kg/m² a 7–9 km y el eje hacia ~120°.
 *   npx tsx scripts/verify-tephra.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extent, loadAt, loadGrid, parcels, settling, merFromHeight, heightFromMer, type WindProfile } from '../src/lib/volcano/tephra';
import { ERUPTIONS, VOLCANOES } from '../src/lib/volcano/presets';

let fails = 0;
const check = (name: string, ok: boolean, detail: string) => { console.log(`${ok ? 'OK ' : 'MAL'} ${name}: ${detail}`); if (!ok) fails++; };

// 1. Masa.
{
  const wind: WindProfile = [{ h: 0, u: 5, v: 2 }, { h: 10000, u: 20, v: 5 }, { h: 20000, u: 10, v: -5 }];
  const ps = parcels({ vent: 2000, top: 14000, mass: 1e11, md: 1, sigma: 1.5, ground: 500, wind });
  // Recuadro grande (1.500 km de lado): incluye la ceniza más fina, que extent() deja afuera a propósito.
  const e = extent(ps), n = 400, h = 1.5e6 / n;
  const g = loadGrid(ps, e.cx, e.cy, h, n, n);
  const total = g.reduce((a, b) => a + b, 0) * h * h;
  check('masa conservada', Math.abs(total / 1e11 - 1) < 0.03, `${(total / 1e11 * 100).toFixed(1)} % de la masa en un recuadro de 1.500 km`);
}
// 2. Sin viento.
{
  const ps = parcels({ vent: 1000, top: 8000, mass: 1e9, md: 0, sigma: 1.5, ground: 1000, wind: [{ h: 0, u: 0, v: 0 }] });
  const c = loadAt(ps, 0, 0), e = loadAt(ps, 5000, 0), w = loadAt(ps, -5000, 0), n = loadAt(ps, 0, 5000);
  check('simetría sin viento', Math.abs(e / w - 1) < 1e-9 && Math.abs(e / n - 1) < 1e-9 && c > e, `centro ${c.toFixed(2)} kg/m², a 5 km ${e.toFixed(3)} kg/m²`);
}
// 3. Velocidad de caída al nivel del mar: ceniza fina ~ cm/s, lapilli ~ decenas de m/s.
{
  const v63 = settling(63e-6, 2500, 0), v1 = settling(1e-3, 1000, 0), v10 = settling(1e-2, 1000, 0);
  check('caída 63 µm (2500 kg/m³)', v63 > 0.2 && v63 < 0.4, `${v63.toFixed(3)} m/s (Stokes: ~0,30)`);
  check('caída 1 mm (pómez)', v1 > 2 && v1 < 6, `${v1.toFixed(2)} m/s`);
  check('caída 1 cm (pómez)', v10 > 10 && v10 < 25, `${v10.toFixed(1)} m/s`);
}
// 4. Mastin et al. (2009): ida y vuelta.
{
  const m = merFromHeight(20);
  check('Mastin H→MER→H', Math.abs(heightFromMer(m) - 20) < 1e-9, `20 km sobre la boca → ${m.toExponential(2)} kg/s`);
}
// 5. Villarrica 2015.
{
  const e = ERUPTIONS.find((x) => x.id === 'villarrica-2015')!, v = VOLCANOES.find((x) => x.id === e.volcano)!;
  const wind = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'volcano', 'winds', `${e.id}.json`), 'utf8')).phases[0].levels as WindProfile;
  const p = e.phases[0];
  const ps = parcels({ vent: v.elev, top: p.topKm * 1000, mass: p.massKg, md: e.gsd.md, sigma: e.gsd.sigma, ground: 1000, wind });
  // Eje: dirección del máximo a 8 km.
  let best = 0, bestAz = 0;
  for (let az = 0; az < 360; az += 2) { const r = (az * Math.PI) / 180, l = loadAt(ps, 8000 * Math.sin(r), 8000 * Math.cos(r)); if (l > best) { best = l; bestAz = az; } }
  check('Villarrica 2015: eje del depósito', Math.abs(bestAz - 120) <= 45, `${bestAz}° (medido: ~120°)`);
  check('Villarrica 2015: carga a 8 km en el eje', best > 11.5 / 4 && best < 11.5 * 4, `${best.toFixed(1)} kg/m² (medido: ~11,5 kg/m² a 7–9 km)`);
}
// 6. Calbuco 2015 contra lo medido en el terreno (Hayes et al., 2019): cerca del volcán, dentro de un factor 2.
{
  const e = ERUPTIONS.find((x) => x.id === 'calbuco-2015')!, v = VOLCANOES.find((x) => x.id === e.volcano)!;
  const winds = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'volcano', 'winds', `${e.id}.json`), 'utf8')).phases as { levels: WindProfile }[];
  const ps = e.phases.flatMap((p, i) => parcels({ vent: v.elev, top: p.topKm * 1000, mass: p.massKg, md: e.gsd.md, sigma: e.gsd.sigma, ground: 500, wind: [...winds[i].levels].sort((a, b) => a.h - b.h) }));
  const cosV = Math.cos((v.lat * Math.PI) / 180);
  for (const o of e.obs!) {
    const mm = loadAt(ps, ((o.lon - v.lon) * Math.PI) / 180 * 6371e3 * cosV, ((o.lat - v.lat) * Math.PI) / 180 * 6371e3);
    const near = o.place === 'Ensenada' || o.place === 'Villa La Angostura';
    const ok = mm >= o.min / 2 && mm <= o.max * 2;
    if (near) check(`Calbuco 2015: ${o.place}`, ok, `${mm.toFixed(1)} mm (medido: ${o.min}–${o.max} mm)`);
    else console.log(`    Calbuco 2015: ${o.place}: ${mm.toFixed(1)} mm (medido: ${o.min}–${o.max} mm; sin agregación el modelo queda corto lejos)`);
  }
}
console.log(fails ? `\n${fails} verificaciones fallaron` : '\nTodo bien');
process.exit(fails ? 1 : 0);
