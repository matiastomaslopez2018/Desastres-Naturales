'use client';
/*
 * "Mi lugar": buscador (Open-Meteo, a partir de GeoNames) o ubicación del navegador, y el perfil de peligros
 * naturales del punto que arma /api/place con datos oficiales y científicos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PlaceProfile as Profile } from '@/lib/server/place';
import { GEM_LEVELS, PLACE_SOURCES, PLACE_TEXT, gemLevel, mmiOf } from '@/lib/place/text';
import { fmtNum, fmtTime } from '@/lib/format';
import { routePath } from '@/lib/seo';
import { plateLabel } from '@/lib/geoText';
import type { Lang } from '@/lib/types';
import { PlaceMap, type MapItems } from './PlaceMap';
import { GUIDE_T, type HazardKey } from '@/lib/guides';

type Now = { id: string; type: string; title: string; time: number; mag: number | null; km: number }[];
type Place = { name: string; lat: number; lon: number; mine?: boolean };
type Hit = { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string; population?: number };

const EXAMPLES: Place[] = [
  { name: 'Mendoza', lat: -32.89, lon: -68.85 }, { name: 'Valparaíso', lat: -33.05, lon: -71.62 }, { name: 'San Carlos de Bariloche', lat: -41.13, lon: -71.31 },
  { name: 'Quito', lat: -0.22, lon: -78.51 }, { name: 'Lima', lat: -12.05, lon: -77.04 }, { name: 'Ciudad de México', lat: 19.43, lon: -99.13 }, { name: 'Miami', lat: 25.77, lon: -80.19 },
];
const r2 = (x: number) => Math.round(x * 100) / 100;
/** "Placa Sudamericana" → "placa Sudamericana" (va en medio de la oración). */
const lower = (s: string) => s.replace(/^Placa /, 'placa ');

export function PlaceProfile({ lang, initial }: { lang: Lang; initial: Place | null }) {
  const t = PLACE_TEXT[lang];
  const [place, setPlace] = useState<Place | null>(initial);
  const [data, setData] = useState<{ profile: Profile; now: Now } | 'loading' | 'failed' | null>(null);

  useEffect(() => {
    if (!place) { setData(null); return; }
    let ok = true;
    setData('loading');
    fetch(`/api/place?lat=${place.lat}&lon=${place.lon}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (ok) setData(j); }).catch(() => { if (ok) setData('failed'); });
    return () => { ok = false; };
  }, [place]);

  // La URL guarda el lugar buscado (no la ubicación del navegador, para no compartirla sin querer).
  const pick = useCallback((p: Place) => {
    const q = { ...p, lat: r2(p.lat), lon: r2(p.lon) };
    setPlace(q);
    const u = new URL(window.location.href);
    u.search = '';
    if (!p.mine) { u.searchParams.set(lang === 'es' ? 'lugar' : 'place', p.name); u.searchParams.set('lat', String(q.lat)); u.searchParams.set('lon', String(q.lon)); }
    // Next.js sincroniza su router con replaceState nativo (estado null, como recomienda su documentación).
    window.history.replaceState(null, '', u);
  }, [lang]);

  return (
    <div className="ml">
      <Search lang={lang} onPick={pick} />
      {!place && (
        <div className="ml-examples">
          <span className="qs-help">{t.examples}:</span>
          {EXAMPLES.map((p) => <button key={p.name} type="button" className="qs-chip" onClick={() => pick(p)}>{p.name}</button>)}
        </div>
      )}
      {place && data === 'loading' && <p className="ml-status">{t.loading}</p>}
      {place && data === 'failed' && <p className="qs-warn">{t.failed}</p>}
      {place && data && typeof data === 'object' && <Result lang={lang} place={place} p={data.profile} now={data.now} />}
      <p className="ed-note">{t.notRisk}</p>
      <section className="ml-sources">
        <h2 className="ed-h3">{t.sources}</h2>
        <ul className="ed-list">{PLACE_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ul>
        <p className="ed-note">{t.geocoder}</p>
      </section>
    </div>
  );
}

/* ───────────── Buscador ───────────── */

function Search({ lang, onPick }: { lang: Lang; onPick: (p: Place) => void }) {
  const t = PLACE_TEXT[lang];
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loc, setLoc] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits(null); return; }
    let ok = true;
    timer.current = setTimeout(() => {
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=${lang}&format=json`)
        .then((r) => r.json()).then((j: { results?: Hit[] }) => { if (ok) { setHits(j.results ?? []); setOpen(true); } }).catch(() => { if (ok) setHits([]); });
    }, 300);
    return () => { ok = false; };
  }, [q, lang]);
  const label = (h: Hit) => [h.name, h.admin1 && h.admin1 !== h.name ? h.admin1 : null, h.country].filter(Boolean).join(', ');
  const choose = (h: Hit) => { onPick({ name: [h.name, h.country].filter(Boolean).join(', '), lat: h.latitude, lon: h.longitude }); setOpen(false); setQ(''); };
  const locate = () => {
    if (!('geolocation' in navigator)) { setLoc('denied'); return; }
    setLoc('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc('idle'); onPick({ name: t.myPlace, lat: pos.coords.latitude, lon: pos.coords.longitude, mine: true }); },
      () => setLoc('denied'), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };
  return (
    <div className="ml-search">
      <form className="ml-search-row" role="search" onSubmit={(e) => { e.preventDefault(); if (hits?.[0]) choose(hits[0]); }}>
        <label className="sr-only" htmlFor="ml-q">{t.search}</label>
        <input id="ml-q" className="ml-input" type="search" autoComplete="off" placeholder={t.searchPh} value={q}
          onChange={(e) => setQ(e.target.value)} onFocus={() => hits && setOpen(true)} aria-expanded={open && !!hits?.length} aria-controls="ml-hits" role="combobox" aria-autocomplete="list" />
        <button type="button" className="ml-locate" onClick={locate} disabled={loc === 'busy'}>📍 {loc === 'busy' ? t.locating : t.locate}</button>
      </form>
      {open && hits && (
        <ul id="ml-hits" className="ml-hits" role="listbox">
          {hits.length ? hits.map((h) => (
            <li key={h.id} role="option" aria-selected={false}><button type="button" onClick={() => choose(h)}>{label(h)}</button></li>
          )) : <li className="ml-hits-none">{t.noResults}</li>}
        </ul>
      )}
      {loc === 'denied' ? <p className="qs-help">{t.locDenied}</p> : <p className="qs-help">{t.locNote}</p>}
    </div>
  );
}

/* ───────────── Resultado ───────────── */

function Result({ lang, place, p, now }: { lang: Lang; place: Place; p: Profile; now: Now }) {
  const t = PLACE_TEXT[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const q = p.quake, cls = q.gem, lvl = cls == null ? null : gemLevel(cls);
  const gLo = cls ? GEM_LEVELS[cls - 1] : 0, gHi = cls != null && cls < GEM_LEVELS.length ? GEM_LEVELS[cls] : null;
  const range = cls == null ? '' : cls === 0 ? `< ${nf(0.02, 2)} g` : gHi == null ? `> ${nf(gLo, 2)} g` : `${nf(gLo, 2)}–${nf(gHi, 2)} g`;
  // Intensidad de Mercalli del rango de la clase (en la clase más baja, "IV o menos").
  const mmi = cls == null ? '' : cls === 0 ? t.orLess(mmiOf(0.019)) : gHi == null ? mmiOf(gLo) : mmiOf(gLo) === mmiOf(gHi * 0.999) ? mmiOf(gLo) : `${mmiOf(gLo)}–${mmiOf(gHi * 0.999)}`;
  const v100 = p.volcano.list.filter((v) => v.km <= 100).length, v0 = p.volcano.list[0];
  const maxRun = p.tsunami.runups.reduce((a, r) => Math.max(a, r.height), 0);
  const slideDeaths = p.landslide.list.reduce((a, s) => a + s.deaths, 0);
  const coastal = p.coastKm != null && p.coastKm <= 20;
  const tsuHead = !coastal ? t.tsuFar(nf(p.coastKm ?? 0)) : p.elevation != null && p.elevation > Math.max(30, maxRun * 1.5) ? t.tsuHigh(nf(p.elevation)) : t.tsuCoast(nf(p.coastKm ?? 0, 1), nf(Math.max(0, p.elevation ?? 0)));
  const yr = (y: number | null) => (y == null ? t.noDate : t.lastErup(y < 0 ? t.bce(nf(-y)) : String(y)));
  const items: MapItems = useMemo(() => ({
    quakes: q.big.map((e) => ({ lon: e.lon, lat: e.lat, mag: e.mag })),
    volcanoes: p.volcano.list.map((v) => ({ lon: v.lon, lat: v.lat, name: v.name })),
    runups: p.tsunami.runups.map((r) => ({ lon: r.lon, lat: r.lat, height: r.height })),
    slides: p.landslide.list.map((s) => ({ lon: s.lon, lat: s.lat })),
  }), [p, q.big]);
  const simHref = (e: Profile['quake']['big'][number]) => {
    const s = new URLSearchParams({ m: String(e.mag), h: String(Math.round(e.depth)), d: String(Math.max(1, e.km)), amb: e.setting, t: `${e.place} (${new Date(e.time).getUTCFullYear()}) → ${place.name}` });
    if (e.setting === 'crustal') s.set('mec', 'reverse');
    return `${routePath(lang, 'simulator')}?${s}`;
  };
  const ashHref = (sim: string) => `${routePath(lang, 'volcanoSim')}?${lang === 'es' ? 'erupcion' : 'eruption'}=${sim}&${lang === 'es' ? 'lugar' : 'place'}=${encodeURIComponent(`${place.name}|${place.lat}|${place.lon}`)}`;
  const [copied, setCopied] = useState(false);

  return (
    <div className="ml-result">
      <header className="ml-place">
        <h2 className="ml-name">{place.name}</h2>
        <p className="ml-meta">
          {[p.country, `${nf(Math.abs(p.lat), 2)}° ${p.lat < 0 ? 'S' : 'N'}, ${nf(Math.abs(p.lon), 2)}° ${p.lon < 0 ? (lang === 'es' ? 'O' : 'W') : 'E'}`,
            p.elevation != null ? t.elev(nf(Math.max(0, p.elevation))) : null, p.coastKm != null ? (p.coastKm < 1 ? t.atSea : t.coast(nf(p.coastKm))) : null].filter(Boolean).join(' · ')}
        </p>
        {!place.mine && (
          <button type="button" className="ml-share" onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true)).catch(() => {}); }}>{copied ? t.copied : t.share}</button>
        )}
      </header>

      <div className="ml-cards" aria-label={t.summary}>
        <a href="#ml-quake" className={`ml-card ml-lvl-${lvl ?? 0}`}><span className="ml-card-k">{t.quake}</span><b>{lvl != null ? t.levels[lvl] : '—'}</b><span>{lvl != null ? range : t.gemNone}</span></a>
        <a href="#ml-volc" className="ml-card"><span className="ml-card-k">{t.volcano}</span><b>{v0 ? `${nf(v0.km)} km` : '—'}</b><span>{v0 ? v0.name : t.volcNone}</span></a>
        <a href="#ml-tsu" className="ml-card"><span className="ml-card-k">{t.tsunami}</span><b>{coastal ? (maxRun ? t.m(nf(maxRun, 1)) : '—') : '—'}</b><span>{coastal ? t.tsuCard(p.tsunami.runups.length) : t.coast(nf(p.coastKm ?? 0))}</span></a>
        <a href="#ml-cyc" className="ml-card"><span className="ml-card-k">{t.cyclone}</span><b>{nf(p.cyclone.list.length)}</b><span>{t.cycCard}</span></a>
        <a href="#ml-slide" className="ml-card"><span className="ml-card-k">{t.landslide}</span><b>{nf(p.landslide.list.length)}</b><span>{t.slideCard(nf(p.landslide.radiusKm))}</span></a>
        <a href="#ml-now" className="ml-card"><span className="ml-card-k">{t.now}</span><b>{nf(now.length)}</b><span>{t.nowCard}</span></a>
      </div>

      <section className="qs-card" aria-label={t.map}>
        <PlaceMap lang={lang} lon={p.lon} lat={p.lat} name={place.name} items={items} legend={t.mapLegend} />
      </section>

      <section id="ml-quake" className="ml-sec">
        <h2 className="ed-h3">{t.quake}</h2>
        {cls != null ? <><p className="ml-head">{t.gemHead(t.levels[lvl!])}</p><p className="ed-body">{t.gemText(range, mmi)}</p></> : <p className="ed-body">{t.gemNone}</p>}
        {q.plate.boundary && q.plate.here && q.plate.other && <p className="ed-body">{t.plate(lower(plateLabel(lang, q.plate.here.code, q.plate.here.name)), lower(plateLabel(lang, q.plate.other.code, q.plate.other.name)), nf(q.plate.boundary.distKm), t.kinds[q.plate.boundary.kind])}{q.slab ? ` ${t.subduction(nf(q.slab.depth))}` : ''}</p>}
        {q.m5 != null && <p className="ed-body">{t.counts(nf(q.radiusKm), nf(q.m5), nf(q.m6 ?? 0), nf(q.m7 ?? 0))}</p>}
        {q.big.length > 0 && (
          <>
            <h3 className="qs-h3">{t.biggest}</h3>
            <ul className="ml-list">
              {q.big.map((e) => (
                <li key={e.id}>
                  <Link href={`/${lang}/evento/${encodeURIComponent(e.id)}`} className="ml-mag">M {nf(e.mag, 1)}</Link>
                  <span><b>{new Date(e.time).getUTCFullYear()}</b> · {e.place} · {t.km(nf(e.km))} · {t.depth(nf(e.depth))}</span>
                  <Link href={simHref(e)} className="ml-act">{t.simulate} →</Link>
                </li>
              ))}
            </ul>
            <p className="qs-help">{t.simulateHelp}</p>
          </>
        )}
        {q.harmful.length > 0 && (
          <>
            <h3 className="qs-h3">{t.harmful}</h3>
            <ul className="ml-list">
              {q.harmful.map((e) => (
                <li key={e.url}><a href={e.url} target="_blank" rel="noopener noreferrer" className="ml-mag">{e.year}</a><span>{e.place.toLowerCase().replace(/(^|[\s,(-])\p{L}/gu, (c) => c.toUpperCase())}{e.mag ? ` · M ${nf(e.mag, 1)}` : ''} · {t.km(nf(e.km))} · <b>{t.deaths(nf(e.deaths ?? 0))}</b></span></li>
              ))}
            </ul>
            <p className="qs-help">{t.harmfulNote}</p>
          </>
        )}
        <p className="ed-note">{t.gemNote}</p>
        <Todo lang={lang} h="eq" />
      </section>

      <section id="ml-volc" className="ml-sec">
        <h2 className="ed-h3">{t.volcano}</h2>
        <p className="ml-head">{v0 ? t.volcHead(v100, v0.name, nf(v0.km)) : t.volcNone}</p>
        {p.volcano.list.length > 0 && (
          <ul className="ml-list">
            {p.volcano.list.map((v) => (
              <li key={v.num}>
                <span className="ml-mag">{nf(v.km)} km</span>
                <span>{v.slug ? <Link href={routePath(lang, 'volcano', v.slug)}>{v.name}</Link> : v.name}{v.country ? ` (${v.country})` : ''} · {yr(v.lastErup)}</span>
                {v.sim && <Link href={ashHref(v.sim)} className="ml-act">{t.ashSim} →</Link>}
              </li>
            ))}
          </ul>
        )}
        <p className="ed-note">{t.volcNote}</p>
        <Todo lang={lang} h="volcano" />
      </section>

      <section id="ml-tsu" className="ml-sec">
        <h2 className="ed-h3">{t.tsunami}</h2>
        <p className="ml-head">{tsuHead}</p>
        <p className="ed-body">{p.tsunami.runups.length ? t.runups(p.tsunami.runups.length, nf(p.tsunami.radiusKm), nf(maxRun, 1)) : t.runupsNone(nf(p.tsunami.radiusKm))}</p>
        {p.tsunami.runups.length > 0 && (
          <ul className="ml-list">
            {[...p.tsunami.runups].sort((a, b) => b.height - a.height).slice(0, 8).map((r, i) => (
              <li key={i}>
                <span className="ml-mag">{t.m(nf(r.height, 1))}</span>
                <span><b>{r.year < 0 ? t.bce(nf(-r.year)) : r.year}</b> · {r.place} · {t.km(nf(r.km))}{r.deaths ? ` · ${t.deaths(nf(r.deaths))}` : ''}</span>
                {r.eventId && <a className="ml-act" href={`https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${r.eventId}`} target="_blank" rel="noopener noreferrer">NOAA ↗</a>}
              </li>
            ))}
          </ul>
        )}
        <p className="ed-note">{t.tsuNote}</p>
        <Todo lang={lang} h="tsunami" />
      </section>

      <section id="ml-cyc" className="ml-sec">
        <h2 className="ed-h3">{t.cyclone}</h2>
        <p className="ml-head">{t.cycHead(p.cyclone.list.length)}</p>
        {p.cyclone.list.length > 0 && (
          <ul className="ml-list">
            {p.cyclone.list.slice(0, 8).map((c) => (
              <li key={c.sid}>
                <span className="ml-mag">{nf(Math.round(c.windKt * 1.852))} km/h</span>
                <span><a href={`https://ncics.org/ibtracs/index.php?name=v04r01-${c.sid}`} target="_blank" rel="noopener noreferrer">{c.name && c.name !== 'NOT_NAMED' ? c.name.charAt(0) + c.name.slice(1).toLowerCase() : t.unnamed}</a> ({c.season})</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ed-note">{t.cycNote}</p>
        <Todo lang={lang} h="storm" />
      </section>

      <section id="ml-slide" className="ml-sec">
        <h2 className="ed-h3">{t.landslide}</h2>
        <p className="ml-head">{t.slideHead(p.landslide.list.length, nf(p.landslide.radiusKm), nf(slideDeaths))}</p>
        {p.landslide.list.length > 0 && (
          <ul className="ml-list">
            {p.landslide.list.slice(0, 8).map((s, i) => (
              <li key={i}>
                <span className="ml-mag">{t.deaths(nf(s.deaths))}</span>
                <span>{s.time ? <b>{new Date(s.time).getUTCFullYear()}</b> : null}{s.time ? ' · ' : ''}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a> : s.title} · {t.km(nf(s.km))}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ed-note">{t.slideNote}</p>
        <Todo lang={lang} h="landslide" />
      </section>

      <section id="ml-now" className="ml-sec">
        <h2 className="ed-h3">{t.now}</h2>
        <p className="ml-head">{t.nowHead(now.length)}</p>
        {now.length > 0 && (
          <ul className="ml-list">
            {now.map((e) => (
              <li key={e.id}>
                <span className="ml-mag">{e.type === 'eq' && e.mag != null ? `M ${nf(e.mag, 1)}` : t.types[e.type]}</span>
                <span><Link href={`/${lang}/evento/${encodeURIComponent(e.id)}`}>{e.title}</Link> · {fmtTime(lang, e.time, 'UTC')} · {t.km(nf(e.km))}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ed-note">{t.nowNote}</p>
      </section>
    </div>
  );
}

/** Enlace a la guía "Qué hacer" de un peligro. */
function Todo({ lang, h }: { lang: Lang; h: HazardKey }) {
  return <Link className="ed-more" href={`${routePath(lang, 'whatToDo')}#${GUIDE_T[lang].anchors[h]}`}>{GUIDE_T[lang].title} →</Link>;
}
