'use client';
/*
 * «Un día como hoy»: sismos, tsunamis, erupciones y ciclones de categoría 5 que ocurrieron en esta fecha en
 * otros años (public/data/dia/MM-DD.json, que arma `npm run this-day` con NOAA NCEI e IBTrACS).
 * La fecha es la del dispositivo, o la de ?fecha=MM-DD; se puede cambiar con las flechas o el selector.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Glyph } from './Glyph';
import { SHAPE } from '@/lib/symbols';
import { countryName } from '@/lib/countries';
import { fmtNum } from '@/lib/format';
import { routePath } from '@/lib/seo';
import { T as I18N } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

export type DayItem = {
  k: 'eq' | 'tsunami' | 'volcano' | 'cyclone'; y: number; place: string; iso3?: string; lat?: number; lon?: number;
  mag?: number; depth?: number; vei?: number; h?: number; kt?: number; name?: string; tsu?: boolean; deaths?: number; url: string;
};
type Kind = DayItem['k'];
const KINDS: Kind[] = ['eq', 'tsunami', 'volcano', 'cyclone'];
/** Tipo de la paleta del sitio (color y forma del glifo). */
const TYPE: Record<Kind, 'eq' | 'tsunami' | 'volcano' | 'storm'> = { eq: 'eq', tsunami: 'tsunami', volcano: 'volcano', cyclone: 'storm' };

const T = {
  es: {
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    day: (d: number, m: string) => `${d} de ${m}`,
    prev: 'Día anterior', next: 'Día siguiente', today: 'Hoy', pick: 'Elegir otra fecha',
    kinds: { eq: 'Sismos', tsunami: 'Tsunamis', volcano: 'Erupciones', cyclone: 'Ciclones cat. 5' } as Record<Kind, string>,
    sortBy: 'Ordenar', byImpact: 'Más importantes', byYear: 'Más recientes',
    count: (n: number) => (n === 1 ? '1 evento en esta fecha' : `${n} eventos en esta fecha`),
    none: 'No hay eventos registrados de este tipo en esta fecha.',
    loading: 'Cargando…', failed: 'No se pudieron cargar los datos. Probá de nuevo en un rato.',
    eq: (m: string) => `Sismo de magnitud ${m}`, eqNoMag: 'Sismo', tsunami: 'Tsunami', volcano: (n: string) => `Erupción del ${n}`,
    cyclone: (n: string | undefined, b: string) => `${n ? `Ciclón ${n}` : 'Ciclón sin nombre'} llega a categoría 5 (${b})`,
    ago: (n: number) => (n === 0 ? 'este año' : n === 1 ? 'hace 1 año' : `hace ${n} años`), bce: (y: string) => `${y} a. C.`,
    deaths: (n: string) => `${n} muertes`, vei: (v: number) => `índice de explosividad (VEI) ${v}`, wave: (h: string) => `ola de hasta ${h} m`,
    withTsu: 'con tsunami', depth: (d: string) => `${d} km de profundidad`, wind: (kt: string, kmh: string) => `viento de ${kmh} km/h (${kt} kt)`,
    source: 'Ficha de la fuente', simulate: 'Simular cómo se sintió', whatIf: '¿Y si pasara acá?', more: (n: number) => `Ver ${n} más`,
    note: 'Fuentes: bases de sismos, tsunamis y erupciones significativos de NOAA NCEI (sismos con muertes, daños de US$ 1 millón o más, magnitud 7,5 o más, intensidad X o más, o que causaron tsunami) y ciclones tropicales de IBTrACS v04r01 en el día de su viento máximo. Las fechas son las del catálogo: en los eventos antiguos pueden ser aproximadas o seguir otro calendario.',
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    day: (d: number, m: string) => `${m} ${d}`,
    prev: 'Previous day', next: 'Next day', today: 'Today', pick: 'Pick another date',
    kinds: { eq: 'Earthquakes', tsunami: 'Tsunamis', volcano: 'Eruptions', cyclone: 'Cat. 5 cyclones' } as Record<Kind, string>,
    sortBy: 'Sort', byImpact: 'Most significant', byYear: 'Most recent',
    count: (n: number) => (n === 1 ? '1 event on this date' : `${n} events on this date`),
    none: 'No events of this type recorded on this date.',
    loading: 'Loading…', failed: 'The data could not be loaded. Please try again later.',
    eq: (m: string) => `Magnitude ${m} earthquake`, eqNoMag: 'Earthquake', tsunami: 'Tsunami', volcano: (n: string) => `Eruption of ${n}`,
    cyclone: (n: string | undefined, b: string) => `${n ? `Cyclone ${n}` : 'Unnamed cyclone'} reaches category 5 (${b})`,
    ago: (n: number) => (n === 0 ? 'this year' : n === 1 ? '1 year ago' : `${n} years ago`), bce: (y: string) => `${y} BCE`,
    deaths: (n: string) => `${n} deaths`, vei: (v: number) => `explosivity index (VEI) ${v}`, wave: (h: string) => `waves up to ${h} m`,
    withTsu: 'with tsunami', depth: (d: string) => `${d} km deep`, wind: (kt: string, kmh: string) => `${kmh} km/h winds (${kt} kt)`,
    source: 'Source record', simulate: 'Simulate how it felt', whatIf: 'What if it happened here?', more: (n: number) => `Show ${n} more`,
    note: 'Sources: NOAA NCEI significant earthquake, tsunami and volcanic eruption databases (earthquakes with deaths, damage of US$1 million or more, magnitude 7.5 or more, intensity X or more, or a tsunami) and IBTrACS v04r01 tropical cyclones on the day of their peak wind. Dates are as in the catalog: for old events they may be approximate or follow another calendar.',
  },
};

/** Importancia para ordenar: muertes (escala log), magnitud, explosividad, ola y viento. */
const score = (i: DayItem) =>
  Math.log10(1 + (i.deaths ?? 0)) * 2 + Math.max(0, (i.mag ?? 0) - 6) * 1.5 + Math.max(0, (i.vei ?? 0) - 2) + Math.log10(1 + (i.h ?? 0)) + (i.tsu ? 0.5 : 0) + (i.kt ? (i.kt - 130) / 20 : 0);

const pad = (n: number) => String(n).padStart(2, '0');
/** Ambiente del sismo para el simulador: intraplaca profundo, interplaca grande o cortical. */
const setting = (i: DayItem) => ((i.depth ?? 0) > 70 ? 'slab' : (i.mag ?? 0) >= 8 ? 'interface' : 'crustal');

export function ThisDay({ lang, initial }: { lang: Lang; initial: { m: number; d: number } | null }) {
  const t = T[lang], basins = I18N[lang].basins, nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const [date, setDate] = useState<{ m: number; d: number } | null>(initial);
  const [items, setItems] = useState<DayItem[] | 'loading' | 'failed'>('loading');
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ eq: true, tsunami: true, volcano: true, cyclone: true });
  const [sort, setSort] = useState<'impact' | 'year'>('impact');
  const [shown, setShown] = useState(15);
  const [year, setYear] = useState<number | null>(null);

  // Sin ?fecha=, la del dispositivo (el servidor no sabe la zona horaria de quien mira).
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    if (!initial) setDate({ m: now.getMonth() + 1, d: now.getDate() });
  }, [initial]);

  useEffect(() => {
    if (!date) return;
    let ok = true;
    setItems('loading'); setShown(15);
    fetch(`/data/dia/${pad(date.m)}-${pad(date.d)}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: DayItem[]) => { if (ok) setItems(j); }).catch(() => { if (ok) setItems('failed'); });
    return () => { ok = false; };
  }, [date]);

  // 2024: año bisiesto, para que exista el 29 de febrero.
  const go = (step: number) => {
    if (!date) return;
    const dt = new Date(Date.UTC(2024, date.m - 1, date.d + step));
    const n = { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const u = new URL(window.location.href);
    u.searchParams.set(lang === 'es' ? 'fecha' : 'date', `${pad(n.m)}-${pad(n.d)}`);
    window.history.replaceState(null, '', u);
    setDate(n);
  };
  const setFromInput = (v: string) => {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(v);
    if (!m || !date) return;
    const dt = Date.UTC(2024, date.m - 1, date.d), to = Date.UTC(2024, +m[1] - 1, +m[2]);
    go(Math.round((to - dt) / 864e5));
  };

  const list = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const l = items.filter((i) => kinds[i.k]);
    return sort === 'impact' ? [...l].sort((a, b) => score(b) - score(a) || b.y - a.y) : l;
  }, [items, kinds, sort]);

  const label = (i: DayItem) => {
    if (i.k === 'eq') return i.mag != null ? t.eq(nf(i.mag, 1)) : t.eqNoMag;
    if (i.k === 'tsunami') return t.tsunami;
    if (i.k === 'volcano') return t.volcano(i.name ?? '');
    return t.cyclone(i.name, basins[i.place] ?? i.place);
  };
  const where = (i: DayItem) => (i.k === 'cyclone' ? '' : [i.k === 'volcano' ? null : i.place, i.iso3 ? countryName(i.iso3, lang) : null].filter(Boolean).join(' · '));
  const facts = (i: DayItem) => [
    i.deaths ? t.deaths(nf(i.deaths)) : null,
    i.k === 'eq' && i.depth != null ? t.depth(nf(i.depth)) : null,
    i.k === 'eq' && i.tsu ? (i.h ? `${t.withTsu} (${t.wave(nf(i.h, 1))})` : t.withTsu) : null,
    i.k === 'tsunami' && i.h ? t.wave(nf(i.h, 1)) : null,
    i.k === 'volcano' && i.vei != null ? t.vei(i.vei) : null,
    i.k === 'cyclone' && i.kt ? t.wind(nf(i.kt), nf(Math.round(i.kt * 1.852 / 5) * 5)) : null,
  ].filter(Boolean).join(' · ');
  const simHref = (i: DayItem) => {
    const s = new URLSearchParams({ m: String(Math.min(9.5, i.mag!)), h: String(Math.max(1, Math.round(i.depth ?? 15))), amb: setting(i), t: `${label(i)} · ${i.place} (${i.y})` });
    return `${routePath(lang, 'simulator')}?${s}`;
  };
  const whatIfHref = (i: DayItem) => {
    const s = new URLSearchParams({ m: String(Math.min(9.5, i.mag!)), h: String(Math.max(1, Math.round(i.depth ?? 15))), amb: setting(i), t: `${[i.place, i.iso3 ? countryName(i.iso3, lang) : null].filter(Boolean).join(', ')} (${i.y < 0 ? t.bce(String(-i.y)) : i.y})` });
    return `${routePath(lang, 'whatIf')}?${s}`;
  };

  return (
    <div className="td">
      <div className="td-nav">
        <button type="button" className="qs-chip" onClick={() => go(-1)} aria-label={t.prev} disabled={!date}>←</button>
        <h2 className="td-date">{date ? t.day(date.d, t.months[date.m - 1]) : '…'}</h2>
        <button type="button" className="qs-chip" onClick={() => go(1)} aria-label={t.next} disabled={!date}>→</button>
        <label className="td-pick">
          <span className="sr-only">{t.pick}</span>
          <input type="date" value={date ? `2024-${pad(date.m)}-${pad(date.d)}` : ''} onChange={(e) => setFromInput(e.target.value)} />
        </label>
      </div>

      <div className="td-filters">
        {KINDS.map((k) => (
          <button key={k} type="button" className="qs-chip" aria-pressed={kinds[k]} onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
            <Glyph shape={SHAPE[TYPE[k]]} type={TYPE[k]} size={12} /> {t.kinds[k]}
          </button>
        ))}
        <span className="td-sort">
          {t.sortBy}:{' '}
          <button type="button" className="qs-chip" aria-pressed={sort === 'impact'} onClick={() => setSort('impact')}>{t.byImpact}</button>
          <button type="button" className="qs-chip" aria-pressed={sort === 'year'} onClick={() => setSort('year')}>{t.byYear}</button>
        </span>
      </div>

      {items === 'loading' ? <p className="ed-note">{t.loading}</p> : items === 'failed' ? <p className="ed-note">{t.failed}</p> : (
        <>
          <p className="ml-head">{t.count(list.length)}</p>
          {!list.length && <p className="ed-note">{t.none}</p>}
          <ol className="td-list">
            {list.slice(0, shown).map((i) => (
              <li key={i.url} className="td-item">
                <span className="td-year">{i.y < 0 ? t.bce(String(-i.y)) : i.y}</span>
                <span className="td-body">
                  <span className="td-title"><Glyph shape={SHAPE[TYPE[i.k]]} type={TYPE[i.k]} alert={(i.deaths ?? 0) >= 1000 ? 3 : (i.deaths ?? 0) >= 100 ? 2 : 0} size={13} /> {label(i)}</span>
                  {where(i) && <span className="td-where">{where(i)}</span>}
                  <span className="td-facts">{[year != null && i.y > 0 ? t.ago(year - i.y) : null, facts(i)].filter(Boolean).join(' · ')}</span>
                  <span className="td-links">
                    <a href={i.url} target="_blank" rel="noopener noreferrer">{t.source} ↗</a>
                    {i.k === 'eq' && i.mag != null && i.mag >= 4 && <Link href={simHref(i)}>{t.simulate} →</Link>}
                    {i.k === 'eq' && i.mag != null && i.mag >= 5 && <Link href={whatIfHref(i)}>{t.whatIf} →</Link>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {list.length > shown && <button type="button" className="ed-button" onClick={() => setShown((n) => n + 30)}>{t.more(Math.min(30, list.length - shown))}</button>}
        </>
      )}
      <p className="ed-note">{t.note}</p>
    </div>
  );
}

