import { T } from './i18n';
import { countryName } from './countries';
import { fmtNum, fmtTime } from './format';
import { alertName, localTitle } from './localize';
import type { DisasterEvent, Lang } from './types';

/** Magnitud principal para títulos: "M 6,1" en sismos, "751 acres" en otros si la fuente la da. */
export function headlineMag(lang: Lang, e: DisasterEvent): string {
  if (e.mag == null) return '';
  if (e.type === 'eq') return `M ${fmtNum(lang, e.mag, 1)}`;
  return `${fmtNum(lang, e.mag, e.mag % 1 ? 1 : 0)}${e.magUnit ? ' ' + e.magUnit : ''}`;
}

export function eventTitle(lang: Lang, e: DisasterEvent): string {
  const m = e.type === 'eq' ? headlineMag(lang, e) : '';
  const title = localTitle(e, lang);
  return m ? `${m} — ${title}` : title;
}

/**
 * Título para buscadores: "Sismo de magnitud 6,8 en Japón, 14 oct 2026",
 * "Incendio forestal en Australia, 17 sept 2026", "Huracán Trudy, 13 oct 2026".
 */
export function seoEventTitle(lang: Lang, e: DisasterEvent): string {
  const day = fmtTime(lang, e.start ?? e.time, 'UTC').split(' · ')[0];
  const where = e.iso3 ? countryName(e.iso3, lang) : e.country ?? '';
  if (e.type === 'eq' && e.mag != null) {
    const m = fmtNum(lang, e.mag, 1);
    const place = where || localTitle(e, lang);
    return lang === 'es' ? `Sismo de magnitud ${m} ${where ? 'en ' : ': '}${place}, ${day}` : `Magnitude ${m} earthquake ${where ? 'in ' : '— '}${place}, ${day}`;
  }
  const title = localTitle(e, lang);
  const inWhere = where && !title.toLowerCase().includes(where.toLowerCase()) ? (lang === 'es' ? ` en ${where}` : ` in ${where}`) : '';
  return `${title}${inWhere}, ${day}`;
}

/** Una línea factual para meta description y OG: tipo, fecha UTC, estado, alerta y fuente. */
export function eventDescription(lang: Lang, e: DisasterEvent): string {
  const t = T[lang];
  const parts: string[] = [t.T1[e.type]];
  if (e.type !== 'eq') { const m = headlineMag(lang, e); if (m) parts.push(m); }
  const where = e.iso3 ? countryName(e.iso3, lang) : e.country;
  if (where) parts.push(where);
  parts.push(fmtTime(lang, e.start ?? e.time, 'UTC'));
  if (e.type === 'eq' && e.depth != null) parts.push(`${t.f.depth.toLowerCase()} ${fmtNum(lang, e.depth, 1)} km`);
  if (e.status === 'reviewed') parts.push(t.reviewed);
  else if (e.status === 'automatic') parts.push(t.automatic);
  if (e.pager) parts.push(`PAGER ${alertName(e.pager, lang)}`);
  if (e.alert) parts.push(`GDACS ${alertName(e.alert, lang)}`);
  parts.push(`${t.sourceLine}: ${e.src}`);
  return parts.join(' · ');
}
