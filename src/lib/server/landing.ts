import 'server-only';
import { geoDistance } from 'd3-geo';
import { cached } from './cache';
import { getEvents, getGvp } from './ingest';
import { getVolcanoActivity } from './volcanoes';
import { slugify } from '../seo';
import type { DisasterEvent, GvpVolcano, RangeKey } from '../types';

/*
 * Datos de las páginas de búsqueda frecuente. Salen de la misma base que el mapa,
 * con 2 minutos de caché en memoria para que la página cargue rápido.
 */

export const recentEvents = (range: RangeKey) =>
  cached(`landing:${range}`, 2 * 6e4, async () => (await getEvents(range, new Date().getUTCFullYear())));

/** Volcanes del Holoceno (GVP) con un slug único por nombre: "Etna" → "etna"; repetidos llevan el número. */
export const volcanoIndex = () =>
  cached('landing:volcanoes', 60 * 6e4, async () => {
    const list = await getGvp();
    const count = new Map<string, number>();
    for (const v of list) { const s = slugify(v.title); count.set(s, (count.get(s) ?? 0) + 1); }
    const bySlug = new Map<string, GvpVolcano>();
    const slugOf = new Map<number, string>();
    for (const v of list) {
      const base = slugify(v.title) || 'volcan';
      const slug = count.get(base)! > 1 ? `${base}-${v.num}` : base;
      bySlug.set(slug, v); slugOf.set(v.num, slug);
    }
    return { bySlug, slugOf };
  });

/** Erupciones en curso (GVP) y eventos volcánicos de GDACS/EONET de los últimos 30 días. */
export async function volcanoesNow() {
  const [act, ev] = await Promise.all([
    getVolcanoActivity().catch(() => null),
    recentEvents('30d'),
  ]);
  return {
    ongoing: act?.volcanoes ?? [],
    events: ev.events.filter((e) => e.type === 'volcano').sort((a, b) => b.time - a.time),
    fetchedAt: ev.fetchedAt,
  };
}

/** Eventos volcánicos del último año a menos de 30 km del volcán. */
export async function volcanoEvents(v: GvpVolcano): Promise<DisasterEvent[]> {
  const year = await cached('landing:volc1y', 10 * 6e4, async () => (await getEvents('1y', new Date().getUTCFullYear())).events.filter((e) => e.type === 'volcano'));
  return year.filter((e) => geoDistance([e.lon, e.lat], [v.lon, v.lat]) * 6371 < 30).sort((a, b) => b.time - a.time);
}
