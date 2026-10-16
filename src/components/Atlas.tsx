'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { geoDistance } from 'd3-geo';
import { Globe, type GlobeHandle, type Layers, type Pickable } from './Globe';
import { Glyph } from './Glyph';
import { EventCard } from './EventCard';
import { MethodDialog } from './MethodDialog';
import { SiteNav } from './SiteHeader';
import { T } from '@/lib/i18n';
import { fmtNum, fmtRel, fmtTime } from '@/lib/format';
import { MIN_YEAR, RANGES, rangeInfo } from '@/lib/range';
import { SHAPE, TYPE_ORDER, relevance, type FilterType } from '@/lib/symbols';
import type {
  DisasterEvent, EqDetail, EventsResponse, GvpVolcano, Lang, RangeKey, SourceKey, SourceStatus,
} from '@/lib/types';

type Props = { lang: Lang; initialRange: RangeKey; initialYear: number; initialSel?: string };

const LAYER_KEYS = ['borders', 'plates', 'ring', 'gvp', 'hazard'] as const;
const SRC_NAME: Record<SourceKey, string> = { usgs: 'USGS', eonet: 'NASA EONET', gdacs: 'GDACS', gvp: 'Smithsonian GVP', carto: 'Natural Earth · PB2002' };

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
  const [gvp, setGvp] = useState<GvpVolcano[]>([]);
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState<Partial<Record<SourceKey, SourceStatus>>>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [sel, setSel] = useState<Pickable | null>(null);
  const [detail, setDetail] = useState<EqDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hover, setHover] = useState<{ e: Pickable; x: number; y: number } | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const globe = useRef<GlobeHandle>(null);
  const selId = useRef<string | null>(null);

  const ri = rangeInfo(range, year);
  const magFloor = ri.floor;

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
    window.history.replaceState(null, '', `/${lang}${qs}`);
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
    setLoading(true); setSel(null); setDetail(null);
    setSrc((s) => ({ ...s, usgs: { state: 'wait' }, eonet: { state: 'wait' }, gdacs: { state: 'wait' } }));
    const p = new URLSearchParams({ range, ...(range === 'year' ? { year: String(year) } : {}) });
    fetch(`/api/events?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<EventsResponse>) : Promise.reject(r.status)))
      .then((j) => {
        setEvents(j.events); setSrc((s) => ({ ...s, ...j.sources })); setFetchedAt(j.fetchedAt); setLoading(false);
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

  const isVisible = useCallback((e: DisasterEvent) => {
    if (e.type === 'eq') {
      if (e.mag != null && e.mag < minMag) return false;
      return types.eq || (!!e.tsunami && types.tsunami);
    }
    return types[e.type];
  }, [types, minMag]);

  // Orden de dibujo: alertas y magnitudes mayores arriba.
  const visible = useMemo(() => {
    const v = events.filter(isVisible);
    return v.sort((a, b) => relevance(a) - relevance(b));
  }, [events, isVisible]);

  // Un evento abierto por enlace puede quedar fuera del período: se dibuja igual.
  const drawn = useMemo(
    () => (sel && sel.type !== 'gvp' && !visible.some((e) => e.id === sel.id) ? [...visible, sel] : visible),
    [visible, sel],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(TYPE_ORDER.map((k) => [k, 0])) as Record<FilterType, number>;
    for (const e of events) {
      if (e.type === 'eq') { if (e.mag == null || e.mag >= minMag) { c.eq++; if (e.tsunami) c.tsunami++; } }
      else c[e.type]++;
    }
    return c;
  }, [events, minMag]);

  const typeLabel = (e: Pickable) => (e.type === 'gvp' ? t.gvpKicker : t.T[e.type]);
  const subLine = (e: Pickable) => {
    if (e.type === 'gvp') return [e.country, e.vtype].filter(Boolean).join(' · ');
    const parts = [typeLabel(e)];
    if (e.type === 'eq' && e.mag != null) parts.unshift('M ' + e.mag.toFixed(1));
    if (e.time) parts.push(fmtRel(lang, e.time));
    return parts.join(' · ');
  };

  const select = useCallback((e: Pickable) => {
    selId.current = e.id;
    setSel(e); setDetail(null); setHover(null);
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

  const top = useMemo(() => visible.slice().sort((a, b) => relevance(b) - relevance(a)).slice(0, 12), [visible]);
  const nearby = useMemo(() => {
    if (!sel) return [];
    return visible
      .filter((e) => e.id !== sel.id)
      .map((e) => ({ e, d: geoDistance([e.lon, e.lat], [sel.lon, sel.lat]) * 6371 }))
      .filter((x) => x.d < 300)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6);
  }, [visible, sel]);

  const rangeLabel = range === 'year' ? `${t.inYear} ${year}` : `${t.last} ${t[`r${range}`]}`;
  const rangeNote = range === 'year' ? `${t.noteLong} ${t.noteYear}` : ri.days > 31 ? t.noteLong : t.noteShort;
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = new Date().getFullYear(); y >= MIN_YEAR; y--) out.push(y);
    return out;
  }, []);
  const otherLang: Lang = lang === 'es' ? 'en' : 'es';
  const onCarto = useCallback((s: SourceStatus) => setSrc((x) => ({ ...x, carto: s })), []);

  return (
    <div className="page">
      <header className="nav site-nav">
        <div className="nav-brand brand">
          <span className="brand-name">{t.brand}</span>
          <span className="brand-sub">{t.brandSub}</span>
        </div>
        <SiteNav lang={lang} current="map" />
        <span className="muted-12 tabular">{t.updated} {fetchedAt ? fmtTime(lang, fetchedAt) : '—'}</span>
        <button className="btn btn-secondary" onClick={() => setMethodOpen(true)} style={{ fontSize: 13 }}>{t.method}</button>
        <div className="seg" role="group" aria-label="Idioma / Language">
          {(['es', 'en'] as Lang[]).map((l) => (
            <Link key={l} href={`/${l}${qs}`} className={`seg-opt seg-link${l === lang ? ' on' : ''}`} aria-current={l === lang ? 'true' : undefined} hrefLang={l} prefetch={l === otherLang}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      </header>

      <main className="layout">
        <aside className="col-filters">
          <div className="stack-6">
            <div className="block-title">{t.types}</div>
            {TYPE_ORDER.map((k) => (
              <button key={k} className="toggle-row" aria-pressed={types[k]} style={{ opacity: types[k] ? 1 : 0.5 }}
                onClick={() => setTypes((s) => ({ ...s, [k]: !s[k] }))}>
                <span className="check"><span style={{ background: types[k] ? 'var(--color-accent)' : 'transparent' }} /></span>
                <span className="glyph-cell"><Glyph shape={SHAPE[k]} /></span>
                <span style={{ flex: 1, fontSize: 14 }}>{t.T[k]}</span>
                <span className="muted-12 tabular">{nf(counts[k])}</span>
              </button>
            ))}
          </div>

          <div className="stack-10">
            <div className="block-title">{t.period}</div>
            <div className="seg" style={{ display: 'flex' }}>
              {RANGES.map((k) => (
                <label key={k} className="seg-opt range-opt">
                  <input type="radio" name="rng" checked={range === k} onChange={() => setRange(k)} />
                  {t[`r${k}`]}
                </label>
              ))}
            </div>
            {range === 'year' && (
              <select className="input" value={year} onChange={(e) => setYear(+e.target.value)} aria-label={t.yearLabel}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <div className="note">{rangeNote}</div>
          </div>

          <div className="stack-8">
            <div className="row-between" style={{ alignItems: 'baseline' }}>
              <label htmlFor="minmag" className="block-title">{t.minMag}</label>
              <span className="mag-val">M {nf(minMag, 1)}</span>
            </div>
            <input id="minmag" type="range" min={magFloor} max={8} step={0.1} value={minMag}
              onChange={(e) => setMinMag(+e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="stack-6">
            <div className="block-title">{t.layers}</div>
            {LAYER_KEYS.map((k) => (
              <button key={k} className="toggle-row layer-row" disabled={k === 'hazard'} aria-pressed={layers[k]}
                onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>
                <span className="check" style={{ marginTop: 2 }}><span style={{ background: layers[k] ? 'var(--color-accent)' : 'transparent' }} /></span>
                <span className="stack-2">
                  <span style={{ fontSize: 14 }}>{t.L[k]}</span>
                  <span className="muted-11">{t.N[k]}{k === 'gvp' && src.gvp?.state === 'err' ? ` · ${t.err}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="col-globe" aria-label="Globo">
          <Globe ref={globe} events={drawn} gvp={gvp} layers={layers} selected={sel} showTsunami={types.tsunami}
            onSelect={select} onHover={setHover} onCarto={onCarto} />
          <div className="ov-count">
            <span className="count-num">{nf(visible.length)}</span>
            <span className="muted-12">{t.eventsIn} {rangeLabel}</span>
          </div>
          <div className="ov-zoom">
            <button className="btn btn-secondary btn-icon" onClick={() => globe.current?.zoomBy(1.8)} aria-label="Zoom +">+</button>
            <button className="btn btn-secondary btn-icon" onClick={() => globe.current?.zoomBy(1 / 1.8)} aria-label="Zoom −">−</button>
            <button className="btn btn-secondary btn-icon" onClick={() => { setSel(null); globe.current?.reset(); }} aria-label="Reset">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
            </button>
          </div>
          <div className="ov-legend">
            <span className="legend-item">
              <svg width="34" height="14" viewBox="0 0 34 14" fill="rgba(89,128,166,.22)" stroke="var(--color-accent-700)"><circle cx="3" cy="7" r="2" /><circle cx="12" cy="7" r="3.5" /><circle cx="26" cy="7" r="6" /></svg>
              {t.legSize}
            </span>
            <span className="legend-item">
              <svg width="40" height="14" viewBox="0 0 40 14" stroke="var(--color-accent-800)"><circle cx="6" cy="7" r="5" fill="rgba(89,128,166,.22)" /><circle cx="20" cy="7" r="5" fill="var(--color-accent)" /><circle cx="34" cy="7" r="5" fill="var(--color-accent-900)" /></svg>
              {t.legAlert}
            </span>
            <span>{t.hint}</span>
          </div>
          {hover && (
            <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{hover.e.title}</div>
              <div className="muted-11">{subLine(hover.e)}</div>
            </div>
          )}
          {loading && <div className="loading-box" role="status">{t.loading}</div>}
        </section>

        <aside className="col-detail">
          {sel ? (
            <>
              <EventCard lang={lang} e={sel} detail={detail} detailLoading={detailLoading} onClose={() => { setSel(null); setDetail(null); }}
                actions={sel.type !== 'gvp' && <Link href={`/${lang}/evento/${encodeURIComponent(sel.id)}`} className="src-link">{t.permalink} <span aria-hidden="true">→</span></Link>} />
              {nearby.length > 0 && (
                <div className="stack-4">
                  <span className="block-title">{t.nearby}</span>
                  {nearby.map(({ e, d }) => (
                    <button key={e.id} className="list-row" onClick={() => select(e)}>
                      <span className="glyph-cell" style={{ marginTop: 2 }}><Glyph shape={SHAPE[e.type]} /></span>
                      <span className="stack-2"><span style={{ fontSize: 13 }}>{e.title}</span><span className="muted-11">{nf(d)} km · {subLine(e)}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="stack-4">
              <h2 className="top-title">{t.topTitle}</h2>
              <p className="top-sub">{t.topSub}</p>
              {top.map((e) => (
                <button key={e.id} className="list-row top-row" onClick={() => select(e)}>
                  <span className="top-mag">{e.type === 'eq' && e.mag != null ? e.mag.toFixed(1) : ''}</span>
                  <span className="stack-3" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, lineHeight: 1.3 }}>{e.title}</span>
                    <span className="muted-11 inline-6">
                      <Glyph shape={SHAPE[e.type]} />
                      {[t.T[e.type], fmtRel(lang, e.time), e.alert ? `GDACS ${e.alert}` : e.pager ? `PAGER ${e.pager}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </main>

      <footer className="site-footer">
        <span className="block-title">{t.dataStatus}</span>
        {(Object.keys(SRC_NAME) as SourceKey[]).map((k) => {
          const s = src[k] ?? { state: 'wait' };
          const cls = s.state === 'ok' ? 'tag-accent' : s.state === 'err' ? 'tag-outline' : 'tag-neutral';
          return (
            <span key={k} className="inline-6">
              <span className={`tag ${cls}`}>{t[s.state]}</span>
              {SRC_NAME[k]} <span className="tabular">{s.count != null ? nf(s.count) : ''}</span>
            </span>
          );
        })}
        <span className="footer-credit">{t.carto}</span>
      </footer>

      {methodOpen && <MethodDialog lang={lang} onClose={() => setMethodOpen(false)} />}
    </div>
  );
}
