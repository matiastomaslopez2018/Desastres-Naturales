import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { VolcanoGeology } from '@/components/geology/VolcanoGeology';
import { notFound, permanentRedirect } from 'next/navigation';
import { Glyph } from '@/components/Glyph';
import { MediaFigure } from '@/components/MediaFigure';
import { NATIONAL } from '@/components/CountryHistory';
import { SiteFooter, SiteHeader } from '@/components/SiteHeader';
import { countryName } from '@/lib/countries';
import { fmtCoords, fmtNum, fmtRel, fmtTime } from '@/lib/format';
import { T, isLang } from '@/lib/i18n';
import { alertTag, countryFromEnglish, localTitle, localTsunamiRegion, localVolcanoType } from '@/lib/localize';
import { QUAKE_COUNTRIES, ROUTES, jsonLd, quakeCountryByIso, quakeCountryBySlug, routePath, type RouteKey } from '@/lib/seo';
import { SEO } from '@/lib/seoText';
import { SITE_URL } from '@/lib/site';
import { SHAPE, alertLevel, isHighlighted, relevance } from '@/lib/symbols';
import { getHeat } from '@/lib/server/firms';
import { recentEvents, volcanoEvents, volcanoIndex, volcanoesNow } from '@/lib/server/landing';
import { getActiveStorms } from '@/lib/server/nhc';
import { getTsunamiMessages } from '@/lib/server/tsunami';
import { getVolcanoActivity } from '@/lib/server/volcanoes';
import type { DisasterEvent, Lang } from '@/lib/types';

/*
 * Páginas de búsquedas frecuentes ("sismo hoy", "volcanes activos", …). Son páginas de
 * servidor livianas (sin el globo interactivo) para que carguen rápido en el celular.
 * Cada carpeta de app/[lang] llama a estas funciones con el idioma que le corresponde.
 */

const LIST_MAX = 60;
const DAY = 864e5;

/* ───────────── Idioma de la carpeta y metadatos ───────────── */

/** Devuelve el idioma si coincide con el de la carpeta; si no, redirige a la ruta del otro idioma. */
export async function pageLang(params: Promise<{ lang: string }>, folder: Lang, key: RouteKey, sub?: Record<Lang, string>): Promise<Lang> {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  if (lang !== folder) permanentRedirect(routePath(lang, key, sub?.[lang]));
  return lang;
}

export function seoMeta(lang: Lang, key: RouteKey, title: string, description: string, sub?: Record<Lang, string>): Metadata {
  const path = (l: Lang) => routePath(l, key, sub?.[l]);
  const full = `${title} · ${SEO[lang].suffix}`;
  return {
    title: { absolute: full },
    description,
    alternates: { canonical: path(lang), languages: { es: path('es'), en: path('en'), 'x-default': path('es') } },
    openGraph: { title: full, description, type: 'website', url: path(lang), siteName: T[lang].brand, locale: lang === 'es' ? 'es_AR' : 'en_US' },
    twitter: { card: 'summary', title: full, description },
  };
}

/* ───────────── Piezas comunes ───────────── */

function Shell({ lang, routeKey, sub, kicker, h1, lead, updatedAt, ld, children }: {
  lang: Lang; routeKey: RouteKey; sub?: Record<Lang, string>; kicker: string; h1: string; lead: React.ReactNode;
  updatedAt?: number; ld?: unknown; children: React.ReactNode;
}) {
  const s = SEO[lang];
  return (
    <div className="theme-paper ed-page">
      <SiteHeader lang={lang} langHrefs={{ es: routePath('es', routeKey, sub?.es), en: routePath('en', routeKey, sub?.en) }} updatedAt={updatedAt} />
      <main className="ed-main">
        <div className="ed-head">
          <span className="ed-kicker">{kicker}</span>
          <h1 className="ed-headline">{h1}</h1>
          <div className="ed-lead">{lead}</div>
          <p className="ed-note">{s.updatedEvery} {s.sourceNote}</p>
        </div>
        {children}
        <SeoLinks lang={lang} current={routeKey} />
      </main>
      <SiteFooter lang={lang} />
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} /> : null}
    </div>
  );
}

/** Enlaces entre las páginas de búsqueda frecuente (ayudan a encontrarlas y a navegarlas). */
export function SeoLinks({ lang, current }: { lang: Lang; current?: RouteKey }) {
  const s = SEO[lang];
  const items: [RouteKey, string][] = [
    ['quakesToday', s.quakesToday.h1], ['volcanoesNow', s.volcanoesNow.h1], ['fires', s.fires.h1],
    ['hurricanes', s.hurricanes.h1], ['tsunami', s.tsunami.h1], ['learn', T[lang].learn.title],
    ['simulator', T[lang].nav2.sim], ['myPlace', T[lang].nav2.place], ['whatToDo', lang === 'es' ? 'Qué hacer' : 'What to do'],
  ];
  return (
    <nav className="seo-links" aria-label={T[lang].learn.related}>
      {items.filter(([k]) => k !== current).map(([k, label]) => <Link key={k} href={routePath(lang, k)}>{label}</Link>)}
    </nav>
  );
}

function EventRows({ lang, events, empty }: { lang: Lang; events: DisasterEvent[]; empty?: string }) {
  const t = T[lang], nf = (x: number, d = 0) => fmtNum(lang, x, d);
  if (!events.length) return <p className="ed-note">{empty ?? t.noData}</p>;
  return (
    <div>
      {events.map((e) => (
        <Link key={e.id} href={`/${lang}/evento/${encodeURIComponent(e.id)}`} className="ed-list-row">
          <span className={`ed-list-mag${isHighlighted(e) ? ' red' : ''}`}>{e.type === 'eq' && e.mag != null ? nf(e.mag, 1) : ''}</span>
          <span className="ev-row-body">
            <span className="ed-list-title">{localTitle(e, lang)}</span>
            <span className="ed-list-meta row">
              <Glyph shape={SHAPE[e.type]} type={e.type} alert={alertLevel(e)} size={12} />
              {[
                e.type === 'eq' ? null : t.T1[e.type],
                fmtTime(lang, e.time, 'UTC'),
                e.type === 'eq' && e.depth != null ? `${t.f.depth.toLowerCase()} ${nf(e.depth, 0)} km` : null,
                alertTag(e, lang), e.src,
              ].filter(Boolean).join(' · ')}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Lista de schema.org para la página (los primeros eventos, con su URL). */
const itemList = (lang: Lang, name: string, url: string, events: DisasterEvent[]) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name, url: SITE_URL + url, inLanguage: lang,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: events.length,
    itemListElement: events.slice(0, 20).map((e, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/${lang}/evento/${encodeURIComponent(e.id)}`, name: localTitle(e, lang),
    })),
  },
});

const biggest = (events: DisasterEvent[]) => events.reduce<DisasterEvent | null>((a, e) => (!a || (e.mag ?? 0) > (a.mag ?? 0) ? e : a), null);
const quakes = (events: DisasterEvent[]) => events.filter((e) => e.type === 'eq' && e.status !== 'deleted');

/* ───────────── Sismo hoy (mundo) ───────────── */

export const quakesTodayMeta = (lang: Lang) => seoMeta(lang, 'quakesToday', SEO[lang].quakesToday.title, SEO[lang].quakesToday.desc);

export async function QuakesToday({ lang }: { lang: Lang }) {
  const s = SEO[lang].quakesToday, nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const data = await recentEvents('24h');
  const list = quakes(data.events).sort((a, b) => b.time - a.time);
  const max = biggest(list);
  return (
    <Shell lang={lang} routeKey="quakesToday" kicker={s.kicker} h1={s.h1} updatedAt={data.fetchedAt}
      lead={<p>{max ? s.lead(nf(list.length), `M ${nf(max.mag ?? 0, 1)} · ${localTitle(max, lang)}`) : s.leadNone}</p>}
      ld={itemList(lang, s.h1, routePath(lang, 'quakesToday'), list)}>
      <section className="stack">
        <h2 className="ed-h3">{s.byCountry}</h2>
        <CountryLinks lang={lang} />
      </section>
      <section>
        <h2 className="ed-h3">{s.listTitle}</h2>
        <EventRows lang={lang} events={list.slice(0, LIST_MAX)} />
      </section>
    </Shell>
  );
}

function CountryLinks({ lang, skip }: { lang: Lang; skip?: string }) {
  return (
    <div className="seo-chips">
      {QUAKE_COUNTRIES.filter((c) => c.iso3 !== skip)
        .map((c) => ({ c, name: countryName(c.iso3, lang) }))
        .sort((a, b) => a.name.localeCompare(b.name, lang))
        .map(({ c, name }) => <Link key={c.iso3} href={routePath(lang, 'quakesIn', c[lang])}>{name}</Link>)}
    </div>
  );
}

/* ───────────── Sismos hoy en un país ───────────── */

export function quakesInMeta(lang: Lang, slug: string): Metadata {
  const c = quakeCountryBySlug(lang, slug);
  if (!c) return {};
  const name = countryName(c.iso3, lang), s = SEO[lang].quakesIn;
  return seoMeta(lang, 'quakesIn', s.title(name), s.desc(name), { es: c.es, en: c.en });
}

export async function QuakesIn({ lang, slug }: { lang: Lang; slug: string }) {
  const c = quakeCountryBySlug(lang, slug);
  if (!c) notFound();
  const s = SEO[lang].quakesIn, nf = (x: number, d = 0) => fmtNum(lang, x, d);
  const name = countryName(c.iso3, lang);
  const data = await recentEvents('30d');
  const list = quakes(data.events).filter((e) => e.iso3 === c.iso3).sort((a, b) => b.time - a.time);
  const n24 = list.filter((e) => e.time >= Date.now() - DAY).length;
  const max = biggest(list);
  const agency = NATIONAL[c.iso3]?.[0];
  // Sin sismos en 24 h: arriba de todo, el último registrado y hace cuánto (buscando hasta un año atrás).
  const last = n24 ? null : list[0] ?? quakes((await recentEvents('1y')).events).filter((e) => e.iso3 === c.iso3).sort((a, b) => b.time - a.time)[0] ?? null;
  return (
    <Shell lang={lang} routeKey="quakesIn" sub={{ es: c.es, en: c.en }} kicker={`${s.kicker} · ${name}`} h1={s.h1(name)} updatedAt={data.fetchedAt}
      lead={<>
        {!n24 && (
          <p className="seo-last">
            {last ? <>{s.lastLabel}: <Link href={`/${lang}/evento/${encodeURIComponent(last.id)}`}>M {nf(last.mag ?? 0, 1)} · {localTitle(last, lang)}</Link>, {fmtRel(lang, last.time)} ({fmtTime(lang, last.time, 'UTC')})</> : s.lastNone}
          </p>
        )}
        <p>{n24 ? s.lead(name, nf(n24), nf(list.length)) : s.leadNone(name, nf(list.length))}{' '}
          {max && max.mag != null ? s.biggest(nf(max.mag, 1), localTitle(max, lang), fmtTime(lang, max.time, 'UTC')) : ''}</p>
        <p className="ed-note">
          {agency ? <>{s.small}<a href={agency.url} target="_blank" rel="noopener noreferrer">{agency.name}</a>.</> : s.smallGeneric}
        </p>
      </>}
      ld={itemList(lang, s.h1(name), routePath(lang, 'quakesIn', c[lang]), list)}>
      <section>
        <h2 className="ed-h3">{s.listTitle}</h2>
        <EventRows lang={lang} events={list.slice(0, LIST_MAX)} />
        <p><Link href={`/${lang}/pais/${c.iso3.toLowerCase()}`} className="ed-more">{s.history(name)} →</Link></p>
      </section>
      <section className="stack">
        <h2 className="ed-h3">{s.other}</h2>
        <CountryLinks lang={lang} skip={c.iso3} />
      </section>
    </Shell>
  );
}

/** Para redirigir /es/sismos/espana ↔ /en/earthquakes/spain. */
export const quakeSlugs = (lang: Lang, slug: string) => {
  const c = quakeCountryBySlug(lang, slug);
  return c ? { es: c.es, en: c.en } : undefined;
};

/* ───────────── Volcanes activos ───────────── */

export const volcanoesNowMeta = (lang: Lang) => seoMeta(lang, 'volcanoesNow', SEO[lang].volcanoesNow.title, SEO[lang].volcanoesNow.desc);

const gvpDate = (lang: Lang, s?: string) =>
  s && /^\d{8}$/.test(s) ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))) : '';

export async function VolcanoesNow({ lang }: { lang: Lang }) {
  const s = SEO[lang].volcanoesNow, nf = (x: number) => fmtNum(lang, x);
  const [{ ongoing, events, fetchedAt }, idx] = await Promise.all([volcanoesNow(), volcanoIndex()]);
  const list = ongoing.slice().sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));
  return (
    <Shell lang={lang} routeKey="volcanoesNow" kicker={s.kicker} h1={s.h1} updatedAt={fetchedAt}
      lead={<p>{s.lead(nf(list.length), nf(events.length))}</p>}
      ld={itemList(lang, s.h1, routePath(lang, 'volcanoesNow'), events)}>
      <section>
        <h2 className="ed-h3">{s.ongoing}</h2>
        <div className="seo-grid">
          {list.map((v) => {
            const vn = Number(v.id.replace(/^\D+/, ''));
            const slug = idx.slugOf.get(vn);
            const body = <><strong>{v.title}</strong><span className="ed-note">{[v.country ? countryFromEnglish(v.country, lang) : '', v.since ? `${s.since} ${gvpDate(lang, v.since)}` : ''].filter(Boolean).join(' · ')}</span></>;
            return slug
              ? <Link key={v.id} href={routePath(lang, 'volcano', slug)} className="seo-card">{body}</Link>
              : <a key={v.id} href={v.gvpUrl} className="seo-card" target="_blank" rel="noopener noreferrer">{body}</a>;
          })}
        </div>
      </section>
      <section>
        <h2 className="ed-h3">{s.recent}</h2>
        <EventRows lang={lang} events={events.slice(0, LIST_MAX)} />
      </section>
    </Shell>
  );
}

/* ───────────── Incendios forestales ───────────── */

export const firesMeta = (lang: Lang) => seoMeta(lang, 'fires', SEO[lang].fires.title, SEO[lang].fires.desc);

export async function Fires({ lang }: { lang: Lang }) {
  const s = SEO[lang].fires, nf = (x: number) => fmtNum(lang, x);
  const [data, heat] = await Promise.all([recentEvents('7d'), getHeat().catch(() => null)]);
  const list = data.events.filter((e) => e.type === 'fire').sort((a, b) => relevance(b) - relevance(a) || b.time - a.time);
  const spots = heat?.bins.reduce((n, b) => n + b.count, 0) ?? 0;
  return (
    <Shell lang={lang} routeKey="fires" kicker={s.kicker} h1={s.h1} updatedAt={data.fetchedAt}
      lead={<>
        <p>{s.lead(nf(list.length))}</p>
        {heat && <p>{s.firms(nf(spots), nf(heat.bins.length))} <Link href={`/${lang}`}>{s.mapLink} →</Link></p>}
      </>}
      ld={itemList(lang, s.h1, routePath(lang, 'fires'), list)}>
      <section>
        <h2 className="ed-h3">{s.listTitle}</h2>
        <EventRows lang={lang} events={list.slice(0, LIST_MAX)} />
      </section>
    </Shell>
  );
}

/* ───────────── Huracanes ───────────── */

export const hurricanesMeta = (lang: Lang) => seoMeta(lang, 'hurricanes', SEO[lang].hurricanes.title, SEO[lang].hurricanes.desc);

export async function Hurricanes({ lang }: { lang: Lang }) {
  const s = SEO[lang].hurricanes, t = T[lang], nf = (x: number) => fmtNum(lang, x);
  const [data, nhc] = await Promise.all([recentEvents('7d'), getActiveStorms().catch(() => null)]);
  const storms = nhc?.storms ?? [];
  const list = data.events.filter((e) => e.type === 'storm').sort((a, b) => relevance(b) - relevance(a) || b.time - a.time);
  const named = storms.map((st) => `${t.nhcClass[st.classification] ?? st.classification} ${st.name}`);
  return (
    <Shell lang={lang} routeKey="hurricanes" kicker={s.kicker} h1={s.h1} updatedAt={data.fetchedAt}
      lead={<p>{storms.length ? s.leadNhc(nf(storms.length), new Intl.ListFormat(lang, { type: 'conjunction' }).format(named)) : s.leadNoNhc} {s.otherBasins(nf(list.length))}</p>}
      ld={itemList(lang, s.h1, routePath(lang, 'hurricanes'), list)}>
      {storms.length > 0 && (
        <section className="stack">
          <h2 className="ed-h3">{s.nhcTitle}</h2>
          {storms.map((st) => (
            <article key={st.id} className="seo-storm">
              <MediaFigure lang={lang} q={{ storm: st.id }} />
              <div className="stack">
                <strong className="ed-list-title">{t.nhcClass[st.classification] ?? st.classification} {st.name}</strong>
                <span className="ed-note">
                  {[st.windKt != null ? `${nf(Math.round(st.windKt * 1.852))} km/h (${nf(st.windKt)} kt)` : '', st.pressureMb != null ? `${nf(st.pressureMb)} hPa` : '',
                    fmtCoords(lang, st.lat, st.lon), `${t.nhcRows.updated}: ${fmtTime(lang, st.lastUpdate, 'UTC')}`].filter(Boolean).join(' · ')}
                </span>
                {st.advisoryUrl && <a href={st.advisoryUrl} target="_blank" rel="noopener noreferrer">{t.nhcLinks.advisory} ↗</a>}
              </div>
            </article>
          ))}
        </section>
      )}
      <section>
        <h2 className="ed-h3">{s.listTitle}</h2>
        <EventRows lang={lang} events={list.slice(0, LIST_MAX)} />
      </section>
    </Shell>
  );
}

/* ───────────── Alerta de tsunami ───────────── */

export const tsunamiMeta = (lang: Lang) => seoMeta(lang, 'tsunami', SEO[lang].tsunami.title, SEO[lang].tsunami.desc);

export async function Tsunami({ lang }: { lang: Lang }) {
  const s = SEO[lang].tsunami, t = T[lang], nf = (x: number) => fmtNum(lang, x);
  const [tsu, data] = await Promise.all([getTsunamiMessages().catch(() => null), recentEvents('7d')]);
  const active = tsu?.active ?? [];
  const flagged = quakes(data.events).filter((e) => e.tsunami).sort((a, b) => b.time - a.time);
  return (
    <Shell lang={lang} routeKey="tsunami" kicker={s.kicker} h1={s.h1} updatedAt={tsu?.fetchedAt ?? data.fetchedAt}
      lead={<>
        <p className={active.length ? 'seo-alert' : 'seo-ok'}>{active.length ? s.active(nf(active.length)) : s.none} {tsu ? s.checked(fmtTime(lang, tsu.fetchedAt, 'UTC')) : ''}</p>
        <p className="ed-note">{s.official}</p>
      </>}>
      <section className="stack">
        <h2 className="ed-h3">{s.messages}</h2>
        {!tsu?.messages.length && <p className="ed-note">{s.noMessages}</p>}
        {tsu?.messages.map((m) => (
          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="ed-list-row">
            <span className="ev-row-body">
              <span className="ed-list-title">{t.tsunamiLevel[m.level]} · {t.tsunamiCenterName[m.center] ?? m.center}</span>
              <span className="ed-list-meta">{localTsunamiRegion(m.region, lang)} · {fmtTime(lang, m.issued, 'UTC')}{m.magnitude != null ? ` · M ${fmtNum(lang, m.magnitude, 1)}` : ''} ↗</span>
              {localTsunamiRegion(m.region, lang) !== m.region && <span className="ed-list-meta orig">{t.original}: {m.region}</span>}
            </span>
          </a>
        ))}
        <p className="ed-note">
          <a href="https://www.tsunami.gov/" target="_blank" rel="noopener noreferrer">NOAA · tsunami.gov ↗</a>
          {' · '}<a href="https://www.shoa.cl/" target="_blank" rel="noopener noreferrer">SHOA (Chile) ↗</a>
          {' · '}<a href="https://www.jma.go.jp/jma/indexe.html" target="_blank" rel="noopener noreferrer">JMA (Japón / Japan) ↗</a>
        </p>
      </section>
      <section>
        <h2 className="ed-h3">{s.flagged}</h2>
        <p className="ed-note">{s.flaggedNote}</p>
        <EventRows lang={lang} events={flagged.slice(0, LIST_MAX)} />
      </section>
    </Shell>
  );
}

/* ───────────── Ficha de volcán (/es/volcanes/etna) ───────────── */

export async function volcanoMeta(lang: Lang, slug: string): Promise<Metadata> {
  const v = (await volcanoIndex()).bySlug.get(slug);
  if (!v) return {};
  const s = SEO[lang].volcano;
  const c = v.country ? countryFromEnglish(v.country, lang) : '';
  return seoMeta(lang, 'volcano', s.title(v.title, c), s.desc(v.title, c), { es: slug, en: slug });
}

export async function VolcanoPage({ lang, slug }: { lang: Lang; slug: string }) {
  const idx = await volcanoIndex();
  const v = idx.bySlug.get(slug);
  if (!v) notFound();
  const s = SEO[lang].volcano, nf = (x: number) => fmtNum(lang, x);
  const country = v.country ? countryFromEnglish(v.country, lang) : '';
  const [act, events] = await Promise.all([getVolcanoActivity().catch(() => null), volcanoEvents(v)]);
  const now = act?.volcanoes.find((x) => Number(x.id.replace(/^\D+/, '')) === v.num);
  const last = v.lastErup == null ? s.unknown : v.lastErup < 0 ? `${nf(-v.lastErup)} ${s.bce}` : String(v.lastErup);
  const url = routePath(lang, 'volcano', slug);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Mountain', name: v.title, url: SITE_URL + url,
    description: s.desc(v.title, country),
    geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lon },
    ...(country ? { containedInPlace: { '@type': 'Country', name: country } } : {}),
    sameAs: [`https://volcano.si.edu/volcano.cfm?vn=${v.num}`],
  };
  return (
    <Shell lang={lang} routeKey="volcano" sub={{ es: slug, en: slug }} kicker={[s.kicker, country].filter(Boolean).join(' · ')} h1={v.title}
      lead={<>
        <p><strong>{s.lastByGvp}:</strong> {last} · {events.length ? s.reportsYear(nf(events.length)) : s.reportsNone}</p>
        <p className={now ? 'seo-alert' : undefined}>
          <strong>{s.statusNow}: </strong>
          {now ? (now.status === 'new' ? s.statusNew : s.statusOngoing(gvpDate(lang, now.since))) : s.statusNone}
        </p>
      </>} ld={ld}>
      <div className="ed-grid">
        <MediaFigure lang={lang} q={{ volcano: v.num }} />
        <dl className="ev-facts">
          {[[s.facts.country, country], [s.facts.type, localVolcanoType(v.vtype, lang)], [s.facts.last, last], [s.facts.coords, fmtCoords(lang, v.lat, v.lon)], [s.facts.number, String(v.num)]]
            .filter(([, x]) => x).map(([k, x]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{x}</dd></div>)}
          <div style={{ display: 'contents' }}><dt>{T[lang].sources}</dt><dd><a href={`https://volcano.si.edu/volcano.cfm?vn=${v.num}`} target="_blank" rel="noopener noreferrer">Smithsonian GVP ↗</a></dd></div>
        </dl>
      </div>
      <section>
        <h2 className="ed-h3">{s.recent}</h2>
        <EventRows lang={lang} events={events.slice(0, 20)} empty={s.recentNone} />
        <p><Link href={routePath(lang, 'volcanoesNow')} className="ed-more">{s.allActive} →</Link></p>
      </section>
      <Suspense fallback={<p className="ed-note">{T[lang].loading}</p>}>
        <VolcanoGeology lang={lang} v={v} />
      </Suspense>
    </Shell>
  );
}

export { ROUTES };
