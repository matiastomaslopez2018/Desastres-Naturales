'use client';
/*
 * «¿Y si pasara acá?»: un sismo real (de los del simulador, o el que llega por la URL desde «Un día como hoy»)
 * con el epicentro bajo el lugar elegido. Mapa de intensidad con los modelos del simulador (lib/quake/whatif),
 * costas y fronteras, la proyección de la falla en superficie y el área de cada grado de Mercalli.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { drawBase, loadGeo, placeProjection } from './place/PlaceMap';
import { Search, type Place } from './place/PlaceProfile';
import { prep, useCanvasSize } from './quake/clock';
import { PRESETS } from '@/lib/quake/presets';
import { shakeGrid, type ShakeGrid, type WhatIfEvent } from '@/lib/quake/whatif';
import { MMI_SCALE, ROMAN } from '@/lib/quake/text';
import { fmtNum } from '@/lib/format';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';

const EXAMPLES: Place[] = [
  { name: 'Mendoza', lat: -32.89, lon: -68.85 }, { name: 'Buenos Aires', lat: -34.6, lon: -58.38 }, { name: 'Santiago', lat: -33.45, lon: -70.66 },
  { name: 'Lima', lat: -12.05, lon: -77.04 }, { name: 'Ciudad de México', lat: 19.43, lon: -99.13 }, { name: 'Madrid', lat: 40.42, lon: -3.7 },
];

const T = {
  es: {
    event: 'Sismo', place: 'Lugar', examples: 'Por ejemplo', strike: 'Orientación de la falla', strikeHelp: 'Rumbo desde el norte; la falla se inclina hacia la derecha del rumbo.',
    choose: 'Elegí un lugar para ubicar el sismo debajo.',
    head: (ev: string, pl: string) => `Si el sismo de ${ev} ocurriera bajo ${pl}`,
    here: (pl: string, r: string, label: string) => `En ${pl}, la intensidad sería de grado ${r} (${label.toLowerCase()}) en la escala de Mercalli Modificada.`,
    fault: (l: string, w: string) => `La falla mediría unos ${l} km de largo por ${w} km de ancho.`,
    level: (r: string, label: string) => `${r} · ${label}`,
    area: (a: string) => `${a} km²`, upTo: (d: string) => `hasta ${d} km`, beyond: (d: string) => `más de ${d} km`,
    tbl: ['Intensidad', 'Área', 'Distancia al lugar'],
    sim: 'Ver cómo se sentiría en un edificio de tu lugar', legend: 'Intensidad de Mercalli (media)', faultKey: 'Falla (proyección en superficie)',
    note: 'Es un ejercicio para comparar tamaños, no un pronóstico: no en todos lados puede ocurrir un sismo así (los de subducción, por ejemplo, solo se dan cerca de una fosa oceánica). Intensidad media calculada con los mismos modelos del simulador (BSSA14 para sismos corticales y BC Hydro 2016 para los de subducción, convertidos a Mercalli con Worden et al., 2012), con suelo uniforme (Vs30 = 360 m/s): no incluye efectos de sitio, de cuenca ni de la dirección de ruptura, ni tsunamis o deslizamientos. Cada lugar real puede sentir un grado más o un grado menos.',
  },
  en: {
    event: 'Earthquake', place: 'Place', examples: 'For example', strike: 'Fault orientation', strikeHelp: 'Strike from north; the fault dips to the right of the strike.',
    choose: 'Pick a place to put the earthquake beneath it.',
    head: (ev: string, pl: string) => `If the ${ev} earthquake happened beneath ${pl}`,
    here: (pl: string, r: string, label: string) => `In ${pl}, the intensity would be ${r} (${label.toLowerCase()}) on the Modified Mercalli scale.`,
    fault: (l: string, w: string) => `The fault would be about ${l} km long and ${w} km wide.`,
    level: (r: string, label: string) => `${r} · ${label}`,
    area: (a: string) => `${a} km²`, upTo: (d: string) => `up to ${d} km`, beyond: (d: string) => `more than ${d} km`,
    tbl: ['Intensity', 'Area', 'Distance from the place'],
    sim: 'See how a building in your place would feel it', legend: 'Mercalli intensity (median)', faultKey: 'Fault (surface projection)',
    note: 'This is an exercise to compare sizes, not a forecast: such an earthquake cannot happen everywhere (subduction quakes, for example, only occur near an ocean trench). Median intensity computed with the simulator’s models (BSSA14 for crustal and BC Hydro 2016 for subduction earthquakes, converted to Mercalli with Worden et al., 2012), on uniform ground (Vs30 = 360 m/s): it leaves out site, basin and rupture-directivity effects, as well as tsunamis and landslides. Any real place may feel one degree more or less.',
  },
};

export function WhatIf({ lang, custom }: { lang: Lang; custom: WhatIfEvent | null }) {
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const events = useMemo<WhatIfEvent[]>(() => [
    ...(custom ? [custom] : []),
    ...PRESETS.map((p) => ({ id: p.id, name: p.name[lang], mag: p.mag, depth: p.depth, setting: p.setting, mech: p.mech })),
  ], [custom, lang]);
  const [evId, setEvId] = useState(events[0].id);
  const ev = events.find((e) => e.id === evId) ?? events[0];
  const [place, setPlace] = useState<Place | null>(null);
  const [strike, setStrike] = useState(0);
  const dStrike = useDeferredValue(strike);
  const grid = useMemo(() => shakeGrid(ev, dStrike), [ev, dStrike]);

  const lbl = (k: number) => MMI_SCALE[Math.max(0, Math.min(9, Math.round(k) - 1))][lang][0];
  const simHref = place && `${routePath(lang, 'simulator')}?${new URLSearchParams({ m: String(ev.mag), h: String(ev.depth), d: '5', amb: ev.setting, ...(ev.setting === 'crustal' ? { mec: ev.mech } : {}), t: `${t.head(ev.name, place.name)}` })}`;

  return (
    <div className="wi">
      <div className="wi-controls">
        <label className="wi-field">
          <span className="qs-help">{t.event}</span>
          <select value={ev.id} onChange={(e) => setEvId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name} · M {nf(e.mag, 1)}</option>)}
          </select>
        </label>
        <label className="wi-field">
          <span className="qs-help">{t.strike}: {nf(strike)}°</span>
          <input type="range" min={0} max={179} step={1} value={strike} onChange={(e) => setStrike(+e.target.value)} title={t.strikeHelp} />
        </label>
      </div>
      <Search lang={lang} onPick={(p) => setPlace(p)} />
      {!place && (
        <div className="ml-examples">
          <span className="qs-help">{t.examples}:</span>
          {EXAMPLES.map((p) => <button key={p.name} type="button" className="qs-chip" onClick={() => setPlace(p)}>{p.name}</button>)}
        </div>
      )}
      {!place ? <p className="ed-note">{t.choose}</p> : (
        <section className="wi-result">
          <h2 className="ml-name">{t.head(ev.name, place.name)}</h2>
          <p className="ml-head">{t.here(place.name, ROMAN[Math.max(0, Math.min(9, Math.round(grid.here) - 1))], lbl(grid.here))}</p>
          <div className="vs-map-wrap">
            <ShakeCanvas lang={lang} place={place} grid={grid} strike={dStrike} label={t.head(ev.name, place.name)} />
            <div className="vs-legend" aria-hidden="true">
              <span className="faint small">{t.legend}:</span>
              {[4, 5, 6, 7, 8, 9, 10].map((k) => <span key={k}><i className="ml-key" style={{ background: MMI_SCALE[k - 1].color, borderColor: 'rgba(0,0,0,.25)' }} />{ROMAN[k - 1]}</span>)}
              <span><i className="ml-key" style={{ background: 'transparent', borderColor: '#141414', borderWidth: 2 }} />{t.faultKey}</span>
            </div>
          </div>
          <p className="ed-body">{t.fault(nf(grid.rup.length), nf(grid.rup.width))}</p>
          <table className="wi-table">
            <thead><tr>{t.tbl.map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>
              {[...grid.levels].reverse().filter((l) => l.area > 0).map((l) => (
                <tr key={l.k}>
                  <td><i className="ml-key" style={{ background: MMI_SCALE[l.k - 1].color, borderColor: 'rgba(0,0,0,.25)' }} /> {t.level(ROMAN[l.k - 1], lbl(l.k))}</td>
                  <td>{t.area(nf(Math.round(l.area / 100) * 100))}</td>
                  <td>{l.maxKm >= grid.half * 0.98 ? t.beyond(nf(grid.half)) : t.upTo(nf(Math.round(l.maxKm / 5) * 5))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {simHref && <Link className="ed-more" href={simHref}>{t.sim} →</Link>}
        </section>
      )}
      <p className="ed-note">{t.note}</p>
    </div>
  );
}

/** Mapa: tierra, intensidad, costas y fronteras, la falla y el lugar (km al este y al norte del lugar). */
function ShakeCanvas({ lang, place, grid, strike, label }: { lang: Lang; place: Place; grid: ShakeGrid; strike: number; label: string }) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const { w, h, dpr } = useCanvasSize(wrap);
  const [geo, setGeo] = useState<Awaited<ReturnType<typeof loadGeo>> | null>(null);
  useEffect(() => { loadGeo().then(setGeo).catch(() => {}); }, []);

  // Imagen de la intensidad (una celda = un píxel; el navegador la suaviza al escalar).
  const shade = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = grid.n; c.height = grid.n;
    const ctx = c.getContext('2d')!, img = ctx.createImageData(grid.n, grid.n);
    const rgb = MMI_SCALE.map((m) => [parseInt(m.color.slice(1, 3), 16), parseInt(m.color.slice(3, 5), 16), parseInt(m.color.slice(5, 7), 16)]);
    for (let i = 0; i < grid.mmi.length; i++) {
      const v = grid.mmi[i];
      if (v < 3.5) continue;
      const [r, g, b] = rgb[Math.max(0, Math.min(9, Math.round(v) - 1))];
      img.data.set([r, g, b, Math.round(255 * Math.min(0.75, 0.35 + (v - 3.5) * 0.08))], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, [grid]);

  useEffect(() => {
    const ctx = prep(cv.current, w, h, dpr);
    if (!ctx) return;
    const half = grid.half, s = Math.min(w, h) / (2 * half);
    ctx.fillStyle = '#cfe0ea'; ctx.fillRect(0, 0, w, h);
    const paint = () => { if (shade) { ctx.imageSmoothingEnabled = true; ctx.drawImage(shade, w / 2 - half * s, h / 2 - half * s, 2 * half * s, 2 * half * s); } };
    if (geo) drawBase(ctx, geo, placeProjection(place.lon, place.lat, s, w, h), paint); else paint();
    // Falla: rectángulo en superficie (a lo largo del rumbo, desde el borde superior al inferior del plano).
    const a = (strike * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a), L = grid.rup.length / 2;
    const x0 = grid.rup.top[0], x1 = Math.abs(grid.rup.bottom[0] - x0) < 1 ? x0 + 1 : grid.rup.bottom[0];
    const corner = (al: number, ac: number): [number, number] => [w / 2 + (al * sa + ac * ca) * s, h / 2 - (al * ca - ac * sa) * s];
    const pts = [corner(-L, x0), corner(L, x0), corner(L, x1), corner(-L, x1)];
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    // Borde superior más grueso (el más cercano a la superficie).
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.stroke();
    // Lugar.
    ctx.fillStyle = '#141414'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = '600 13px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.strokeText(place.name, w / 2 + 9, h / 2 - 10); ctx.fillText(place.name, w / 2 + 9, h / 2 - 10);
    // Escala.
    const step = [50, 100, 200, 500].find((v) => v * s > 70) ?? 500;
    ctx.fillStyle = '#141414'; ctx.fillRect(12, h - 18, step * s, 3);
    ctx.font = '11px var(--font-isans), system-ui, sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillText(`${fmtNum(lang, step)} km`, 12, h - 21);
  }, [w, h, dpr, geo, shade, grid, place, strike, lang]);

  return (
    <div ref={wrap} className="vs-map ml-map">
      <canvas ref={cv} style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label={label} />
    </div>
  );
}
