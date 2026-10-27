import { getEvents } from '@/lib/server/ingest';
import { withCountry } from '@/lib/server/countries';
import { parseRange, parseYear } from '@/lib/range';
import { countryName } from '@/lib/countries';
import { localTitle } from '@/lib/localize';
import { SITE_URL } from '@/lib/site';
import { toCsv } from '@/lib/exportCsv';
import type { DisasterEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TYPES = ['eq', 'tsunami', 'volcano', 'fire', 'storm', 'flood', 'drought'];

/*
 * Descarga de eventos en CSV con los filtros del mapa:
 *   ?range=24h|7d|30d|1y|year&year=2025&tipos=eq,volcano&min=4.5&pais=ARG&lang=es&formato=excel
 * "tsunami" en tipos: sismos marcados por el USGS en zona oceánica (como el filtro del mapa).
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const range = parseRange(sp.get('range')), year = parseYear(sp.get('year'));
  const lang = sp.get('lang') === 'en' ? 'en' : 'es';
  const format = sp.get('formato') === 'excel' ? 'excel' : 'csv';
  const types = (sp.get('tipos') ?? '').split(',').filter((t) => TYPES.includes(t));
  const min = Number(sp.get('min'));
  const country = /^[A-Za-z]{3}$/.test(sp.get('pais') ?? '') ? sp.get('pais')!.toUpperCase() : null;

  const { events } = await getEvents(range, year);
  const keep = (e: DisasterEvent) => {
    if (country && e.iso3 !== country) return false;
    if (e.type === 'eq') {
      if (Number.isFinite(min) && e.mag != null && e.mag < min) return false;
      return !types.length || types.includes('eq') || (!!e.tsunami && types.includes('tsunami'));
    }
    return !types.length || types.includes(e.type);
  };
  // País por punto en polígono para los eventos que la fuente no trae con país (igual que las páginas de países).
  const list = events.map((e) => (e.iso3 ? e : withCountry(e))).filter(keep).sort((a, b) => b.time - a.time);
  const csv = toCsv(list, { lang, format, site: SITE_URL, title: (e) => localTitle(e, lang, false), country: (iso3) => countryName(iso3, lang) });
  const name = ['mapa-de-desastres', range === 'year' ? String(year) : range, country?.toLowerCase(), types.length ? types.join('-') : null, new Date().toISOString().slice(0, 10)].filter(Boolean).join('_');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}${format === 'excel' ? '_excel' : ''}.csv"`,
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  });
}
