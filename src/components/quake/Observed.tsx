'use client';
/*
 * El modelo contra lo que pasó: para los sismos reales se cargan los registros de la ShakeMap del USGS
 * (aceleraciones de estaciones sísmicas e intensidades observadas) y se comparan con la predicción del
 * simulador en cada punto, con sus propias distancias a la ruptura real y su Vs30. Además, el mapa de
 * intensidad oficial con los anillos que predice el simulador.
 */
import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { motion, type Mechanism, type Scenario, type Setting, shaking } from '@/lib/quake/gmpe';
import { scenario } from '@/lib/quake/source';
import { MMI_SCALE, ROMAN, SIM_TEXT } from '@/lib/quake/text';
import type { Preset } from '@/lib/quake/presets';
import { fmtNum } from '@/lib/format';
import type { Lang } from '@/lib/types';

type Obs = {
  id: string; usgs: string; bbox: number[]; coast: number[][][];
  shakemap: { url: string; updated: number };
  /** [Rrup, Rjb, Rhypo, Vs30, PGA g, PGV cm/s] */
  stations: number[][];
  /** [Rrup, intensidad, respuestas, lon, lat] */
  felt: number[][];
  contours: { mmi: number; color: string; lines: number[][][] }[];
  rupture: number[][][];
};

type Props = { lang: Lang; preset: Preset; mag: number; depth: number; setting: Setting; mech: Mechanism; vs30: number };

const r1 = (v: number) => Math.round(v * 10) / 10;
const mmiColor = (m: number) => MMI_SCALE[Math.max(0, Math.min(9, Math.round(m) - 1))].color;

export function Observed({ lang, preset, mag, depth, setting, mech, vs30 }: Props) {
  const t = SIM_TEXT[lang];
  const [obs, setObs] = useState<Obs | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setObs(null); setErr(false);
    fetch(`/data/quake-obs/${preset.id}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { if (alive) setObs(j); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [preset.id]);

  const sc = (rjb: number, rrup: number, rhypo: number): Scenario => ({ mag, setting, mech, depth, rjb, rrup, rhypo });
  /** Eje de distancia del modelo: Rrup en corteza e interplaca, hipocentral en intraplaca (como cada GMPE). */
  const useHypo = setting === 'slab';
  /** Profundidad del borde superior de la ruptura del simulador (para pasar de Rrup a Rjb en las curvas). */
  const ztop = useMemo(() => scenario({ mag, setting, mech, depth, dist: 0 }).rup.top[1], [mag, setting, mech, depth]);
  /** Escenario a una distancia del eje (Rrup, o hipocentral en intraplaca). */
  const at = (x: number) => (useHypo
    ? sc(Math.sqrt(Math.max(0, x * x - depth * depth)), x, x)
    : sc(Math.sqrt(Math.max(0, x * x - ztop * ztop)), x, Math.hypot(x, depth)));

  // Residuos de PGA en cada estación: ln(observado / predicho), con su Vs30 y sus distancias reales.
  const stats = useMemo(() => {
    if (!obs?.stations.length) return null;
    const res = obs.stations.map(([rrup, rjb, rhypo, v, pga]) => {
      const m = motion('pga', sc(rjb, rrup, rhypo), { vs30: Math.max(150, Math.min(1500, v)) });
      return { x: useHypo ? rhypo : rrup, obs: pga, pred: m.median, res: Math.log(pga / m.median), sigma: m.sigma };
    });
    const mean = res.reduce((s, r) => s + r.res, 0) / res.length;
    const within = res.filter((r) => Math.abs(r.res) <= r.sigma).length / res.length;
    const vs = [...obs.stations.map((s) => s[3])].sort((a, b) => a - b), vsMed = vs[Math.floor(vs.length / 2)];
    return { res, bias: Math.exp(mean), within, n: res.length, vsMed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs, mag, depth, setting, mech]);

  if (err) return null;
  if (!obs) return <p className="qs-help">…</p>;

  const hasSt = obs.stations.length > 0, hasFelt = obs.felt.length > 0;
  return (
    <div className="qs-obs">
      <div className="qs-obs-grid">
        <div>
          <h3 className="qs-h3">{t.obsMap}</h3>
          <ObsMap lang={lang} obs={obs} preset={preset} mag={mag} depth={depth} setting={setting} mech={mech} vs30={vs30} />
          <p className="qs-help">{t.obsMapHelp}</p>
        </div>
        <div className="qs-obs-charts">
          {hasSt && stats && (
            <div>
              <h3 className="qs-h3">{t.obsPga}</h3>
              <PgaChart lang={lang} stats={stats} curve={(x) => motion('pga', at(x), { vs30: stats.vsMed })} xLabel={useHypo ? t.obsRhypo : t.obsRrup} />
              <p className="qs-obs-stat">{t.obsBias(nfX(lang, stats.bias), String(stats.n))} {t.obsWithin(fmtNum(lang, stats.within * 100))}</p>
            </div>
          )}
          {hasFelt && (
            <div>
              <h3 className="qs-h3">{t.obsMmi}</h3>
              <MmiChart lang={lang} felt={obs.felt} curve={(x) => shaking(at(x), { vs30 })} xLabel={t.obsRrup} />
            </div>
          )}
          {!hasSt && !hasFelt && <p className="qs-note">{t.obsNone}</p>}
        </div>
      </div>
      <p className="qs-help">{t.obsSource} <a href={obs.shakemap.url} target="_blank" rel="noopener noreferrer">USGS ShakeMap ↗</a></p>
    </div>
  );
}

const nfX = (lang: Lang, k: number) => `×${fmtNum(lang, k, 2)}`;

/* ───────────── Gráficos log-log ───────────── */

const W = 440, H = 250, L = 52, R = 20, T = 12, B = 38;
const lx = (v: number, a: number, b: number) => r1(L + ((Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a))) * (W - L - R));
const DIST_TICKS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

function PgaChart({ lang, stats, curve, xLabel }: { lang: Lang; stats: { res: { x: number; obs: number }[] }; curve: (x: number) => { median: number; sigma: number }; xLabel: string }) {
  const t = SIM_TEXT[lang];
  const xs = stats.res.map((r) => r.x), ys = stats.res.map((r) => r.obs);
  const x0 = Math.max(1, 10 ** Math.floor(Math.log10(Math.min(...xs)))), x1 = Math.min(1000, 10 ** Math.ceil(Math.log10(Math.max(...xs))));
  const y0 = 10 ** Math.floor(Math.log10(Math.min(...ys) * 0.8)), y1 = 10 ** Math.ceil(Math.log10(Math.max(...ys) * 1.2));
  const X = (v: number) => lx(v, x0, x1), Y = (v: number) => r1(T + (1 - (Math.log10(v) - Math.log10(y0)) / (Math.log10(y1) - Math.log10(y0))) * (H - T - B));
  const grid = Array.from({ length: 60 }, (_, i) => x0 * (x1 / x0) ** (i / 59));
  const pts = grid.map((x) => ({ x, ...curve(x) }));
  const line = (f: (p: (typeof pts)[number]) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(Math.max(y0, Math.min(y1, f(p))))}`).join('');
  const band = line((p) => p.median * Math.exp(p.sigma)) + [...pts].reverse().map((p) => `L${X(p.x)},${Y(Math.max(y0, Math.min(y1, p.median * Math.exp(-p.sigma))))}`).join('') + 'Z';
  const yTicks: number[] = [];
  for (let e = Math.log10(y0); e <= Math.log10(y1) + 1e-9; e++) yTicks.push(10 ** e);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qs-chart" role="img" aria-label={t.obsPga}>
      {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#e7e7e2" /><text x={L - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{fmtNum(lang, v, v < 0.01 ? 3 : v < 1 ? 2 : 0)}</text></g>)}
      {DIST_TICKS.filter((v) => v >= x0 && v <= x1).map((v) => <text key={v} x={X(v)} y={H - B + 14} textAnchor="middle" className="qs-axis">{fmtNum(lang, v)}</text>)}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="qs-axis">{xLabel} (km)</text>
      <text x={4} y={T + 4} className="qs-axis">g</text>
      <path d={band} fill="rgba(232,89,12,.15)" />
      <path d={line((p) => p.median)} fill="none" stroke="#e8590c" strokeWidth={2} />
      {stats.res.map((r, i) => <circle key={i} cx={X(Math.max(x0, r.x))} cy={Y(r.obs)} r={2.4} fill="rgba(20,20,20,.55)" />)}
      <g className="qs-axis" transform={`translate(${W - R - 150},${T + 8})`}>
        <circle cx={4} cy={0} r={3} fill="rgba(20,20,20,.6)" /><text x={12} y={0} dominantBaseline="middle">{t.obsStations}</text>
        <line x1={0} x2={10} y1={16} y2={16} stroke="#e8590c" strokeWidth={2} /><text x={14} y={16} dominantBaseline="middle">{t.obsModel}</text>
      </g>
    </svg>
  );
}

function MmiChart({ lang, felt, curve, xLabel }: { lang: Lang; felt: number[][]; curve: (x: number) => { mmi: number; mmiSigma: number }; xLabel: string }) {
  const t = SIM_TEXT[lang];
  const xs = felt.map((f) => f[0]);
  const x0 = Math.max(1, 10 ** Math.floor(Math.log10(Math.max(1, Math.min(...xs))))), x1 = Math.min(1000, 10 ** Math.ceil(Math.log10(Math.max(...xs))));
  const X = (v: number) => lx(v, x0, x1), Y = (m: number) => r1(T + (1 - (m - 1) / 9) * (H - T - B));
  const grid = Array.from({ length: 40 }, (_, i) => x0 * (x1 / x0) ** (i / 39));
  const pts = grid.map((x) => ({ x, ...curve(x) }));
  const line = (f: (p: (typeof pts)[number]) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(Math.max(1, Math.min(10, f(p))))}`).join('');
  const band = line((p) => p.mmi + p.mmiSigma) + [...pts].reverse().map((p) => `L${X(p.x)},${Y(Math.max(1, p.mmi - p.mmiSigma))}`).join('') + 'Z';
  // Medias por intervalo de distancia (logarítmico), ponderadas por el número de respuestas.
  const bins = Array.from({ length: 14 }, (_, i) => x0 * (x1 / x0) ** (i / 14));
  const binned = bins.map((a, i) => {
    const b = i + 1 < bins.length ? bins[i + 1] : x1;
    const inBin = felt.filter((f) => f[0] >= a && f[0] < b);
    const w = inBin.reduce((s, f) => s + Math.max(1, f[2]), 0);
    return inBin.length ? { x: Math.sqrt(a * b), m: inBin.reduce((s, f) => s + f[1] * Math.max(1, f[2]), 0) / w, n: inBin.length } : null;
  }).filter(Boolean) as { x: number; m: number; n: number }[];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qs-chart" role="img" aria-label={t.obsMmi}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => <g key={m}><line x1={L} x2={W - R} y1={Y(m)} y2={Y(m)} stroke="#e7e7e2" /><text x={L - 6} y={Y(m)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{ROMAN[m - 1]}</text></g>)}
      {DIST_TICKS.filter((v) => v >= x0 && v <= x1).map((v) => <text key={v} x={X(v)} y={H - B + 14} textAnchor="middle" className="qs-axis">{fmtNum(lang, v)}</text>)}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="qs-axis">{xLabel} (km)</text>
      <path d={band} fill="rgba(232,89,12,.15)" />
      <path d={line((p) => p.mmi)} fill="none" stroke="#e8590c" strokeWidth={2} />
      {felt.map((f, i) => <rect key={i} x={X(Math.max(x0, f[0])) - 2} y={Y(f[1]) - 2} width={4} height={4} fill={mmiColor(f[1])} stroke="rgba(0,0,0,.35)" strokeWidth={0.5} />)}
      {binned.map((b, i) => <circle key={i} cx={X(b.x)} cy={Y(b.m)} r={4.5} fill="#141414" stroke="#fff" strokeWidth={1.5} />)}
      <g className="qs-axis" transform={`translate(${W - R - 170},${T + 8})`}>
        <rect x={0} y={-3} width={6} height={6} fill="#7aff93" stroke="rgba(0,0,0,.35)" strokeWidth={0.5} /><text x={12} y={0} dominantBaseline="middle">{t.obsFelt}</text>
        <circle cx={3} cy={16} r={4} fill="#141414" /><text x={12} y={16} dominantBaseline="middle">{t.obsBinned}</text>
        <line x1={0} x2={10} y1={32} y2={32} stroke="#e8590c" strokeWidth={2} /><text x={14} y={32} dominantBaseline="middle">{t.obsModel}</text>
      </g>
    </svg>
  );
}

/* ───────────── Mapa ───────────── */

function ObsMap({ lang, obs, preset, mag, depth, setting, mech, vs30 }: { lang: Lang; obs: Obs; preset: Preset } & Omit<Props, 'lang' | 'preset'>) {
  const t = SIM_TEXT[lang];
  const MW = 440, MH = 360;
  const [w, s, e, n] = obs.bbox;
  // Se ajusta a las esquinas (un polígono acá se interpretaría según su sentido de giro en la esfera).
  const proj = geoMercator().fitExtent([[6, 6], [MW - 6, MH - 6]], { type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n]] });
  const path = geoPath(proj);
  const d = (ls: number[][][]) => path({ type: 'MultiLineString', coordinates: ls }) ?? '';
  const [ex, ey] = proj(preset.epi as [number, number])!, [cx, cy] = proj(preset.site as [number, number])!;
  // Anillos del simulador: distancia epicentral a la que su intensidad cruza cada grado (V a IX).
  const rings = useMemo(() => {
    const mmiAt = (x: number) => { const { s: sc } = scenario({ mag, setting, mech, depth, dist: x }); return shaking(sc, { vs30 }).mmi; };
    const out: { mmi: number; km: number }[] = [];
    for (let lvl = 9; lvl >= 5; lvl--) {
      if (mmiAt(1) < lvl) continue;
      let lo = 1, hi = 2000;
      if (mmiAt(hi) >= lvl) continue;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (mmiAt(m) >= lvl) lo = m; else hi = m; }
      out.push({ mmi: lvl, km: lo });
    }
    return out;
  }, [mag, setting, mech, depth, vs30]);
  // Radio en píxeles: km → grados de latitud en el epicentro.
  const kmPx = (km: number) => Math.abs(proj([preset.epi[0], preset.epi[1] + km / 111.19])![1] - ey);
  return (
    <svg viewBox={`0 0 ${MW} ${MH}`} className="qs-map" role="img" aria-label={t.obsMap}>
      <rect width={MW} height={MH} fill="#eef2f4" />
      {obs.contours.map((c) => <path key={c.mmi} d={d(c.lines)} fill="none" stroke={c.color === '#ffffff' ? '#ccc' : c.color} strokeWidth={c.mmi % 1 === 0 ? 3 : 1.5} strokeOpacity={0.95} />)}
      <path d={d(obs.coast)} fill="none" stroke="#5a5a5a" strokeWidth={0.8} />
      {obs.felt.map((f, i) => { const p = proj([f[3], f[4]]); return p ? <rect key={i} x={r1(p[0] - 2)} y={r1(p[1] - 2)} width={4} height={4} fill={mmiColor(f[1])} stroke="rgba(0,0,0,.3)" strokeWidth={0.4} /> : null; })}
      {rings.map((rg) => <g key={rg.mmi}><circle cx={r1(ex)} cy={r1(ey)} r={r1(kmPx(rg.km))} fill="none" stroke="#141414" strokeWidth={1} strokeDasharray="4 3" /><text x={r1(ex + kmPx(rg.km) * 0.71 + 3)} y={r1(ey - kmPx(rg.km) * 0.71)} className="qs-axis qs-strong">{ROMAN[rg.mmi - 1]}</text></g>)}
      {obs.rupture.length > 0 && <path d={d(obs.rupture)} fill="rgba(200,16,46,.15)" stroke="#c8102e" strokeWidth={1.5} />}
      <path d={`M${r1(ex)},${r1(ey - 8)} L${r1(ex + 2.5)},${r1(ey - 2.5)} L${r1(ex + 8)},${r1(ey - 2.5)} L${r1(ex + 3.5)},${r1(ey + 1.5)} L${r1(ex + 5)},${r1(ey + 7.5)} L${r1(ex)},${r1(ey + 4)} L${r1(ex - 5)},${r1(ey + 7.5)} L${r1(ex - 3.5)},${r1(ey + 1.5)} L${r1(ex - 8)},${r1(ey - 2.5)} L${r1(ex - 2.5)},${r1(ey - 2.5)}Z`} fill="#c8102e" stroke="#fff" strokeWidth={1} />
      <circle cx={r1(cx)} cy={r1(cy)} r={4.5} fill="#141414" stroke="#fff" strokeWidth={1.5} />
      <text x={r1(cx + 8)} y={r1(cy + 4)} className="qs-map-label">{preset.city[lang]}</text>
      <g transform={`translate(10,${MH - 46})`} className="qs-axis">
        <rect x={-4} y={-12} width={226} height={50} fill="rgba(255,255,255,.85)" rx={6} />
        <line x1={0} x2={18} y1={0} y2={0} stroke="#ffc800" strokeWidth={3} /><text x={24} y={0} dominantBaseline="middle">{t.obsContours}</text>
        <line x1={0} x2={18} y1={16} y2={16} stroke="#141414" strokeDasharray="4 3" /><text x={24} y={16} dominantBaseline="middle">{t.obsRings}</text>
        <rect x={5} y={27} width={6} height={6} fill="#7aff93" stroke="rgba(0,0,0,.3)" strokeWidth={0.4} /><text x={24} y={31} dominantBaseline="middle">{t.obsFelt}</text>
      </g>
    </svg>
  );
}
