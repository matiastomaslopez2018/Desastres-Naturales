/*
 * Widget para insertar en otros sitios (/embed): parámetros de la URL, textos y el código para copiar.
 *   /embed?lang=es&tipo=eq&pais=ARG&min=3&n=8&periodo=24h&tema=auto
 */
import type { EventType, Lang } from './types';

export type WidgetType = EventType | 'all';
export type WidgetTheme = 'auto' | 'light' | 'dark';
export type WidgetParams = { lang: Lang; type: WidgetType; country: string | null; min: number; n: number; range: '24h' | '7d' | '30d'; theme: WidgetTheme };

export const WIDGET_TYPES: WidgetType[] = ['eq', 'all', 'volcano', 'fire', 'storm', 'flood'];
export const WIDGET_DEFAULT: WidgetParams = { lang: 'es', type: 'eq', country: null, min: 2.5, n: 8, range: '24h', theme: 'auto' };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseWidget(sp: Search): WidgetParams {
  const lang = one(sp.lang) === 'en' ? 'en' : 'es';
  const type = (WIDGET_TYPES as string[]).includes(one(sp.tipo) ?? '') ? (one(sp.tipo) as WidgetType) : WIDGET_DEFAULT.type;
  const c = (one(sp.pais) ?? '').toUpperCase();
  const min = Number(one(sp.min));
  const n = Number(one(sp.n));
  const range = one(sp.periodo) === '7d' || one(sp.periodo) === '30d' ? (one(sp.periodo) as '7d' | '30d') : '24h';
  const theme = one(sp.tema) === 'light' || one(sp.tema) === 'dark' ? (one(sp.tema) as WidgetTheme) : 'auto';
  return {
    lang, type, country: /^[A-Z]{3}$/.test(c) ? c : null,
    min: Number.isFinite(min) ? Math.max(2.5, Math.min(8, min)) : WIDGET_DEFAULT.min,
    n: Number.isInteger(n) ? Math.max(3, Math.min(20, n)) : WIDGET_DEFAULT.n,
    range, theme,
  };
}

/** Consulta de la URL del widget (sin los valores por omisión, para que el código quede corto). */
export function widgetQuery(p: WidgetParams) {
  const q = new URLSearchParams({ lang: p.lang });
  if (p.type !== WIDGET_DEFAULT.type) q.set('tipo', p.type);
  if (p.country) q.set('pais', p.country);
  if ((p.type === 'eq' || p.type === 'all') && p.min !== WIDGET_DEFAULT.min) q.set('min', String(p.min));
  if (p.n !== WIDGET_DEFAULT.n) q.set('n', String(p.n));
  if (p.range !== WIDGET_DEFAULT.range) q.set('periodo', p.range);
  if (p.theme !== 'auto') q.set('tema', p.theme);
  return q.toString();
}

export const WIDGET_TEXT = {
  es: {
    types: { eq: 'Sismos', all: 'Eventos', volcano: 'Erupciones', fire: 'Incendios', storm: 'Tormentas y ciclones', flood: 'Inundaciones', drought: 'Sequías' } as Record<WidgetType, string>,
    world: 'en el mundo', inCountry: (c: string) => `en ${c}`, ranges: { '24h': 'últimas 24 horas', '7d': 'últimos 7 días', '30d': 'últimos 30 días' },
    none: 'No hubo eventos en este período.', depth: (k: string) => `${k} km de prof.`, live: 'En vivo', more: 'Ver el mapa', from: (m: string) => `desde M${m}`,
    sources: 'Datos: USGS, INPRES, CSN (Universidad de Chile), NASA EONET y GDACS',
  },
  en: {
    types: { eq: 'Earthquakes', all: 'Events', volcano: 'Eruptions', fire: 'Wildfires', storm: 'Storms and cyclones', flood: 'Floods', drought: 'Droughts' } as Record<WidgetType, string>,
    world: 'worldwide', inCountry: (c: string) => `in ${c}`, ranges: { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days' },
    none: 'No events in this period.', depth: (k: string) => `${k} km deep`, live: 'Live', more: 'See the map', from: (m: string) => `from M${m}`,
    sources: 'Data: USGS, INPRES, CSN (University of Chile), NASA EONET and GDACS',
  },
};
