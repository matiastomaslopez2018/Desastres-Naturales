import type { MetadataRoute } from 'next';
import { LANGS } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { ALERT_RANK, relevance } from '@/lib/symbols';
import { comparable, getRanking } from '@/lib/server/stats';
import { recentEvents, volcanoIndex } from '@/lib/server/landing';
import { ARTICLES } from '@/lib/learn';
import { QUAKE_COUNTRIES, routePath, type RouteKey } from '@/lib/seo';
import type { Lang } from '@/lib/types';
import type { DisasterEvent } from '@/lib/types';

// Sale de la base: se arma por pedido, no en el build.
export const dynamic = 'force-dynamic';
// Un período que todavía no está en la base se trae de las fuentes en el momento.
export const maxDuration = 60;

/** Tope de fichas de evento (el límite de un sitemap es 50.000 URLs; cada una va en dos idiomas). */
const MAX_EVENTS = 2000;
/** Sismo que merece ficha indexada aunque no tenga alerta. */
const FEATURED_MAG = 6;

/** Eventos destacados: alerta oficial naranja/roja o sismo desde M6, los más relevantes primero. */
const dedupe = (xs: DisasterEvent[]) => [...new Map(xs.map((e) => [e.id, e])).values()];

function featured(events: DisasterEvent[]): DisasterEvent[] {
  return events
    .filter((e) => {
      const alert = Math.max(e.alert ? ALERT_RANK[e.alert] : 0, e.pager ? ALERT_RANK[e.pager] : 0);
      return alert >= 2 || (e.type === 'eq' && (e.mag ?? 0) >= FEATURED_MAG);
    })
    .sort((a, b) => relevance(b) - relevance(a) || b.time - a.time)
    .slice(0, MAX_EVENTS);
}

/** Eventos nuevos (últimos 7 días): sismos desde M5 y cualquier evento con alerta oficial. */
const fresh = (events: DisasterEvent[]) => events.filter((e) => (e.type === 'eq' && (e.mag ?? 0) >= 5) || (e.alert ? ALERT_RANK[e.alert] : 0) >= 1 || (e.pager ? ALERT_RANK[e.pager] : 0) >= 1);

/** Una entrada por URL, con su par en el otro idioma (hreflang). */
function entries(path: (lang: string) => string, extra: Omit<MetadataRoute.Sitemap[number], 'url'>): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LANGS.map((l) => [l, SITE_URL + path(l)]));
  return LANGS.map((l) => ({ url: SITE_URL + path(l), alternates: { languages }, ...extra }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ events, stats, fetchedAt }, week, volcanoes] = await Promise.all([
    getRanking('1y', new Date().getUTCFullYear()),
    recentEvents('7d'),
    volcanoIndex().catch(() => null),
  ]);
  const updated = new Date(fetchedAt);

  // Último evento por país, para lastModified.
  const lastByCountry = new Map<string, number>();
  for (const e of events) {
    if (!comparable(e)) continue;
    lastByCountry.set(e.iso3!, Math.max(lastByCountry.get(e.iso3!) ?? 0, e.time));
  }

  return [
    ...entries((l) => `/${l}`, { lastModified: updated, changeFrequency: 'hourly', priority: 1 }),
    ...entries((l) => `/${l}/ranking`, { lastModified: updated, changeFrequency: 'daily', priority: 0.8 }),
    ...entries((l) => `/${l}/paises`, { lastModified: updated, changeFrequency: 'daily', priority: 0.7 }),
    ...entries((l) => `/${l}/metodologia`, { changeFrequency: 'monthly', priority: 0.4 }),
    ...[...stats.keys()].sort().flatMap((iso3) =>
      entries((l) => `/${l}/pais/${iso3.toLowerCase()}`, {
        lastModified: new Date(lastByCountry.get(iso3) ?? +updated), changeFrequency: 'daily', priority: 0.6,
      }),
    ),
    // Búsquedas frecuentes: se actualizan solas.
    ...(['quakesToday', 'volcanoesNow', 'fires', 'hurricanes', 'tsunami'] as RouteKey[]).flatMap((k) =>
      entries((l) => routePath(l as Lang, k), { lastModified: updated, changeFrequency: 'hourly', priority: 0.9 })),
    ...QUAKE_COUNTRIES.flatMap((c) =>
      entries((l) => routePath(l as Lang, 'quakesIn', c[l as Lang]), { lastModified: updated, changeFrequency: 'hourly', priority: 0.8 })),
    ...entries((l) => routePath(l as Lang, 'learn'), { changeFrequency: 'monthly', priority: 0.6 }),
    ...entries((l) => routePath(l as Lang, 'simulator'), { changeFrequency: 'monthly', priority: 0.7 }),
    ...entries((l) => routePath(l as Lang, 'tsunamiSim'), { changeFrequency: 'monthly', priority: 0.7 }),
    ...entries((l) => routePath(l as Lang, 'volcanoSim'), { changeFrequency: 'monthly', priority: 0.7 }),
    ...entries((l) => routePath(l as Lang, 'myPlace'), { changeFrequency: 'monthly', priority: 0.8 }),
    ...entries((l) => routePath(l as Lang, 'whatToDo'), { changeFrequency: 'monthly', priority: 0.8 }),
    ...entries((l) => routePath(l as Lang, 'widget'), { changeFrequency: 'monthly', priority: 0.5 }),
    ...entries((l) => routePath(l as Lang, 'thisDay'), { changeFrequency: 'daily', priority: 0.6 }),
    ...entries((l) => routePath(l as Lang, 'whatIf'), { changeFrequency: 'monthly', priority: 0.6 }),
    ...entries((l) => routePath(l as Lang, 'floodSim'), { changeFrequency: 'monthly', priority: 0.7 }),
    ...ARTICLES.flatMap((a) => entries((l) => routePath(l as Lang, 'learn', a[l as Lang].slug), { changeFrequency: 'monthly', priority: 0.7 })),
    ...[...(volcanoes?.bySlug.keys() ?? [])].sort().flatMap((slug) =>
      entries((l) => routePath(l as Lang, 'volcano', slug), { changeFrequency: 'weekly', priority: 0.4 })),
    ...dedupe([...fresh(week.events), ...featured(events)]).flatMap((e) =>
      entries((l) => `/${l}/evento/${encodeURIComponent(e.id)}`, {
        lastModified: new Date(Math.max(e.time, e.end ?? 0)),
        changeFrequency: e.closed === false || e.status === 'automatic' ? 'daily' : 'monthly',
        priority: 0.5,
      }),
    ),
  ];
}
