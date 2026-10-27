/*
 * Descarga de eventos en CSV. Dos variantes:
 *   - "csv": separador coma y punto decimal (RFC 4180), para planillas en inglés, R, Python, QGIS…
 *   - "excel": separador punto y coma, coma decimal y BOM UTF-8, para que Excel en español lo abra en columnas.
 * El enlace usa los mismos filtros que el mapa (período, año, tipos, magnitud mínima y país).
 */
import type { DisasterEvent, Lang, RangeKey } from './types';

export type CsvFormat = 'csv' | 'excel';
export type ExportQuery = { range: RangeKey; year?: number; types?: string[]; min?: number; country?: string | null; format?: CsvFormat; lang: Lang };

/** URL de /api/export con estos filtros. */
export function exportHref(q: ExportQuery) {
  const p = new URLSearchParams({ range: q.range, lang: q.lang });
  if (q.range === 'year' && q.year) p.set('year', String(q.year));
  if (q.types?.length) p.set('tipos', q.types.join(','));
  if (q.min != null) p.set('min', String(q.min));
  if (q.country) p.set('pais', q.country);
  if (q.format === 'excel') p.set('formato', 'excel');
  return `/api/export?${p}`;
}

const HEAD: Record<Lang, string[]> = {
  es: ['id', 'tipo', 'fecha_utc', 'inicio_utc', 'fin_utc', 'latitud', 'longitud', 'profundidad_km', 'magnitud', 'tipo_magnitud', 'lugar', 'pais_iso3', 'pais', 'fuente', 'estado', 'alerta', 'posible_tsunami', 'organismos_nacionales', 'ficha', 'fuente_url'],
  en: ['id', 'type', 'time_utc', 'start_utc', 'end_utc', 'latitude', 'longitude', 'depth_km', 'magnitude', 'magnitude_type', 'place', 'country_iso3', 'country', 'source', 'status', 'alert', 'tsunami_flag', 'national_agencies', 'page', 'source_url'],
};
const TYPE: Record<Lang, Record<string, string>> = {
  es: { eq: 'sismo', volcano: 'volcan', fire: 'incendio', storm: 'tormenta', flood: 'inundacion', drought: 'sequia' },
  en: { eq: 'earthquake', volcano: 'volcano', fire: 'wildfire', storm: 'storm', flood: 'flood', drought: 'drought' },
};
const SOURCE: Record<string, string> = { CSN: 'CSN (Universidad de Chile)' };

/** Arma el CSV. `title` y `country` traducen lugar y país al idioma pedido. */
export function toCsv(events: DisasterEvent[], o: { lang: Lang; format: CsvFormat; site: string; title: (e: DisasterEvent) => string; country: (iso3: string) => string }) {
  const excel = o.format === 'excel', sep = excel ? ';' : ',';
  const iso = (ms?: number) => (ms ? new Date(ms).toISOString().replace('.000Z', 'Z') : '');
  const num = (x: number | null | undefined, d: number) => (x == null || !Number.isFinite(x) ? '' : excel ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
  // Texto: entre comillas si hace falta; los que empiezan con = + - @ se anteponen con ' para que la planilla
  // no los tome como fórmulas (los textos vienen de las fuentes).
  const txt = (s: string | null | undefined) => {
    let v = (s ?? '').replace(/\r?\n/g, ' ');
    if (/^[=+\-@\t]/.test(v)) v = `'${v}`;
    return /["\n;,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = [HEAD[o.lang].join(sep)];
  for (const e of events) {
    rows.push([
      txt(e.id), TYPE[o.lang][e.type] ?? e.type, iso(e.time), iso(e.start), iso(e.end),
      num(e.lat, 4), num(e.lon, 4), num(e.depth, 1), num(e.mag ?? null, 1), txt(e.magType ?? e.magUnit ?? ''),
      txt(o.title(e)), e.iso3 ?? '', txt(e.iso3 ? o.country(e.iso3) : e.country ?? ''), txt(SOURCE[e.src] ?? e.src),
      txt(e.status ?? (e.closed ? 'closed' : '')), e.alert ?? e.pager ?? '', e.tsunami ? '1' : '',
      txt((e.local ?? []).map((l) => `${l.agency} M${l.mag != null ? l.mag.toFixed(1) : '?'}${l.magType ? ` ${l.magType}` : ''}`).join(' | ')),
      `${o.site}/${o.lang}/evento/${encodeURIComponent(e.id)}`, txt(e.url ?? ''),
    ].join(sep));
  }
  return (excel ? '﻿' : '') + rows.join('\r\n') + '\r\n';
}
