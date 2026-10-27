'use client';
/*
 * Simulador de volcanes: tipos de volcán, erupciones reales o propias, el volcán en 3D con la columna y la
 * ceniza, el mapa regional de la caída y lo que significa en cada lugar.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ERUPTIONS, VOLCANOES, type Eruption, type Style, type VolcanoType } from '@/lib/volcano/presets';
import { merFromHeight, vei as veiOf, windAt, type TephraParams, type WindProfile } from '@/lib/volcano/tephra';
import type { VMovieInput } from './VolcanoMovie';
import { ANIM_S, at, slots as makeSlots } from '@/lib/volcano/timeline';
import { VOLC_SOURCES, VOLC_TEXT } from '@/lib/volcano/text';
import { fmtNum } from '@/lib/format';
import { routePath } from '@/lib/seo';
import type { Lang } from '@/lib/types';
import { useClock, useClockTime, type Clock } from '../quake/clock';
import { AshMap, fmtThick, mmFromLoad } from './AshMap';
import { TypeCards } from './TypeCards';
import { LiveAshList } from './LiveAshList';
import type { LiveAsh } from '@/lib/server/volcanicAsh';
import type { AshIn, AshOut } from './ash.worker';
import type { HazardIn, HazardKind, HazardOut } from './hazard.worker';
import type { Dem } from '@/lib/volcano/hazards';

// La película (y su guion) se descargan recién cuando se abre.
const VolcanoMovie = dynamic(() => import('./VolcanoMovie'), { ssr: false });
const Scene3D = dynamic(() => import('./VolcanoScene3D'), { ssr: false, loading: () => <div className="vs-3d vs-busy">…</div> });

type Meta = { box: { w: number; e: number; s: number; n: number }; n: number; maxElev: number; scene: { date?: string } | null; climate: { months: { p: number; h: number; u: number; v: number }[][] } };
type WindFile = { phases: { time: string; levels: { p: number; h: number; u: number; v: number }[] }[] };

/** Valores por omisión de cada estilo: altura sobre el cráter (km), duración (h) y granulometría (φ). */
const STYLE_DEF: Record<Style, { km: number; hours: number; md: number; sigma: number; tephra: number }> = {
  hawaiian: { km: 1.5, hours: 6, md: -1, sigma: 1.5, tephra: 0.05 },
  strombolian: { km: 3, hours: 2, md: 0, sigma: 1.5, tephra: 1 },
  vulcanian: { km: 8, hours: 0.25, md: 2, sigma: 2, tephra: 1 },
  subplinian: { km: 14, hours: 4, md: 1, sigma: 2, tephra: 1 },
  plinian: { km: 25, hours: 8, md: 1.5, sigma: 2.2, tephra: 1 },
};
const STYLES: Style[] = ['hawaiian', 'strombolian', 'vulcanian', 'subplinian', 'plinian'];
/** Ejemplo para cada tipo de volcán (tarjetas de arriba). */
const TYPE_PICK: Record<VolcanoType, { eruption?: string; volcano?: string; style?: Style }> = {
  shield: { volcano: 'kilauea', style: 'hawaiian' }, strato: { eruption: 'calbuco-2015' }, cone: { volcano: 'stromboli', style: 'strombolian' },
  dome: { eruption: 'chaiten-2008' }, caldera: { eruption: 'cordon-caulle-2011' },
};

/** Volumen legible (m³). */
const fmtVol = (lang: Lang, v: number) => (v >= 1e6 ? `${fmtNum(lang, v / 1e6, v < 1e7 ? 1 : 0)} millones de m³`.replace('millones de', lang === 'es' ? 'millones de' : 'million') : `${fmtNum(lang, v / 1e3)} mil m³`.replace(' mil', lang === 'es' ? ' mil' : ' thousand'));
const toLevels = (l: { h: number; u: number; v: number }[]): WindProfile => l.map(({ h, u, v }) => ({ h, u, v })).sort((a, b) => a.h - b.h);
const hm = (lang: Lang, s: number) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; };

/** Lugar extra de la URL (?lugar=Nombre|lat|lon, desde "Mi lugar"): se suma a la tabla y al mapa de la ceniza. */
export type ExtraPlace = { name: string; lat: number; lon: number };

export function VolcanoSim({ lang, initial, extra }: { lang: Lang; initial?: string; extra?: ExtraPlace | null }) {
  const t = VOLC_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [eruptionId, setEruptionId] = useState<string | null>(() => ERUPTIONS.find((e) => e.id === initial)?.id ?? (initial ? null : 'calbuco-2015'));
  const [custom, setCustom] = useState(() => {
    const v = VOLCANOES.find((x) => x.id === initial) ?? VOLCANOES[0];
    return { volcano: v.id, style: 'subplinian' as Style, km: STYLE_DEF.subplinian.km, hours: STYLE_DEF.subplinian.hours, wind: 'now' as 'now' | 'month', month: new Date().getUTCMonth() };
  });
  const eruption: Eruption | null = eruptionId ? ERUPTIONS.find((e) => e.id === eruptionId)! : null;
  const volcano = VOLCANOES.find((v) => v.id === (eruption ? eruption.volcano : custom.volcano))!;
  const style: Style = eruption ? eruption.style : custom.style;

  // Datos del volcán (recuadro, viento promedio) y viento de la erupción o de hoy.
  const [meta, setMeta] = useState<Meta | null>(null);
  const [windFile, setWindFile] = useState<WindFile | null>(null);
  const [windNow, setWindNow] = useState<{ run: number; levels: WindProfile } | 'loading' | 'failed' | null>(null);
  useEffect(() => {
    let ok = true;
    setMeta(null);
    fetch(`/data/volcano/${volcano.id}/meta.json`).then((r) => r.json()).then((m) => { if (ok) setMeta(m); }).catch(() => {});
    return () => { ok = false; };
  }, [volcano.id]);
  useEffect(() => {
    if (!eruption) { setWindFile(null); return; }
    let ok = true;
    fetch(`/data/volcano/winds/${eruption.id}.json`).then((r) => r.json()).then((w) => { if (ok) setWindFile(w); }).catch(() => {});
    return () => { ok = false; };
  }, [eruption]);
  useEffect(() => {
    if (eruption || custom.wind !== 'now') return;
    let ok = true;
    setWindNow('loading');
    fetch(`/api/volcano-wind?lon=${volcano.lon}&lat=${volcano.lat}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { run: number; levels: { h: number; u: number; v: number }[] }) => { if (ok) setWindNow({ run: j.run, levels: toLevels(j.levels) }); })
      .catch(() => { if (ok) setWindNow('failed'); });
    return () => { ok = false; };
  }, [eruption, custom.wind, volcano]);

  // Fases y viento de cada una.
  const run = useMemo(() => {
    if (eruption) {
      if (!windFile) return null;
      return {
        phases: eruption.phases.map((p, i) => ({ ...p, wind: toLevels(windFile.phases[i]?.levels ?? windFile.phases[0].levels) })),
        md: eruption.gsd.md, sigma: eruption.gsd.sigma,
        windNote: eruption.wind === 'reanalysis' ? t.windSrcDay(windFile.phases.map((ph) => ph.time.replace('T', ' ').replace(':00Z', '')).join(' · ')) : t.windSrcMonth,
      };
    }
    let wind: WindProfile | null = null, windNote = '';
    if (custom.wind === 'now' && windNow && typeof windNow === 'object') {
      wind = windNow.levels; windNote = t.windSrcNow(new Date(windNow.run).toISOString().slice(0, 13).replace('T', ' ') + ':00');
    } else if (meta && (custom.wind === 'month' || windNow === 'failed')) {
      wind = toLevels(meta.climate.months[custom.month]); windNote = (windNow === 'failed' && custom.wind === 'now' ? t.windFailed + ' ' : '') + t.windSrcMonth;
    }
    if (!wind) return null;
    const d = STYLE_DEF[custom.style];
    const mass = merFromHeight(custom.km) * custom.hours * 3600 * d.tephra;
    return {
      phases: [{ start: new Date().toISOString(), hours: custom.hours, topKm: volcano.elev / 1000 + custom.km, massKg: mass, massFrom: 'mastin' as const, wind }],
      md: d.md, sigma: d.sigma, windNote,
    };
  }, [eruption, windFile, custom, windNow, meta, volcano, t]);

  // Ceniza (worker).
  const [ash, setAsh] = useState<AshOut | null>(null);
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null), reqId = useRef(0);
  useEffect(() => {
    worker.current = new Worker(new URL('./ash.worker.ts', import.meta.url));
    worker.current.onmessage = (e: MessageEvent<AshOut>) => { if (e.data.id === reqId.current) { setAsh(e.data); setBusy(false); } };
    return () => worker.current?.terminate();
  }, []);
  // Terreno donde cae la ceniza: el más bajo del recuadro del relieve.
  const ground = meta ? Math.max(0, Math.min(volcano.elev - 300, 500)) : 0;
  useEffect(() => {
    if (!run || !worker.current) return;
    const id = ++reqId.current;
    setBusy(true);
    const phases: TephraParams[] = run.phases.map((p) => ({ vent: volcano.elev, top: p.topKm * 1000, mass: p.massKg, md: run.md, sigma: run.sigma, ground, wind: p.wind }));
    const obs = eruption?.obs ?? [];
    const places: AshIn['places'] = [
      ...volcano.places.map(([n, lo, la]) => [n, lo, la, obs.some((o) => o.place === n)] as [string, number, number, boolean]),
      ...obs.filter((o) => !volcano.places.some((p) => p[0] === o.place)).map((o) => [o.place, o.lon, o.lat, true] as [string, number, number, boolean]),
      ...(extra && !volcano.places.some((p) => p[0] === extra.name) ? [[extra.name, extra.lon, extra.lat, true] as [string, number, number, boolean]] : []),
    ];
    const msg: AshIn = { id, phases, places, vent: [volcano.lon, volcano.lat], n: 170, local: { half: volcano.boxKm * 1000, n: 128 } };
    worker.current.postMessage(msg);
  }, [run, volcano, ground, eruption, extra]);

  // Animación.
  const clock = useClock(ANIM_S, { textHz: 0 });
  const sl = useMemo(() => (run ? makeSlots(run.phases) : []), [run]);
  const masses = useMemo(() => (run ? run.phases.map((p) => p.massKg) : []), [run]);
  const scenePhases = useMemo(() => (run ? run.phases.map((p) => ({ top: p.topKm * 1000, wind: p.wind })) : []), [run]);
  useEffect(() => { clock.pause(); clock.seek(sl.length ? Math.min(ANIM_S, sl[0].start + (sl[0].end - sl[0].start) * 0.6) : 0); /* cuadro de muestra */ }, [sl]); // eslint-disable-line react-hooks/exhaustive-deps
  const [no3D, setNo3D] = useState(false);

  // Peligros sobre el relieve (lava, flujos piroclásticos, lahares): se calculan en otro worker con el relieve.
  const [hazard, setHazard] = useState<'ash' | HazardKind>('ash');
  const [hzp, setHzp] = useState({ lavaKm: 6, pdcAngle: 15, pdcCollapse: 1000, laharVol: 1e7 });
  const [dem, setDem] = useState<Dem | null>(null);
  const [hzOut, setHzOut] = useState<HazardOut | null>(null);
  const hzWorker = useRef<Worker | null>(null), hzId = useRef(0);
  useEffect(() => {
    hzWorker.current = new Worker(new URL('./hazard.worker.ts', import.meta.url));
    hzWorker.current.onmessage = (e: MessageEvent<HazardOut>) => { if (e.data.id === hzId.current) setHzOut(e.data); };
    return () => hzWorker.current?.terminate();
  }, []);
  useEffect(() => {
    if (!meta) { setDem(null); return; }
    let ok = true;
    fetch(`/data/volcano/${volcano.id}/dem.bin`).then((r) => r.arrayBuffer()).then((b) => {
      if (ok) setDem({ h: Float32Array.from(new Int16Array(b)), n: meta.n, cell: (2 * volcano.boxKm * 1000) / (meta.n - 1) });
    }).catch(() => {});
    return () => { ok = false; };
  }, [meta, volcano]);
  useEffect(() => {
    setHzOut(null);
    if (hazard === 'ash' || !dem || !hzWorker.current) return;
    const id = ++hzId.current, d = { ...dem, h: dem.h.slice() };
    const msg: HazardIn = hazard === 'lava' ? { id, kind: 'lava', dem: d, lengthM: hzp.lavaKm * 1000 }
      : hazard === 'pdc' ? { id, kind: 'pdc', dem: d, collapseM: hzp.pdcCollapse, angleDeg: hzp.pdcAngle }
      : { id, kind: 'lahar', dem: d, volume: hzp.laharVol };
    hzWorker.current.postMessage(msg);
  }, [hazard, hzp, dem]);
  const hazardLayer = useMemo(() => (hazard !== 'ash' && hzOut && hzOut.kind === hazard ? { kind: hzOut.kind, value: hzOut.value, arrival: hzOut.arrival, n: hzOut.n } : null), [hazard, hzOut]);
  // Lugares dentro del recuadro del relieve alcanzados por el peligro.
  const reached = useMemo(() => {
    if (!hazardLayer || !meta) return [];
    const { box } = meta, n = hazardLayer.n;
    return volcano.places.filter(([, lo, la]) => {
      const i = Math.round(((lo - box.w) / (box.e - box.w)) * (n - 1)), j = Math.round(((box.n - la) / (box.n - box.s)) * (n - 1));
      if (i < 0 || j < 0 || i >= n || j >= n) return false;
      // Un lugar cuenta si el peligro llega a su celda o a una vecina (la grilla es de ~130 m).
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const k = (j + dj) * n + (i + di);
        if (k >= 0 && k < n * n && hazardLayer.value[k] > (hazardLayer.kind === 'lava' ? 0.05 : 0.01)) return true;
      }
      return false;
    }).map(([name]) => name);
  }, [hazardLayer, meta, volcano]);
  const totalMass = masses.reduce((a, b) => a + b, 0), volM3 = totalMass / 1000;
  // Película: datos de entrada y números para los textos (se arman al abrirla).
  const [movie, setMovie] = useState(false);
  const movieInput = useMemo<VMovieInput | null>(() => {
    if (!movie || !run || !meta) return null;
    const last = run.phases[run.phases.length - 1], topM = last.topKm * 1000;
    const w = windAt(last.wind, volcano.elev + (topM - volcano.elev) * 0.67);
    const hours = run.phases.reduce((a, p) => a + p.hours, 0);
    const places = ash ? [...ash.places].sort((a, b) => b.load - a.load).map((p) => ({ name: p.name, mm: mmFromLoad(p.load) })) : [];
    const o = eruption?.obs?.[0], po = o && ash?.places.find((p) => p.name === o.place);
    const check = o && po ? (lang === 'es'
      ? `En ${o.place} se midieron ${fmtThick(lang, o.min)} a ${fmtThick(lang, o.max)}; la simulación da ${fmtThick(lang, mmFromLoad(po.load))} (${o.src}).`
      : `In ${o.place}, ${fmtThick(lang, o.min)} to ${fmtThick(lang, o.max)} were measured; the simulation gives ${fmtThick(lang, mmFromLoad(po.load))} (${o.src}).`) : null;
    return {
      lang, volcano, style, n: meta.n, phases: scenePhases, slots: sl, masses, ash, dem,
      photo: eruption ? `/images/eruptions/${eruption.id}.jpg` : null,
      facts: {
        name: volcano.name, country: volcano.country[lang], type: volcano.type, typeName: t.typeNames[volcano.type], elev: volcano.elev,
        eruption: eruption?.name[lang] ?? null, year: eruption?.year ?? null, style, styleName: t.styles[style],
        topKm: last.topKm, hours, mer: totalMass / (hours * 3600), massKg: totalMass, vei: eruption ? eruption.vei : veiOf(volM3),
        windTo: ((Math.atan2(w.u, w.v) * 180) / Math.PI + 360) % 360, windKmh: Math.hypot(w.u, w.v) * 3.6, windSrc: run.windNote,
        places, check, photo: eruption ? `${eruption.photo.caption[lang]} (${t.photo}: ${eruption.photo.credit})` : null,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie]);
  const hzArea = hazardLayer && dem ? hazardLayer.value.reduce((a, v) => a + (v > (hazardLayer.kind === 'lava' ? 0.05 : 0.01) ? 1 : 0), 0) * dem.cell * dem.cell / 1e6 : 0;

  // Números.
  const sorted = ash ? [...ash.places].sort((a, b) => a.km - b.km) : [];
  const impactOf = (mm: number) => t.impactCuts.reduce((k, c, i) => (mm >= c ? i + 1 : k), 0);

  // Volcán con un aviso de ceniza vigente elegido en "En erupción ahora" (se borra al cambiar cualquier otra cosa).
  const [live, setLive] = useState<LiveAsh | null>(null);
  const pickEruption = (id: string) => { setEruptionId(id); setAsh(null); setLive(null); };
  const pickCustom = (patch: Partial<typeof custom>) => { setEruptionId(null); setAsh(null); setLive(null); setCustom((c) => ({ ...c, ...patch })); };
  const pickLive = (a: LiveAsh) => {
    const v = VOLCANOES.find((x) => x.id === a.sim);
    if (!v) return;
    // Altura sobre el cráter: el tope de la nube del aviso menos la altura del volcán (de a 0,5 km, mínimo 0,5).
    const km = Math.max(0.5, Math.round((a.topKm - v.elev / 1000) * 2) / 2);
    const st: Style = km < 3 ? 'strombolian' : km < 10 ? 'vulcanian' : km < 20 ? 'subplinian' : 'plinian';
    // Duración: la validez del aviso (suele ser 6 h).
    const hours = Math.min(12, Math.max(1, Math.round((a.validTo - a.validFrom) / 36e5)));
    pickCustom({ volcano: v.id, style: st, km, hours, wind: 'now' });
    setLive(a);
  };
  const liveCloud = useMemo(() => (live && live.cloud.length > 2 ? { ring: live.cloud, label: t.live.cloud } : null), [live, t]);
  const onType = (k: VolcanoType) => {
    const p = TYPE_PICK[k];
    if (p.eruption) pickEruption(p.eruption);
    else pickCustom({ volcano: p.volcano!, style: p.style!, km: STYLE_DEF[p.style!].km, hours: STYLE_DEF[p.style!].hours });
  };

  // La URL guarda la erupción o el volcán.
  useEffect(() => {
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set(lang === 'es' ? 'erupcion' : 'eruption', eruption ? eruption.id : volcano.id);
    if (extra) u.searchParams.set(lang === 'es' ? 'lugar' : 'place', `${extra.name}|${extra.lat}|${extra.lon}`);
    window.history.replaceState(window.history.state, '', u);
  }, [eruption, volcano, lang, extra]);

  const year = meta?.scene?.date?.slice(0, 4) ?? '2023';
  const phaseLabel = (time: number) => {
    const st = sl.length ? at(sl, masses, time) : null;
    return st && run && st.phase >= 0 ? `${run.phases.length > 1 ? `${t.phase(st.phase + 1)} · ` : ''}${t.elapsed(hm(lang, st.realS))}` : '';
  };

  return (
    <div className="qs vs">
      <nav className="ts-switch" aria-label={t.kicker}>
        <Link href={routePath(lang, 'simulator')}>{t.otherQuake}</Link>
        <Link href={routePath(lang, 'tsunamiSim')}>{t.otherTsunami}</Link>
        <span aria-current="page">{t.thisSim}</span>
      </nav>
      <TypeCards lang={lang} current={volcano.type} onPick={onType} />

      <div className="qs-grid">
        <aside className="qs-controls" aria-label={t.presets}>
          <LiveAshList lang={lang} current={live} onPick={pickLive} hours={hm(lang, custom.hours * 3600)} />
          <div className="qs-block">
            <h2 className="qs-h">{t.presets}</h2>
            <div className="qs-presets">
              {ERUPTIONS.map((e) => <button key={e.id} type="button" className="qs-chip" aria-pressed={eruption?.id === e.id} onClick={() => pickEruption(e.id)}>{e.name[lang]}</button>)}
            </div>
            {eruption && (
              <figure className="vs-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/eruptions/${eruption.id}.jpg`} alt={eruption.photo.caption[lang]} width={960} height={600} loading="lazy" />
                <figcaption>{eruption.photo.caption[lang]}. <a href={eruption.photo.page} target="_blank" rel="noopener noreferrer">{t.photo}: {eruption.photo.credit} ({lang === 'en' && eruption.photo.license === 'dominio público' ? 'public domain' : eruption.photo.license})</a></figcaption>
              </figure>
            )}
            {eruption && <p className="qs-note">{eruption.note[lang]}</p>}
          </div>
          <div className="qs-block">
            <h2 className="qs-h">{t.custom}</h2>
            <label className="qs-field">
              <span>{t.volcano}</span>
              <select className="vs-select" value={eruption ? '' : custom.volcano} onChange={(e) => pickCustom({ volcano: e.target.value })}>
                {eruption && <option value="" disabled>—</option>}
                {VOLCANOES.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.country[lang]}</option>)}
              </select>
            </label>
            <fieldset className="qs-field">
              <legend>{t.style}</legend>
              <div className="vs-seg" role="radiogroup">
                {STYLES.map((k) => (
                  <label key={k} className="qs-seg-opt"><input type="radio" name="vstyle" checked={!eruption && custom.style === k} onChange={() => pickCustom({ style: k, km: STYLE_DEF[k].km, hours: STYLE_DEF[k].hours })} />{t.styles[k]}</label>
                ))}
              </div>
              <span className="qs-help">{t.styleText[style]}</span>
            </fieldset>
            <label className="qs-field">
              <span className="qs-row"><span>{t.height}</span><b>{nf(eruption ? eruption.phases[0].topKm - volcano.elev / 1000 : custom.km, 1)} km {t.aboveVent}</b></span>
              <input type="range" min={0.5} max={40} step={0.5} value={eruption ? eruption.phases[0].topKm - volcano.elev / 1000 : custom.km} onChange={(e) => pickCustom({ km: +e.target.value, volcano: volcano.id, style })} />
              <span className="qs-help">{t.heightHelp}</span>
            </label>
            <label className="qs-field">
              <span className="qs-row"><span>{t.duration}</span><b>{hm(lang, (eruption ? eruption.phases.reduce((a, p) => a + p.hours, 0) : custom.hours) * 3600)}</b></span>
              <input type="range" min={0} max={1000} step={1} value={Math.round((Math.log((eruption ? eruption.phases[0].hours : custom.hours) / 0.1) / Math.log(48 / 0.1)) * 1000)}
                onChange={(e) => pickCustom({ hours: +(0.1 * (48 / 0.1) ** (+e.target.value / 1000)).toFixed(2), volcano: volcano.id, style, km: eruption ? eruption.phases[0].topKm - volcano.elev / 1000 : custom.km })} />
            </label>
            {!eruption && (
              <fieldset className="qs-field">
                <legend>{t.wind}</legend>
                <div className="qs-seg" role="radiogroup" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <label className="qs-seg-opt"><input type="radio" name="vwind" checked={custom.wind === 'now'} onChange={() => pickCustom({ wind: 'now' })} />{t.windNow}</label>
                  <label className="qs-seg-opt"><input type="radio" name="vwind" checked={custom.wind === 'month'} onChange={() => pickCustom({ wind: 'month' })} />{t.windMonth(t.months[custom.month])}</label>
                </div>
                {custom.wind === 'month' && (
                  <select className="vs-select" value={custom.month} onChange={(e) => pickCustom({ month: +e.target.value })}>
                    {t.months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                )}
              </fieldset>
            )}
            {run && <p className="qs-help">{run.windNote}</p>}
            {!eruption && windNow === 'loading' && custom.wind === 'now' && <p className="qs-help">{t.windLoading}</p>}
          </div>
        </aside>

        <div className="qs-main">
          <div className="ts-movie-cta">
            <button type="button" className="ts-movie-btn" disabled={!run || !meta} onClick={() => { clock.pause(); setMovie(true); }}>▶ {t.watchMovie}</button>
            <span className="qs-help">{t.movieHint}</span>
          </div>
          {movieInput && <VolcanoMovie input={movieInput} onClose={() => setMovie(false)} />}
          <section className="qs-card" aria-label={t.scene}>
            <div className="qs-card-head">
              <h2 className="qs-h">{t.scene}: {volcano.name}</h2>
              <div className="vs-hz-seg" role="radiogroup" aria-label={t.hazard}>
                {(['ash', 'lava', 'pdc', 'lahar'] as const).map((k) => (
                  <label key={k} className="qs-seg-opt"><input type="radio" name="vhz" checked={hazard === k} onChange={() => setHazard(k)} />{t.hazards[k]}</label>
                ))}
              </div>
              <div className="qs-transport">
                <Live clock={clock} hz={4}>{(time) => (
                  <button type="button" className="qs-play" disabled={!run} onClick={() => (clock.playing ? clock.pause() : (clock.now() >= ANIM_S - 0.05 && clock.seek(0), clock.play()))}>
                    {clock.playing ? t.pause : time >= ANIM_S - 0.05 ? t.replay : t.play}
                  </button>
                )}</Live>
              </div>
            </div>
            <div className="vs-stage">
              {run && meta && !no3D && !movie ? (
                <Scene3D lang={lang} name={volcano.name} elev={volcano.elev} boxKm={volcano.boxKm} n={meta.n}
                  demUrl={`/data/volcano/${volcano.id}/dem.bin`} imageUrl={`/data/volcano/${volcano.id}/image.jpg`}
                  style={style} phases={scenePhases} slots={sl} masses={masses} local={ash?.local ?? null} localN={ash?.localN ?? 2}
                  clock={clock} onFail={() => setNo3D(true)} labels={{ crater: t.vent, top: (km) => `${km} km ${t.asl}` }} hazard={hazardLayer} />
              ) : no3D ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/data/volcano/${volcano.id}/image.jpg`} alt="" className="vs-flat" />
              ) : <div className="vs-3d vs-busy">…</div>}
              <Live clock={clock} hz={4}>{(time) => { const l = hazardLayer && hzOut ? t.front(hazardLayer.kind, nf((Math.min(1, time / (sl[sl.length - 1]?.end || ANIM_S)) * hzOut.reachM) / 1000, 1)) : phaseLabel(time); return l ? <span className="vs-clock">{l}</span> : null; }}</Live>
            </div>
            <Live clock={clock} hz={8}>{(time) => <input className="qs-scrub" type="range" min={0} max={ANIM_S} step={0.05} value={time} aria-label={t.duration} onChange={(e) => { clock.pause(); clock.seek(+e.target.value); }} />}</Live>
            <p className="qs-help">{no3D ? t.noWebGL : t.sceneHelp} {t.credits(year)}</p>
          </section>

          {hazard !== 'ash' && (
            <section className="qs-card" aria-label={t.hazards[hazard]}>
              <h2 className="qs-h">{t.hazardTitle[hazard]}</h2>
              <p className="qs-note">{t.hazardText[hazard]}</p>
              {hazard === 'lava' && (
                <label className="qs-field">
                  <span className="qs-row"><span>{t.lavaLength}</span><b>{nf(hzp.lavaKm)} km</b></span>
                  <input type="range" min={1} max={20} step={1} value={hzp.lavaKm} onChange={(e) => setHzp((h) => ({ ...h, lavaKm: +e.target.value }))} />
                  <span className="qs-help">{t.lavaHelp}</span>
                </label>
              )}
              {hazard === 'pdc' && (
                <>
                  <label className="qs-field">
                    <span className="qs-row"><span>{t.pdcCollapse}</span><b>{nf(hzp.pdcCollapse)} m</b></span>
                    <input type="range" min={100} max={3000} step={100} value={hzp.pdcCollapse} onChange={(e) => setHzp((h) => ({ ...h, pdcCollapse: +e.target.value }))} />
                  </label>
                  <label className="qs-field">
                    <span className="qs-row"><span>{t.pdcAngle}</span><b>{nf(hzp.pdcAngle)}°</b></span>
                    <input type="range" min={4} max={30} step={1} value={hzp.pdcAngle} onChange={(e) => setHzp((h) => ({ ...h, pdcAngle: +e.target.value }))} />
                    <span className="qs-help">{t.pdcHelp}</span>
                  </label>
                </>
              )}
              {hazard === 'lahar' && (
                <label className="qs-field">
                  <span className="qs-row"><span>{t.laharVol}</span><b>{fmtVol(lang, hzp.laharVol)}</b></span>
                  <input type="range" min={0} max={1000} step={1} value={Math.round((Math.log10(hzp.laharVol) - 5) / 3 * 1000)} onChange={(e) => setHzp((h) => ({ ...h, laharVol: Math.round(10 ** (5 + (+e.target.value / 1000) * 3) / 1e4) * 1e4 }))} />
                  <span className="qs-help">{t.laharHelp}</span>
                </label>
              )}
              {!hzOut ? <p className="qs-help">{t.computing}</p> : (
                <dl className="qs-dl">
                  <div><dt>{t.reach}</dt><dd>{nf(hzOut.reachM / 1000, 1)} km {t.fromCrater}</dd></div>
                  <div><dt>{t.area}</dt><dd>{nf(hzArea, hzArea < 10 ? 1 : 0)} km²</dd></div>
                  {hazard === 'lahar' && <div><dt>{t.channels}</dt><dd>{hzOut.starts ?? 0}</dd></div>}
                  <div><dt>{t.reachedPlaces}</dt><dd>{reached.length ? reached.join(', ') : t.noPlaces}</dd></div>
                </dl>
              )}
              {hazard === 'lahar' && hzOut && !hzOut.starts && <p className="qs-warn">{t.noChannels}</p>}
              {hazard === 'pdc' && volcano.id === 'calbuco' && hzOut && <p className="qs-help">{t.pdcCalbuco(nf(hzOut.reachM / 1000, 1))}</p>}
              <p className="qs-help">{t.hazardMethod[hazard]}</p>
            </section>
          )}

          <section className="qs-card" aria-label={t.ashMap}>
            <h2 className="qs-h">{t.ashMap}</h2>
            <AshMap lang={lang} ash={ash} vent={[volcano.lon, volcano.lat]} name={volcano.name} computing={busy} computingText={t.computing}
              cloud={liveCloud} />
            <p className="qs-help">{t.ashMapHelp}</p>
            {ash && (
              <div className="ed-table-wrap">
                <table className="qs-table">
                  <thead><tr><th scope="col">{t.place}</th><th scope="col">{t.dist}</th><th scope="col">{t.thick}</th><th scope="col">{t.impact}</th></tr></thead>
                  <tbody>
                    {sorted.map((p) => {
                      const mm = mmFromLoad(p.load), k = impactOf(mm);
                      return (
                        <tr key={p.name} className={extra?.name === p.name ? 'vs-mine' : undefined}>
                          <th scope="row">{extra?.name === p.name ? `★ ${p.name}` : p.name}</th>
                          <td>{nf(p.km)} km</td>
                          <td><b>{fmtThick(lang, mm)}</b></td>
                          <td><span className={`vs-imp vs-imp-${k}`}>{t.impacts[k]}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="qs-help">{t.impactsSrc}</p>
            {eruption?.obs && ash && (
              <>
                <h3 className="qs-h3">{t.checkTitle}</h3>
                <div className="ed-table-wrap">
                  <table className="qs-table">
                    <thead><tr><th scope="col">{t.place}</th><th scope="col">{t.dist}</th><th scope="col">{t.measured}</th><th scope="col">{t.simulated}</th></tr></thead>
                    <tbody>
                      {eruption.obs.map((o) => {
                        const p = ash.places.find((x) => x.name === o.place), mm = p ? mmFromLoad(p.load) : 0, ok = mm >= o.min / 2 && mm <= o.max * 2;
                        return (
                          <tr key={o.place}>
                            <th scope="row">{o.place}</th>
                            <td>{p ? `${nf(p.km)} km` : '—'}</td>
                            <td>{fmtThick(lang, o.min)} – {fmtThick(lang, o.max)}</td>
                            <td><b className={ok ? 'vs-ok' : 'vs-off'}>{fmtThick(lang, mm)}</b></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="qs-help">{t.checkNote(eruption.obs[0].src)}</p>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="qs-results">
        <section className="qs-card" aria-label={t.numbers}>
          <h2 className="qs-h">{t.numbers}</h2>
          {run && (
            <dl className="qs-dl">
              {run.phases.map((p, i) => (
                <div key={i}>
                  <dt>{run.phases.length > 1 ? t.phase(i + 1) : t.height}</dt>
                  <dd>{nf(p.topKm, 1)} km {t.asl} ({nf(p.topKm - volcano.elev / 1000, 1)} km {t.aboveVent}) · {hm(lang, p.hours * 3600)} · {t.mer} {nf(p.massKg / (p.hours * 3600) / 1e6, 1)} × 10⁶ kg/s</dd>
                </div>
              ))}
              <div><dt>{t.mass}</dt><dd>{nf(totalMass / 1e9, totalMass < 1e10 ? 1 : 0)} × 10⁹ kg</dd></div>
              <div><dt>{t.volume}</dt><dd>{volM3 >= 1e8 ? `${nf(volM3 / 1e9, 2)} km³` : `${nf(volM3 / 1e6, 1)} × 10⁶ m³`}</dd></div>
              <div><dt>{t.vei}</dt><dd>{eruption ? eruption.vei : veiOf(volM3)}</dd></div>
            </dl>
          )}
          {run && <p className="qs-help">{run.phases.some((p) => p.massFrom === 'mastin') ? t.massFromMastin : t.massFromDeposit}</p>}
          {eruption && (
            <>
              <h3 className="qs-h3">{t.refs}</h3>
              <ul className="ed-list">{eruption.refs.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.label} ↗</a></li>)}</ul>
            </>
          )}
        </section>
        <section className="qs-card" aria-label={t.column}>
          <h2 className="qs-h">{t.column}</h2>
          {run && <Live clock={clock} hz={2}>{(time) => {
            const ph = Math.max(0, sl.length ? at(sl, masses, time).last : 0), p = run.phases[Math.min(ph, run.phases.length - 1)];
            return <ColumnProfile lang={lang} top={p.topKm * 1000} vent={volcano.elev} wind={p.wind} />;
          }}</Live>}
          <p className="qs-help">{t.columnHelp}</p>
        </section>
      </div>

      <section className="qs-how ed-prose">
        <section>
          <h2>{t.how}</h2>
          <dl className="qs-how-list">{t.howItems.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>
        <section>
          <h2>{t.limits}</h2>
          <p>{t.limitsText}</p>
        </section>
        <section>
          <h2>{t.sources}</h2>
          <ul className="ed-list">{VOLC_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>
        </section>
      </section>
    </div>
  );
}

/** Parte de la página que depende del tiempo de la animación (se redibuja sola, no toda la página). */
function Live({ clock, hz, children }: { clock: Clock; hz: number; children: (t: number) => React.ReactNode }) {
  const t = useClockTime(clock, hz);
  return <>{children(t)}</>;
}

/** Perfil vertical: la columna hasta su tope y el viento a cada altura (flecha hacia donde sopla, vista en planta). */
const ColumnProfile = memo(function ColumnProfile({ lang, top, vent, wind }: { lang: Lang; top: number; vent: number; wind: WindProfile }) {
  const Hmax = Math.max(20000, Math.ceil((top * 1.15) / 5000) * 5000), W = 320, H = 260, y = (h: number) => H - 20 - ((H - 40) * h) / Hmax;
  // Niveles separados al menos un 6 % de la altura del gráfico (cerca del suelo hay muchos y se pisan).
  const rows = wind.filter((l) => l.h > 0 && l.h <= Hmax).sort((a, b) => a.h - b.h).filter((l, i, a) => i === 0 || l.h - a[i - 1].h >= Hmax * 0.06);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vs-profile" role="img" aria-label={rows.map((l) => `${fmtNum(lang, l.h / 1000, 1)} km: ${fmtNum(lang, Math.hypot(l.u, l.v) * 3.6)} km/h`).join('; ')}>
      {Array.from({ length: Hmax / 5000 + 1 }, (_, k) => k * 5000).map((h) => (
        <g key={h}><line x1={40} x2={W - 8} y1={y(h)} y2={y(h)} stroke="#e7e7e2" /><text x={34} y={y(h)} textAnchor="end" dominantBaseline="middle" className="qs-axis">{fmtNum(lang, h / 1000)} km</text></g>
      ))}
      <path d={`M90 ${y(vent)} L84 ${y(vent * 0.4)} L60 ${y(0)} L120 ${y(0)} L96 ${y(vent * 0.4)} Z`} fill="#8a7a66" />
      <path d={`M88 ${y(vent)} C70 ${y((vent + top) / 2)} 66 ${y(top * 0.9)} 70 ${y(top)} L112 ${y(top)} C116 ${y(top * 0.9)} 110 ${y((vent + top) / 2)} 92 ${y(vent)} Z`} fill="rgba(110,104,98,.55)" />
      <line x1={60} x2={130} y1={y(top)} y2={y(top)} stroke="#c8102e" strokeDasharray="4 3" />
      {rows.map((l) => {
        const sp = Math.hypot(l.u, l.v), ang = Math.atan2(l.u, l.v), len = Math.min(24, 4 + sp * 0.7), cx = 200, cy = y(l.h);
        const dx = Math.sin(ang) * len, dy = -Math.cos(ang) * len;
        return (
          <g key={l.h}>
            <line x1={cx - dx / 2} y1={cy - dy / 2} x2={cx + dx / 2} y2={cy + dy / 2} stroke="#1c4f7a" strokeWidth={2} markerEnd="url(#vs-arrow)" />
            <text x={232} y={cy} dominantBaseline="middle" className="qs-axis">{fmtNum(lang, sp * 3.6)} km/h</text>
          </g>
        );
      })}
      <defs><marker id="vs-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#1c4f7a" /></marker></defs>
      <text x={200} y={10} textAnchor="middle" className="qs-axis">N ↑</text>
    </svg>
  );
});
