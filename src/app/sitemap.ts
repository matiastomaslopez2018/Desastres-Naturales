import type { MetadataRoute } from 'next';
import { LANGS } from '@/lib/i18n';
import { SITE_URL } from '@/lib/site';
import { ALERT_RANK, relevance } from '@/lib/symbols';
import { comparable, getRanking } from '@/lib/server/stats';
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
function featured(events: DisasterEvent[]): DisasterEvent[] {
  return events
    .filter((e) => {
      const alert = Math.max(e.alert ? ALERT_RANK[e.alert] : 0, e.pager ? ALERT_RANK[e.pager] : 0);
      return alert >= 2 || (e.type === 'eq' && (e.mag ?? 0) >= FEATURED_MAG);
    })
    .sort((a, b) => relevance(b) - relevance(a) || b.time - a.time)
    .slice(0, MAX_EVENTS);
}

/** Una entrada por URL, con su par en el otro idioma (hreflang). */
function entries(path: (lang: string) => string, extra: Omit<MetadataRoute.Sitemap[number], 'url'>): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LANGS.map((l) => [l, SITE_URL + path(l)]));
  return LANGS.map((l) => ({ url: SITE_URL + path(l), alternates: { languages }, ...extra }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { events, stats, fetchedAt } = await getRanking('1y', new Date().getUTCFullYear());
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
    ...[...stats.keys()].sort().flatMap((iso3) =>
      entries((l) => `/${l}/pais/${iso3.toLowerCase()}`, {
        lastModified: new Date(lastByCountry.get(iso3) ?? +updated), changeFrequency: 'daily', priority: 0.6,
      }),
    ),
    ...featured(events).flatMap((e) =>
      entries((l) => `/${l}/evento/${encodeURIComponent(e.id)}`, {
        lastModified: new Date(Math.max(e.time, e.end ?? 0)),
        changeFrequency: e.closed === false || e.status === 'automatic' ? 'daily' : 'monthly',
        priority: 0.5,
      }),
    ),
  ];
}
