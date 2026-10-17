'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { geoDistance } from 'd3-geo';
import { Globe, HAZARD_LEVELS, SS_SCALE, type GlobeHandle, type Layers, type Overlays, type Pickable } from './Globe';
import { Glyph, TypeDot } from './Glyph';
import { EventCard } from './EventCard';
import { FeatureCard } from './FeatureCard';
import { ShareButtons } from './ShareButtons';
import { eventTitle } from '@/lib/eventText';
import { T } from '@/lib/i18n';
import { rewind } from '@/lib/rewind';
import { fmtDay, fmtHour, fmtNum, fmtRel } from '@/lib/format';
import { MIN_YEAR, RANGES, rangeInfo } from '@/lib/range';
import { SHAPE, TYPE_ORDER, alertLevel, isEvent, lastUpdate, relevance, type FilterType } from '@/lib/symbols';
import { alertTag, localTitle, localTsunamiRegion } from '@/lib/localize';
import { bucketOf, buckets } from '@/lib/timeline';
import type {
  DisasterEvent, EqDetail, EventsResponse, GvpVolcano, HeatBin, HistTrack, Lang, NhcStorm, RangeKey, SourceKey, SourceStatus,
  TsunamiMessage, VolcanoActivity,
} from '@/lib/types';

/** Formato de public/data/ibtracs/<temporada>.json (scripts/ibtracs.ts). */
type IbtracsStorm = { sid: string; name: string; basin: string; season: number; wind: number | null; pres: number | null; start: number; end: number; pts: [number, number, number | null][] };
const toTrack = (s: IbtracsStorm): HistTrack => {
  // Se ubica en el punto de viento máximo (o el primero si no hay viento).
  let best = s.pts[0];
  for (const p of s.pts) if (p[2] != null && (best[2] == null || p[2] > best[2])) best = p;
  return {
    id: 'ibtracs-' + s.sid, type: 'ibtracs', src: 'IBTrACS', title: s.name, name: s.name, basin: s.basin, season: s.season,
    windKt: s.wind, pressureMb: s.pres, start: s.start, end: s.end, lon: best[0], lat: best[1], points: s.pts,
  };
};
const NOW_LAYERS = new Set(['nhc', 'wvolc', 'firms']);
type FirmsState = 'idle' | 'wait' | 'ok' | 'needsKey' | 'err';

type Props = { lang: Lang; initialRange: RangeKey; initialYear: number; initialSel?: string };

const LAYER_KEYS = ['nhc', 'wvolc', 'firms', 'ibtracs', 'borders', 'plates', 'ring', 'gvp', 'hazard'] as const;
const SRC_NAME: Record<SourceKey, string> = { usgs: 'USGS', eonet: 'EONET', gdacs: 'GDACS', gvp: 'GVP', carto: 'PB2002' };
/** Un tramo de la línea de tiempo por cuadro de reproducción, a 1×. */
const PLAY_MS = 900;
/** Eventos de larga duración: como mucho 2 en la lista; el resto se agrupa. */
const LONG_TYPES = new Set(['drought']);

/** 2a "Satélite nocturno": globo a pantalla completa con paneles flotantes y línea de tiempo. */
export function Atlas({ lang, initialRange, initialYear, initialSel }: Props) {
  const t = T[lang];
  const nf = useCallback((x: number, d = 0) => fmtNum(lang, x, d), [lang]);

  const [range, setRange] = useState<RangeKey>(initialRange);
  const [year, setYear] = useState(initialYear);
  const [minMag, setMinMag] = useState(2.5);
  const [types, setTypes] = useState<Record<FilterType, boolean>>(
    () => Object.fromEntries(TYPE_ORDER.map((k) => [k, true])) as Record<FilterType, boolean>,
  );
  const [layers, setLayers] = useState<Layers>({
    nhc: true, wvolc: true, firms: false, ibtracs: true, borders: true, plates: true, ring: true, gvp: false, hazard: false,
  });
  const [storms, setStorms] = useState<NhcStorm[]>([]);
  const [volcanoes, setVolcanoes] = useState<VolcanoActivity[]>([]);
  const [heat, setHeat] = useState<HeatBin[]>([]);
  const [firmsState, setFirmsState] = useState<FirmsState>('idle');
  const [tracks, setTracks] = useState<HistTrack[]>([]);
  const [tsunami, setTsunami] = useState<{ messages: TsunamiMessage[]; active: TsunamiMessage[] } | null>(null);
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [win, setWin] = useState<{ s: number; e: number } | null>(null);
  const [gvp, setGvp] = useState<GvpVolcano[]>([]);
  // Filtro por tipo de vulcanismo (ambiente tectónico de GVP) para la capa de volcanes del Holoceno.
  const [volcKind, setVolcKind] = useState<'all' | 'subduction' | 'rift' | 'intraplate'>('all');
  const gvpShown = useMemo(() => (volcKind === 'all' ? gvp : gvp.filter((v) => v.setting === volcKind)), [gvp, volcKind]);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState<Partial<Record<SourceKey, SourceStatus>>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [sel, setSel] = useState<Pickable | null>(null);
  const [detail, setDetail] = useState<EqDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hover, setHover] = useState<{ e: Pickable; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [tab, setTab] = useState<'period' | 'alerts'>('period');
  const [showAllLong, setShowAllLong] = useState(false);
  const scrub = useRef<{ startI: number; prev: number | null; moved: boolean } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const globe = useRef<GlobeHandle>(null);
  // Hoja inferior de "Más relevantes" en celular: cerrada asoma 2–3 ítems; se arrastra hacia arriba.
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; h: number; moved: number } | null>(null);
  const selId = useRef<string | null>(null);

  const magFloor = rangeInfo(range, year).floor;

  // Período y evento seleccionado en la URL (compartible).
  const selParam = sel && isEvent(sel) ? sel.id : null;
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (range !== '7d') p.set('range', range);
    if (range === 'year') p.set('year', String(year));
    if (selParam) p.set('e', selParam);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [range, year, selParam]);
  useEffect(() => {
    window.history.replaceState(null, '', `/${lang}${qs}${window.location.hash}`);
  }, [lang, qs]);

  // `?e=id`: abrir ese evento al cargar, esté o no dentro del período.
  useEffect(() => {
    if (!initialSel) return;
    fetch(`/api/event?id=${encodeURIComponent(initialSel)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ event: DisasterEvent; detail: EqDetail | null }>) : Promise.reject(r.status)))
      .then(({ event, detail }) => {
        if (selId.current) return; // el usuario ya eligió otro
        selId.current = event.id;
        setSel(event); setDetail(detail); setDetailLoading(false);
        globe.current?.flyTo(event.lon, event.lat, 3);
      })
      .catch((err) => console.warn('[atlas] evento inicial', initialSel, err));
  }, [initialSel]);

  // Datos de eventos desde la API propia.
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setSel(null); setDetail(null); setFocus(null); setPlaying(false);
    setSrc((s) => ({ ...s, usgs: { state: 'wait' }, eonet: { state: 'wait' }, gdacs: { state: 'wait' } }));
    const p = new URLSearchParams({ range, ...(range === 'year' ? { year: String(year) } : {}) });
    fetch(`/api/events?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<EventsResponse>) : Promise.reject(r.status)))
      .then((j) => {
        setEvents(j.events); setSrc((s) => ({ ...s, ...j.sources })); setFetchedAt(j.fetchedAt);
        setWin({ s: Date.parse(j.range.start), e: Date.parse(j.range.end) }); setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error(err);
        setEvents([]); setLoading(false);
        setSrc((s) => ({ ...s, usgs: { state: 'err' }, eonet: { state: 'err' }, gdacs: { state: 'err' } }));
      });
    return () => ctrl.abort();
  }, [range, year]);

  useEffect(() => { setMinMag((m) => Math.max(m, magFloor)); }, [magFloor]);

  useEffect(() => {
    setSrc((s) => ({ ...s, gvp: { state: 'wait' } }));
    fetch('/api/gvp')
      .then((r) => (r.ok ? (r.json() as Promise<GvpVolcano[]>) : Promise.reject(r.status)))
      .then((j) => { setGvp(j); setSrc((s) => ({ ...s, gvp: { state: 'ok', count: j.length } })); })
      .catch(() => setSrc((s) => ({ ...s, gvp: { state: 'err' } })));
  }, []);

  // Fase 2 · B: ciclones activos (NHC), volcanes con actividad (GVP) y mensajes de tsunami (NOAA).
  useEffect(() => {
    const get = <J,>(u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<J>) : Promise.reject(r.status)));
    get<{ storms: NhcStorm[] }>('/api/storms').then((j) => setStorms(j.storms.map((st) => ({ ...st, cone: rewind(st.cone), windField: st.windField?.map((w) => ({ ...w, geometry: rewind(w.geometry) })) })))).catch((e) => console.warn('[atlas] nhc', e));
    get<{ volcanoes: VolcanoActivity[] }>('/api/volcanoes').then((j) => setVolcanoes(j.volcanoes)).catch((e) => console.warn('[atlas] volcanes', e));
    const tsu = () => get<{ messages: TsunamiMessage[]; active: TsunamiMessage[] }>('/api/tsunami').then(setTsunami).catch((e) => console.warn('[atlas] tsunami', e));
    tsu();
    const id = setInterval(tsu, 5 * 6e4);
    return () => clearInterval(id);
  }, []);

  // NHC, volcanes y FIRMS son "ahora": en un año pasado no se mezclan con ese año.
  const isNow = range !== 'year' || year === new Date().getUTCFullYear();
  const drawLayers = useMemo<Layers>(() => (isNow ? layers : { ...layers, nhc: false, wvolc: false, firms: false }), [layers, isNow]);
  // FIRMS pesa: solo se pide al encender la capa.
  useEffect(() => {
    if (!drawLayers.firms || firmsState !== 'idle') return;
    setFirmsState('wait');
    fetch('/api/firms')
      .then(async (r) => {
        if (r.status === 503) { setFirmsState('needsKey'); return; }
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { bins: HeatBin[] };
        setHeat(j.bins); setFirmsState('ok');
      })
      .catch(() => setFirmsState('err'));
  }, [drawLayers.firms, firmsState]);

  // IBTrACS: trayectorias históricas de la temporada, solo en modo Año.
  const ibtracsOn = layers.ibtracs && range === 'year';
  useEffect(() => {
    setTracks([]);
    if (!ibtracsOn) return;
    const ctrl = new AbortController();
    fetch(`/data/ibtracs/${year}.json`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<IbtracsStorm[]>) : Promise.reject(r.status)))
      .then((j) => setTracks(j.filter((s) => s.pts.length).map(toTrack)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [ibtracsOn, year]);

  // Amenaza sísmica GSHAP (~750 kB): se baja recién al encender la capa.
  const [hazard, setHazard] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    if (!layers.hazard || hazard) return;
    fetch('/data/gshap.json').then((r) => r.json()).then(setHazard).catch(() => {});
  }, [layers.hazard, hazard]);

  // Animación de la trayectoria de un ciclón (observada y pronosticada), unos 8 segundos.
  const [stormAnim, setStormAnim] = useState<{ id: string; t: number } | null>(null);
  const animateStorm = useCallback((st: NhcStorm) => {
    const times = [...(st.pastPoints ?? []).map((p) => p.time), ...(st.forecastPoints ?? []).map((p) => p.time ?? NaN)].filter(Number.isFinite);
    if (times.length < 2) return;
    const t0 = Math.min(...times), t1 = Math.max(...times), start = performance.now(), DUR = 8000;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / DUR);
      setStormAnim({ id: st.id, t: t0 + (t1 - t0) * k });
      if (k < 1) raf = requestAnimationFrame(step); else setTimeout(() => setStormAnim(null), 1200);
    };
    raf = requestAnimationFrame(step);
    animStop.current = () => { cancelAnimationFrame(raf); setStormAnim(null); };
  }, []);
  const animStop = useRef<() => void>(() => {});

  const overlays = useMemo<Overlays>(() => ({ storms, heat, volcanoes, tracks, hazard, stormAnim }), [storms, heat, volcanoes, tracks, hazard, stormAnim]);

  const passesFilters = useCallback((e: DisasterEvent) => {
    if (e.type === 'eq') {
      if (e.mag != null && e.mag < minMag) return false;
      return types.eq || (!!e.tsunami && types.tsunami);
    }
    return types[e.type];
  }, [types, minMag]);

  const filtered = useMemo(() => events.filter(passesFilters), [events, passesFilters]);

  // Línea de tiempo: tramos iguales del período, alto = eventos visibles en cada tramo.
  const bs = useMemo(() => (win ? buckets(range, win.s, win.e, lang) : []), [win, range, lang]);
  const perBucket = useMemo(() => {
    const c = new Array(bs.length).fill(0);
    for (const e of filtered) { const i = bucketOf(bs, lastUpdate(e)); if (i >= 0) c[i]++; }
    return c as number[];
  }, [filtered, bs]);
  const maxBucket = Math.max(1, ...perBucket);

  // Orden de dibujo: alertas y magnitudes mayores arriba.
  const visible = useMemo(() => {
    const v = focus == null ? filtered : filtered.filter((e) => bucketOf(bs, lastUpdate(e)) === focus);
    return v.slice().sort((a, b) => relevance(a) - relevance(b));
  }, [filtered, focus, bs]);

  // Un evento abierto por enlace puede quedar fuera del período: se dibuja igual.
  // Con la capa NHC encendida, el mismo ciclón de EONET/GDACS no se dibuja dos veces
  // (mismo nombre, a menos de 1000 km): sigue en las listas y en "Eventos cercanos".
  const drawn = useMemo(() => {
    const dupOfNhc = (e: DisasterEvent) => drawLayers.nhc && e.type === 'storm' && storms.some((s) =>
      new RegExp(`\\b${s.name}\\b`, 'i').test(e.title) && geoDistance([s.lon, s.lat], [e.lon, e.lat]) * 6371 < 1000);
    const v = storms.length ? visible.filter((e) => !dupOfNhc(e)) : visible;
    return sel && isEvent(sel) && !v.some((e) => e.id === sel.id) ? [...v, sel] : v;
  }, [visible, sel, storms, drawLayers.nhc]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(TYPE_ORDER.map((k) => [k, 0])) as Record<FilterType, number>;
    for (const e of events) {
      if (focus != null && bucketOf(bs, lastUpdate(e)) !== focus) continue;
      if (e.type === 'eq') { if (e.mag == null || e.mag >= minMag) { c.eq++; if (e.tsunami) c.tsunami++; } }
      else c[e.type]++;
    }
    return c;
  }, [events, minMag, focus, bs]);

  // Play: recorre los tramos uno por uno y vuelve a "todo el período" al final.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setFocus((f) => {
        const next = f == null ? 0 : f + 1;
        if (next >= bs.length) { setPlaying(false); return null; }
        return next;
      });
    }, PLAY_MS / speed);
    return () => clearInterval(id);
  }, [playing, bs.length, speed]);

  const subLine = (e: Pickable) => {
    if (e.type === 'gvp') return [e.country, e.vtype].filter(Boolean).join(' · ');
    if (e.type === 'nhc') return [t.nhcClass[e.classification] ?? e.classification, e.windKt != null ? `${nf(e.windKt)} kt` : '', 'NOAA NHC'].filter(Boolean).join(' · ');
    if (e.type === 'heat') return [t.heatUnit(e.count), `FRP ${nf(e.frpMax, 1)} MW`, 'NASA FIRMS'].join(' · ');
    if (e.type === 'wvolc') return [e.country, t.volcStatus[e.status], 'GVP'].filter(Boolean).join(' · ');
    if (e.type === 'ibtracs') return [t.basins[e.basin] ?? e.basin, e.windKt != null ? `${nf(e.windKt)} kt` : '', 'IBTrACS'].filter(Boolean).join(' · ');
    const parts = [t.T1[e.type]];
    if (e.type === 'eq' && e.mag != null) parts.unshift('M ' + nf(e.mag, 1));
    if (e.time) parts.push(fmtRel(lang, lastUpdate(e)));
    return parts.join(' · ');
  };

  const select = useCallback((e: Pickable) => {
    selId.current = e.id;
    setSel(e); setDetail(null); setHover(null); setFiltersOpen(false);
    globe.current?.flyTo(e.lon, e.lat, 3);
    const isUsgs = e.type === 'eq' && e.src === 'USGS';
    setDetailLoading(isUsgs);
    if (isUsgs) {
      fetch(`/api/eq-detail?id=${encodeURIComponent(e.id)}`)
        .then((r) => (r.ok ? (r.json() as Promise<EqDetail>) : Promise.reject(r.status)))
        .then((d) => { if (selId.current === e.id) { setDetail(d); setDetailLoading(false); } })
        .catch(() => { if (selId.current === e.id) setDetailLoading(false); });
    }
  }, []);
  useEffect(() => { selId.current = sel?.id ?? null; }, [sel]);

  // Dos pestañas: "Esta semana" (empezaron dentro del período) y "Alertas activas"
  // (alerta oficial naranja/roja con datos nuevos en el período, aunque hayan empezado antes).
  const tabEvents = useMemo(() => {
    const list = tab === 'period'
      ? visible.filter((e) => !win || (e.start ?? e.time) >= win.s)
      : visible.filter((e) => alertLevel(e) >= 2 && (!win || lastUpdate(e) >= win.s));
    return list.sort((a, b) => relevance(b) - relevance(a));
  }, [visible, win, tab]);
  const { top, moreLong } = useMemo(() => {
    const long = tabEvents.filter((e) => LONG_TYPES.has(e.type));
    const rest = tabEvents.filter((e) => !LONG_TYPES.has(e.type)).slice(0, 10);
    const shownLong = showAllLong ? long : long.slice(0, 2);
    return {
      top: [...rest, ...shownLong].sort((a, b) => relevance(b) - relevance(a)),
      moreLong: long.length - 2,
    };
  }, [tabEvents, showAllLong]);
  const when = (e: DisasterEvent) => {
    const began = e.start ?? e.time;
    if (!win || began >= win.s) return fmtRel(lang, lastUpdate(e));
    return t.ongoingSince(fmtDay(lang, began));
  };
  const nearby = useMemo(() => {
    if (!sel) return [];
    return visible
      .filter((e) => e.id !== sel.id)
      .map((e) => ({ e, d: geoDistance([e.lon, e.lat], [sel.lon, sel.lat]) * 6371 }))
      .filter((x) => x.d < 300)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
  }, [visible, sel]);

  const rangeLabel = focus != null && bs[focus] ? bs[focus].title : range === 'year' ? `${t.inYear} ${year}` : `${t.last} ${t[`r${range}`]}`;
  const ri = rangeInfo(range, year);
  const rangeNote = range === 'year' ? `${t.noteLong} ${t.noteYear}` : ri.days > 31 ? t.noteLong : t.noteShort;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = new Date().getFullYear(); y >= MIN_YEAR; y--) out.push(y);
    return out;
  }, []);
  const sheetDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = sheetRef.current;
    if (!el) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntero sintético o ya liberado */ }
    drag.current = { y: e.clientY, h: el.getBoundingClientRect().height, moved: 0 };
    el.style.transition = 'none';
  };
  const sheetMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = sheetRef.current, d = drag.current;
    if (!el || !d) return;
    const dy = d.y - e.clientY;
    d.moved = Math.max(d.moved, Math.abs(dy));
    const max = (el.parentElement?.clientHeight ?? 800) - 150;
    el.style.height = `${Math.max(120, Math.min(max, d.h + dy))}px`;
  };
  const sheetUp = () => {
    const el = sheetRef.current, d = drag.current;
    drag.current = null;
    if (!el || !d) return;
    const h = el.getBoundingClientRect().height;
    el.style.transition = '';
    el.style.height = '';
    // Toque: alterna. Arrastre: queda del lado más cercano.
    if (d.moved < 6) setSheetOpen((o) => !o);
    else setSheetOpen(h > d.h + (sheetOpen ? -80 : 80));
  };

  /** Índice del tramo bajo el puntero. */
  const bucketAt = (el: HTMLElement, x: number) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(bs.length - 1, Math.floor(((x - r.left) / r.width) * bs.length)));
  };
  const scrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!bs.length) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* puntero sintético */ }
    const i = bucketAt(e.currentTarget, e.clientX);
    scrub.current = { startI: i, prev: focus, moved: false };
    setPlaying(false);
    setFocus(i);
  };
  const scrubMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrub.current) return;
    const i = bucketAt(e.currentTarget, e.clientX);
    if (i !== scrub.current.startI) scrub.current.moved = true;
    setFocus(i);
  };
  const scrubUp = () => {
    const s0 = scrub.current;
    scrub.current = null;
    // Toque sin arrastrar sobre el tramo ya fijado: lo suelta (vuelve a todo el período).
    if (s0 && !s0.moved && s0.prev === s0.startI) setFocus(null);
  };

  const featureTitle = (e: Pickable) =>
    e.type === 'nhc' ? `${t.nhcClass[e.classification] ?? e.classification} ${e.name}`
      : e.type === 'heat' ? t.heatKicker
      : e.type === 'ibtracs' ? `${e.name || t.unnamed} (${e.season})` : e.title;
  const layerNote = (k: (typeof LAYER_KEYS)[number]) => {
    if (k === 'gvp' && src.gvp?.state === 'err') return ` · ${t.err}`;
    if (!isNow && NOW_LAYERS.has(k)) return ` · ${t.onlyNow}`;
    if (k === 'firms') return firmsState === 'needsKey' ? ` · ${t.needsKey('FIRMS_MAP_KEY')}` : firmsState === 'wait' ? ` · ${t.loadingLayer}` : firmsState === 'err' ? ` · ${t.err}` : firmsState === 'ok' ? ` · ${nf(heat.length)}` : '';
    if (k === 'nhc') return storms.length ? ` · ${nf(storms.length)}` : '';
    if (k === 'wvolc') return volcanoes.length ? ` · ${nf(volcanoes.length)}` : '';
    if (k === 'ibtracs') return range === 'year' && tracks.length ? ` · ${nf(tracks.length)}` : '';
    return '';
  };

  const onCarto = useCallback((s: SourceStatus) => setSrc((x) => ({ ...x, carto: s })), []);
  const toggleType = (k: FilterType) => setTypes((s) => ({ ...s, [k]: !s[k] }));
  const evSources: SourceKey[] = ['usgs', 'eonet', 'gdacs'];
  const allOk = evSources.every((k) => src[k]?.state === 'ok');

  return (
    <div className="theme-night map-shell">
      <section className="map-stage" aria-label={t.brand}>
        {/* El globo vive entre la barra superior y la línea de tiempo: nada lo tapa. */}
        <div className="globe-area">
          <Globe ref={globe} events={drawn} gvp={gvpShown} layers={drawLayers} overlays={overlays} selected={sel} showTsunami={types.tsunami}
            onSelect={select} onHover={setHover} onCarto={onCarto} />
        </div>

        {tsunami && tsunami.active.length > 0 && (
          <div className="tsunami-banner" role="alert">
            {tsunami.active.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                <strong>{t.tsunamiLevel[m.level]}</strong> · {t.tsunamiCenterName[m.center] ?? m.center} · {localTsunamiRegion(m.region, lang)} · {fmtHour(lang, m.issued)} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        )}

        <header className="map-top">
          <Link href={`/${lang}`} className="map-brand">{t.brand}</Link>
          <div className="chips" role="group" aria-label={t.types}>
            {TYPE_ORDER.map((k) => (
              <button key={k} className="chip" aria-pressed={types[k]} onClick={() => toggleType(k)}>
                <TypeDot type={k} />{t.Tshort[k]}
              </button>
            ))}
          </div>
          <span className={`live${allOk ? '' : ' degraded'}`} title={t.dataStatus}>
            <span className="live-dot" />
            <span className="live-text">
              {t.live.toUpperCase()}
              {fetchedAt ? <><span className="live-date"> · {fmtDay(lang, fetchedAt)}</span> · {fmtHour(lang, fetchedAt)}</> : ' · —'}
            </span>
          </span>
          <nav className="map-nav" aria-label={lang === 'es' ? 'Secciones' : 'Sections'}>
            <Link href={`/${lang}/ranking`}>{t.nav2.ranking}</Link>
            <Link href={`/${lang}/paises`}>{t.nav2.countries}</Link>
            <Link href={`/${lang}/metodologia`}>{t.nav2.method}</Link>
          </nav>
          <span className="map-lang">
            {(['es', 'en'] as Lang[]).map((l, i) => (
              <span key={l}>
                {i > 0 && ' / '}
                <Link href={`/${l}${qs}`} hrefLang={l} aria-current={l === lang ? 'true' : undefined}>{l.toUpperCase()}</Link>
              </span>
            ))}
          </span>
          <button className="map-filters-btn" aria-expanded={filtersOpen} aria-controls="map-filters" onClick={() => setFiltersOpen((o) => !o)}>
            {t.filters}
          </button>
        </header>

        <aside id="map-filters" className={`panel panel-left${filtersOpen ? ' open' : ''}`}>
          <div className="panel-count">
            <span className="big-count">{nf(visible.length)}</span>
            <span className="muted">{t.eventsIn} {rangeLabel}</span>
          </div>
          <div className="type-list" role="group" aria-label={t.types}>
            {TYPE_ORDER.map((k) => (
              <button key={k} className="type-row" aria-pressed={types[k]} onClick={() => toggleType(k)}>
                <Glyph shape={SHAPE[k]} type={k} />
                <span className="type-name">{t.T[k]}</span>
                <span className="mono faint">{nf(counts[k])}</span>
              </button>
            ))}
          </div>

          <div className="stack">
            <span className="panel-label">{t.period}</span>
            <div className="seg" role="radiogroup" aria-label={t.period}>
              {RANGES.map((k) => (
                <label key={k} className="seg-opt">
                  <input type="radio" name="rng" checked={range === k} onChange={() => setRange(k)} />
                  {t[`r${k}`]}
                </label>
              ))}
            </div>
            {range === 'year' && (
              <select className="night-select" value={year} onChange={(e) => setYear(+e.target.value)} aria-label={t.yearLabel}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <span className="note">{rangeNote}</span>
          </div>

          <div className="stack">
            <div className="row-between">
              <label htmlFor="minmag" className="panel-label">{t.minMag}</label>
              <span className="mono">M {nf(minMag, 1)}</span>
            </div>
            <input id="minmag" className="night-range" type="range" min={magFloor} max={8} step={0.1} value={minMag}
              onChange={(e) => setMinMag(+e.target.value)} />
          </div>

          <div className="night-legend" aria-label={t.legSize}>
            <span className="row"><svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true"><circle cx="3" cy="7" r="2" fill="#ff7a3d" /><circle cx="12" cy="7" r="3.5" fill="#ff7a3d" /><circle cx="26" cy="7" r="6" fill="#ff7a3d" /></svg>{t.legendMag}</span>
            <span className="row"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.5" fill="#ff7a3d" /><circle cx="8" cy="8" r="7" fill="none" stroke="#ff9a5c" strokeWidth="1.2" /></svg>{t.legendRing}</span>
          </div>

          <details className="layers">
            <summary className="panel-label">{t.layers}</summary>
            {LAYER_KEYS.map((k) => (
              <button key={k} className="layer-row" disabled={(k === 'firms' && firmsState === 'needsKey') || (!isNow && NOW_LAYERS.has(k))} aria-pressed={layers[k]}
                onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
                <span className="check" aria-hidden="true" />
                <span className="stack-2">
                  <span>{t.L[k]}</span>
                  <span className="faint small">{t.N[k]}{layerNote(k)}</span>
                </span>
              </button>
            ))}
            {layers.gvp && (
              <div className="seg seg-wrap" role="radiogroup" aria-label={t.volcKind}>
                {(['all', 'subduction', 'rift', 'intraplate'] as const).map((k) => (
                  <label key={k} className="seg-opt">
                    <input type="radio" name="volck" checked={volcKind === k} onChange={() => setVolcKind(k)} />
                    {t.volcKinds[k]}{k !== 'all' ? ` (${nf(gvp.filter((v) => v.setting === k).length)})` : ''}
                  </label>
                ))}
              </div>
            )}
            {layers.nhc && storms.length > 0 && (
              <div className="ss-legend" aria-label={t.ssLegend}>
                <span className="faint small">{t.ssLegend}</span>
                <div className="ss-scale">{SS_SCALE.map(([, c, k]) => <span key={k} style={{ background: c }}>{t.ssCats[k]}</span>)}</div>
              </div>
            )}
            {layers.hazard && (
              <div className="hazard-legend">
                <div className="hazard-scale" role="img" aria-label={t.hazardLegend}>
                  {HAZARD_LEVELS.map(([v, c]) => (
                    <span key={v} style={{ background: c }}><span className="mono">{nf(v, 1)}</span></span>
                  ))}
                </div>
                <span className="faint small">{t.hazardUnit}</span>
                <p className="note">{t.hazardHelp}</p>
              </div>
            )}
          </details>

          {/* En celular el idioma vive acá para dejar lugar en la barra superior. */}
          <span className="map-lang panel-lang">
            {(['es', 'en'] as Lang[]).map((l, i) => (
              <span key={l}>
                {i > 0 && ' / '}
                <Link href={`/${l}${qs}`} hrefLang={l} aria-current={l === lang ? 'true' : undefined}>{l.toUpperCase()}</Link>
              </span>
            ))}
          </span>
        </aside>

        <aside ref={sheetRef} className={`panel panel-right${sel ? ' has-sel' : ''}${!sel && sheetOpen ? ' sheet-open' : ''}`} aria-live="polite">
          {sel ? (
            <>
              {isEvent(sel) || sel.type === 'gvp' ? (
              <EventCard lang={lang} e={sel} detail={detail} detailLoading={detailLoading} onClose={() => { setSel(null); setDetail(null); }}
                tsunami={tsunami?.messages ?? null}
                actions={isEvent(sel) && (
                  <>
                    <Link href={`/${lang}/evento/${encodeURIComponent(sel.id)}`} className="ev-link">{t.permalink} →</Link>
                    <ShareButtons lang={lang} path={`/${lang}/evento/${encodeURIComponent(sel.id)}`} text={t.shareEvent(eventTitle(lang, sel))} />
                  </>
                )} />
              ) : <FeatureCard lang={lang} f={sel} onClose={() => { animStop.current(); setSel(null); }}
                animating={!!stormAnim && stormAnim.id === sel.id}
                onAnimate={sel.type === 'nhc' ? () => (stormAnim ? animStop.current() : animateStorm(sel)) : undefined} />}
              {nearby.length > 0 && (
                <div className="stack-4">
                  <span className="panel-label">{t.nearby}</span>
                  {nearby.map(({ e, d }) => (
                    <button key={e.id} className="ev-row" onClick={() => select(e)}>
                      <span className="ev-row-mag" style={{ color: `var(--type-${e.type})` }}>{e.type === 'eq' && e.mag != null ? nf(e.mag, 1) : ''}</span>
                      <span className="ev-row-body">
                        <span className="ev-row-title">{localTitle(e, lang)}</span>
                        <span className="ev-row-meta">
                          <Glyph shape={SHAPE[e.type]} type={e.type} alert={alertLevel(e)} size={12} />
                          {[`${nf(d)} km`, t.T1[e.type], fmtDay(lang, lastUpdate(e))].join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="stack-4 top-list">
              {/* Manija de la hoja inferior (solo celular): arrastrar o tocar para abrir/cerrar. */}
              <button className="sheet-handle" aria-expanded={sheetOpen} aria-label={t.topTitle}
                onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp} onPointerCancel={sheetUp}>
                <span className="sheet-grip" aria-hidden="true" />
              </button>
              <span className="panel-label">{t.topTitle}</span>
              <div className="tabs" role="tablist" aria-label={t.topTitle}>
                {(['period', 'alerts'] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={tab === k} className="tab"
                    onClick={() => { setTab(k); setShowAllLong(false); }}>
                    {k === 'alerts' ? t.tabAlerts : range === '7d' ? t.tabWeek : t.tabPeriod}
                  </button>
                ))}
              </div>
              <p className="note" style={{ margin: '0 0 6px' }}>{tab === 'alerts' ? t.tabAlertsSub : t.tabPeriodSub}</p>
              {top.length === 0 && <p className="note">{tab === 'alerts' ? t.noAlerts : t.noData}</p>}
              {top.map((e) => (
                <button key={e.id} className="ev-row" onClick={() => select(e)}>
                  <span className="ev-row-mag" style={{ color: `var(--type-${e.type})` }}>{e.type === 'eq' && e.mag != null ? nf(e.mag, 1) : ''}</span>
                  <span className="ev-row-body">
                    <span className="ev-row-title">{localTitle(e, lang)}</span>
                    <span className="ev-row-meta">
                      <Glyph shape={SHAPE[e.type]} type={e.type} alert={alertLevel(e)} size={12} />
                      {[t.T1[e.type], when(e), alertTag(e, lang)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
              {moreLong > 0 && (
                <button className="ev-row ev-group" onClick={() => setShowAllLong((v) => !v)} aria-expanded={showAllLong}>
                  <Glyph shape={SHAPE.drought} type="drought" size={12} />
                  <span className="ev-row-body"><span className="ev-row-meta">{showAllLong ? t.showLess : t.moreLong(moreLong)}</span></span>
                </button>
              )}
            </div>
          )}
        </aside>

        <div className="map-zoom">
          <button onClick={() => globe.current?.zoomBy(1.8)} aria-label={t.zoomIn} title={t.zoomIn}>+</button>
          <button onClick={() => globe.current?.zoomBy(1 / 1.8)} aria-label={t.zoomOut} title={t.zoomOut}>−</button>
          <button onClick={() => { setSel(null); globe.current?.reset(); }} aria-label={t.resetView} title={t.resetView}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
          </button>
        </div>

        <div className="map-bottom">
          <div className="play-group">
            <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.pause : t.play} title={playing ? t.pause : t.play} disabled={!bs.length}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="speed" onClick={() => setSpeed((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))} title={t.speed} aria-label={`${t.speed}: ${speed}×`}>
              {speed}×
            </button>
          </div>
          {/* Arrastrar sobre la línea de tiempo la recorre (scrubber); tocar un tramo lo fija o lo suelta. */}
          <div className={`timeline${bs.length > 14 ? ' dense' : ''}`} role="group" aria-label={t.period}
            onPointerDown={scrubDown} onPointerMove={scrubMove} onPointerUp={scrubUp} onPointerCancel={scrubUp}>
            {bs.map((b) => (
              <button key={b.i} className={`tl-bar${focus === b.i ? ' on' : ''}${focus != null && focus !== b.i ? ' dim' : ''}`}
                title={`${b.title} · ${nf(perBucket[b.i] ?? 0)}`} aria-pressed={focus === b.i}
                onClick={(ev) => { if (ev.detail === 0) { setPlaying(false); setFocus((f) => (f === b.i ? null : b.i)); } }}>
                <span className="tl-count">{nf(perBucket[b.i] ?? 0)}</span>
                <span className="tl-track"><span className="tl-fill" style={{ height: `${Math.round(((perBucket[b.i] ?? 0) / maxBucket) * 100)}%` }} /></span>
                <span className="tl-label">{bs.length <= 14 || b.i % 5 === 0 || focus === b.i ? b.label : ' '}</span>
              </button>
            ))}
          </div>
          <div className="map-sources">
            <a href="#semana" className="scroll-cue">{t.weekBelow} ↓</a>
            {focus != null && <button className="tl-all" onClick={() => { setPlaying(false); setFocus(null); }}>{t.allPeriod}</button>}
            <span className="src-line" title={t.dataStatus}>
              {t.srcShort}:
              {(['usgs', 'eonet', 'gdacs'] as SourceKey[]).map((k) => {
                const s = src[k]?.state ?? 'wait';
                return <span key={k} className={`src src-${s}`} title={`${SRC_NAME[k]} · ${t[s]}`}>{SRC_NAME[k]}</span>;
              })}
            </span>
          </div>
        </div>


        {hover && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
            <div className="tooltip-title">{isEvent(hover.e) ? localTitle(hover.e, lang) : featureTitle(hover.e)}</div>
            <div className="faint small">{subLine(hover.e)}</div>
          </div>
        )}
        {loading && <div className="loading" role="status">{t.loading}</div>}
      </section>
    </div>
  );
}
