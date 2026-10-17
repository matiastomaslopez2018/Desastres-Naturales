import 'server-only';
import { fetchJson } from './cache';
import { kvCached } from './kvCache';

/*
 * ReliefWeb (ONU OCHA): reportes oficiales de situación y ayuda humanitaria.
 * La API v2 exige un "appname" aprobado por ReliefWeb (RELIEFWEB_APPNAME). Sin él,
 * no se consulta la API y la ficha ofrece el enlace a la búsqueda pública de ReliefWeb.
 */

const API = 'https://api.reliefweb.int/v2';

export type ReliefReport = { title: string; source: string; date: number; url: string };

export const reliefwebAppname = () => process.env.RELIEFWEB_APPNAME?.trim() || null;

/** Búsqueda pública (sin API): por número GLIDE si lo hay, si no por texto. */
export function reliefwebSearchUrl(q: { glide?: string; text: string }) {
  return q.glide
    ? `https://reliefweb.int/disasters?search=${encodeURIComponent(q.glide)}`
    : `https://reliefweb.int/updates?search=${encodeURIComponent(q.text)}`;
}

type Resp = { data?: { fields: { title: string; url_alias?: string; url?: string; date?: { created?: string }; source?: { shortname?: string; name?: string }[] } }[] };

/** Reportes de un desastre (por GLIDE) o de una búsqueda de texto acotada a fechas. Sin appname → null. */
export async function getReliefReports(q: { glide?: string; text: string; from?: number }) {
  const app = reliefwebAppname();
  if (!app) return null;
  const key = `reliefweb:${q.glide ?? q.text}:${q.from ?? ''}`;
  const r = await kvCached(key, 6 * 36e5, async () => {
    const body = {
      limit: 6,
      sort: ['date.created:desc'],
      fields: { include: ['title', 'url_alias', 'url', 'date.created', 'source.shortname', 'source.name'] },
      ...(q.glide
        ? { filter: { field: 'disaster.glide', value: q.glide } }
        : { query: { value: q.text, operator: 'AND' }, ...(q.from ? { filter: { field: 'date.created', value: { from: new Date(q.from).toISOString() } } } : {}) }),
    };
    const j = await fetchJson<Resp>(`${API}/reports?appname=${encodeURIComponent(app)}`, 20000, 1, body);
    return (j.data ?? []).map(({ fields: f }) => ({
      title: f.title, source: f.source?.[0]?.shortname ?? f.source?.[0]?.name ?? 'ReliefWeb',
      date: Date.parse(f.date?.created ?? ''), url: f.url_alias || f.url || 'https://reliefweb.int',
    }) satisfies ReliefReport);
  });
  return r.value;
}
