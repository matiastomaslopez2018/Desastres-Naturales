import { T } from './i18n';
import { fmtNum, fmtTime } from './format';
import type { DisasterEvent, Lang } from './types';

/** Magnitud principal para títulos: "M 6,1" en sismos, "751 acres" en otros si la fuente la da. */
export function headlineMag(lang: Lang, e: DisasterEvent): string {
  if (e.mag == null) return '';
  if (e.type === 'eq') return `M ${fmtNum(lang, e.mag, 1)}`;
  return `${fmtNum(lang, e.mag, e.mag % 1 ? 1 : 0)}${e.magUnit ? ' ' + e.magUnit : ''}`;
}

export function eventTitle(lang: Lang, e: DisasterEvent): string {
  const m = e.type === 'eq' ? headlineMag(lang, e) : '';
  return m ? `${m} — ${e.title}` : e.title;
}

/** Una línea factual para meta description y OG: tipo, fecha UTC, estado, alerta y fuente. */
export function eventDescription(lang: Lang, e: DisasterEvent): string {
  const t = T[lang];
  const parts: string[] = [t.T1[e.type]];
  if (e.type !== 'eq') { const m = headlineMag(lang, e); if (m) parts.push(m); }
  if (e.country) parts.push(e.country);
  parts.push(fmtTime(lang, e.start ?? e.time, 'UTC'));
  if (e.type === 'eq' && e.depth != null) parts.push(`${t.f.depth.toLowerCase()} ${fmtNum(lang, e.depth, 1)} km`);
  if (e.status === 'reviewed') parts.push(t.reviewed);
  else if (e.status === 'automatic') parts.push(t.automatic);
  if (e.pager) parts.push(`PAGER ${e.pager}`);
  if (e.alert) parts.push(`GDACS ${e.alert}`);
  parts.push(`${t.sourceLine}: ${e.src}`);
  return parts.join(' · ');
}
