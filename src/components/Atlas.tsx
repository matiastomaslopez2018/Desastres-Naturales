'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { geoDistance } from 'd3-geo';
import { Globe, type GlobeHandle, type Layers, type Pickable } from './Globe';
import { Glyph, TypeDot } from './Glyph';
import { EventCard } from './EventCard';
import { T } from '@/lib/i18n';
import { fmtDay, fmtHour, fmtNum, fmtRel } from '@/lib/format';
import { MIN_YEAR, RANGES, rangeInfo } from '@/lib/range';
import { SHAPE, TYPE_ORDER, alertLevel, lastUpdate, relevance, type FilterType } from '@/lib/symbols';
import { alertTag, localTitle } from '@/lib/localize';
import { bucketOf, buckets } from '@/lib/timeline';
import type {
  DisasterEvent, EqDetail, EventsResponse, GvpVolcano, Lang, RangeKey, SourceKey, SourceStatus,
} from '@/lib/types';

type Props = { lang: Lang; initialRange: RangeKey; initialYear: number; initialSel?: string };

const LAYER_KEYS = ['borders', 'plates', 'ring', 'gvp', 'hazard'] as const;
const SRC_NAME: Record<SourceKey, string> = { usgs: 'USGS', eonet: 'EONET', gdacs: 'GDACS', gvp: 'GVP', carto: 'PB2002' };
const PLAY_MS = 650;

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
  const [layers, setLayers] = useState<Layers>({ borders: true, plates: true, ring: true, gvp: false, hazard: false });
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [win, setWin] = useState<{ s: number; e: number } | null>(null);
  const [gvp, setGvp] = useState<GvpVolcano[]>([]);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState<Partial<Record<SourceKey, SourceStatus>>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [sel, setSel] = useState<Pickable | null>(null);
  const [detail, setDetail] = useState<EqDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hover, setHover] = useState<{ e: Pickable; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const globe = useRef<GlobeHandle>(null);
  // Hoja inferior de "Más relevantes" en celular: cerrada asoma 2–3 ítems; se arrastra hacia arriba.
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; h: number; moved: number } | null>(null);
  const selId = useRef<string | null>(null);

  const magFloor = rangeInfo(range, year).floor;

  // Período y evento seleccionado en la URL (compartible).
  const selParam = sel && sel.type !== 'gvp' ? sel.id : null;
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
  const drawn = useMemo(
    () => (sel && sel.type !== 'gvp' && !visible.some((e) => e.id === sel.id) ? [...visible, sel] : visible),
    [visible, sel],
  );

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
    }, PLAY_MS);
    return () => clearInterval(id);
  }, [playing, bs.length]);

  const subLine = (e: Pickable) => {
    if (e.type === 'gvp') return [e.country, e.vtype].filter(Boolean).join(' · ');
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

  // Solo eventos con datos nuevos dentro del período (una sequía abierta hace meses entra
  // si GDACS la actualizó ahora, y se rotula "en curso desde…").
  const top = useMemo(
    () => visible.filter((e) => !win || lastUpdate(e) >= win.s).sort((a, b) => relevance(b) - relevance(a)).slice(0, 10),
    [visible, win],
  );
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

  const onCarto = useCallback((s: SourceStatus) => setSrc((x) => ({ ...x, carto: s })), []);
  const toggleType = (k: FilterType) => setTypes((s) => ({ ...s, [k]: !s[k] }));
  const evSources: SourceKey[] = ['usgs', 'eonet', 'gdacs'];
  const allOk = evSources.every((k) => src[k]?.state === 'ok');

  return (
    <div className="theme-night map-shell">
      <section className="map-stage" aria-label={t.brand}>
        {/* El globo vive entre la barra superior y la línea de tiempo: nada lo tapa. */}
        <div className="globe-area">
          <Globe ref={globe} events={drawn} gvp={gvp} layers={layers} selected={sel} showTsunami={types.tsunami}
            onSelect={select} onHover={setHover} onCarto={onCarto} />
        </div>

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
              <button key={k} className="layer-row" disabled={k === 'hazard'} aria-pressed={layers[k]}
                onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
                <span className="check" aria-hidden="true" />
                <span className="stack-2">
                  <span>{t.L[k]}</span>
                  <span className="faint small">{t.N[k]}{k === 'gvp' && src.gvp?.state === 'err' ? ` · ${t.err}` : ''}</span>
                </span>
              </button>
            ))}
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
              <EventCard lang={lang} e={sel} detail={detail} detailLoading={detailLoading} onClose={() => { setSel(null); setDetail(null); }}
                actions={sel.type !== 'gvp' && <Link href={`/${lang}/evento/${encodeURIComponent(sel.id)}`} className="ev-link">{t.permalink} →</Link>} />
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
              <p className="note" style={{ margin: '0 0 6px' }}>{t.topSub}</p>
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
          <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.pause : t.play} title={playing ? t.pause : t.play} disabled={!bs.length}>
            {playing ? '❚❚' : '▶'}
          </button>
          <div className={`timeline${bs.length > 14 ? ' dense' : ''}`} role="group" aria-label={t.period}>
            {bs.map((b) => (
              <button key={b.i} className={`tl-bar${focus === b.i ? ' on' : ''}${focus != null && focus !== b.i ? ' dim' : ''}`}
                title={`${b.title} · ${nf(perBucket[b.i] ?? 0)}`} aria-pressed={focus === b.i}
                onClick={() => { setPlaying(false); setFocus((f) => (f === b.i ? null : b.i)); }}>
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
            <div className="tooltip-title">{hover.e.type === 'gvp' ? hover.e.title : localTitle(hover.e, lang)}</div>
            <div className="faint small">{subLine(hover.e)}</div>
          </div>
        )}
        {loading && <div className="loading" role="status">{t.loading}</div>}
      </section>
    </div>
  );
}
